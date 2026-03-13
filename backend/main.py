# =====================================================
# IMPORTS
# =====================================================

import os
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import text

from backend.database import engine

def normalizar_texto(texto):

    if texto is None:
        return None

    texto = str(texto).strip().lower()

    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")

    return texto

# =====================================================
# APP
# =====================================================

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../frontend"))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def landing():
    return FileResponse(os.path.join(FRONTEND_DIR, "landing/index.html"))


@app.get("/dashboard")
def dashboard():
    return FileResponse(os.path.join(FRONTEND_DIR, "dashboard/dashboard.html"))


@app.get("/reportes")
def reportes():
    return FileResponse(os.path.join(FRONTEND_DIR, "reportes/reportes.html"))

# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# SEGURIDAD
# =====================================================

SECRET_KEY = os.getenv("SECRET_KEY", "CLAVE_LOCAL_TEMPORAL")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def normalizar_fecha(fecha_str):
    return datetime.strptime(fecha_str, "%Y-%m-%d").date()

# =====================================================
# DASHBOARD GLOBAL
# =====================================================

@app.get("/api/dashboard/global")
def dashboard_global(fecha: Optional[str] = None):

    fecha_corte = None
    if fecha:
        fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()

    with engine.connect() as conn:

        kpis = conn.execute(
            text("""
                SELECT 
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE LOWER(pv.estado) LIKE '%ejec%') AS en_ejecucion,
                    COUNT(*) FILTER (WHERE LOWER(pv.estado) LIKE '%paraliz%') AS paralizado,
                    COUNT(*) FILTER (WHERE LOWER(pv.estado) LIKE '%sin%') AS sin_iniciar,
                    COUNT(*) FILTER (WHERE LOWER(pv.estado) LIKE '%conclu%') AS concluido
                FROM proyectos p

                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
                    ORDER BY pv2.fecha_corte DESC
                    LIMIT 1
                ) pv ON true
            """),
            {"fecha": fecha_corte}
        ).fetchone()

        estados = conn.execute(
            text("""
                SELECT pv.estado, COUNT(*) as cantidad
                FROM proyectos p
                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
                    ORDER BY pv2.fecha_corte DESC
                    LIMIT 1
                ) pv ON true
                GROUP BY pv.estado
            """),
            {"fecha": fecha_corte}
        ).fetchall()

        dependencias = conn.execute(
            text("""
                SELECT 
                    pv.dependencias_externas AS entidad,
                    COUNT(*) as cantidad
                FROM proyectos p
                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
                    ORDER BY pv2.fecha_corte DESC
                    LIMIT 1
                ) pv ON true
                WHERE pv.dependencias_externas IS NOT NULL
                AND pv.dependencias_externas <> ''
                AND LOWER(pv.dependencias_externas) <> 'ninguna'
                GROUP BY pv.dependencias_externas
                ORDER BY cantidad DESC
            """),
            {"fecha": fecha_corte}
        ).fetchall()
        
        # ================= DIRECCIONES TOTAL =================

        direcciones_total = conn.execute(text("""

        SELECT 
            d.id,
            d.nombre AS direccion,
            COUNT(*) as cantidad

        FROM proyectos p

        JOIN LATERAL (
            SELECT *
            FROM proyecto_version pv2
            WHERE pv2.proyecto_id = p.id
            AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
            ORDER BY pv2.fecha_corte DESC
            LIMIT 1
        ) pv ON true

        JOIN direcciones d 
        ON d.id = pv.direccion_id

        GROUP BY d.id, d.nombre
        ORDER BY cantidad DESC

        """), {
            "fecha": fecha_corte
        }).fetchall()

        # ================= DIRECCIONES FILTRADAS =================

        direcciones_filtradas = conn.execute(text("""

        SELECT 
            d.id,
            d.nombre AS direccion,
            COUNT(*) as cantidad

        FROM proyecto_version pv

        JOIN direcciones d 
            ON d.id = pv.direccion_id

        WHERE (:fecha IS NULL OR pv.fecha_corte = :fecha)

        GROUP BY d.id, d.nombre
        ORDER BY cantidad DESC

        """), {
            "fecha": fecha_corte
        }).fetchall()
        
    return {
        "kpis": dict(kpis._mapping),
        "estados": [dict(r._mapping) for r in estados],
        "dependencias": [dict(r._mapping) for r in dependencias],
        "direcciones_total": [dict(r._mapping) for r in direcciones_total],
        "direcciones_filtradas": [dict(r._mapping) for r in direcciones_filtradas]
    }

# =====================================================
# DASHBOARD POR DIRECCIÓN
# =====================================================

@app.get("/api/dashboard/direccion/{direccion_id}")
def dashboard_por_direccion(direccion_id: int, fecha: Optional[str] = None):

    with engine.connect() as conn:

        # Convertir fecha si viene
        fecha_corte = None
        if fecha:
            fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()

        # ================= ESTADOS =================
        estados = conn.execute(text("""
            SELECT pv.estado, COUNT(*) as cantidad
            FROM proyectos p
            JOIN LATERAL (
                SELECT *
                FROM proyecto_version pv2
                WHERE pv2.proyecto_id = p.id
                AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
                ORDER BY pv2.fecha_corte DESC
                LIMIT 1
            ) pv ON true
            WHERE pv.direccion_id = :direccion_id
            GROUP BY pv.estado
        """), {
            "direccion_id": direccion_id,
            "fecha": fecha_corte
        }).fetchall()

        # ================= DEPENDENCIAS INTERNAS =================
        dependencias = conn.execute(text("""
        SELECT 
            d.codigo AS direccion_dependencia,
            COUNT(*) as cantidad
        FROM proyectos p

        JOIN LATERAL (
            SELECT *
            FROM proyecto_version pv2
            WHERE pv2.proyecto_id = p.id
            AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
            ORDER BY pv2.fecha_corte DESC
            LIMIT 1
        ) pv ON true

        LEFT JOIN proyecto_dependencia_interna pdi
            ON pdi.proyecto_version_id = pv.id

        LEFT JOIN direcciones d
            ON d.id = pdi.direccion_id

        WHERE pv.direccion_id = :direccion_id

        GROUP BY d.codigo
        ORDER BY cantidad DESC
        """), {
            "direccion_id": direccion_id,
            "fecha": fecha_corte
        }).fetchall()

        # ================= CLASIFICACIÓN =================
        clasificacion = conn.execute(text("""
        SELECT 
            c.nombre AS clasificacion,
            COUNT(*) as cantidad
        FROM proyectos p

        JOIN LATERAL (
            SELECT *
            FROM proyecto_version pv2
            WHERE pv2.proyecto_id = p.id
            AND (:fecha IS NULL OR pv2.fecha_corte <= :fecha)
            ORDER BY pv2.fecha_corte DESC
            LIMIT 1
        ) pv ON true

        JOIN clasificaciones c
            ON c.id = pv.clasificacion_id

        WHERE pv.direccion_id = :direccion_id

        GROUP BY c.nombre
        ORDER BY c.nombre
        """), {
            "direccion_id": direccion_id,
            "fecha": fecha_corte
        }).fetchall()

    return {
        "estados": [dict(r._mapping) for r in estados],
        "dependencias": [dict(r._mapping) for r in dependencias],
        "clasificacion": [dict(r._mapping) for r in clasificacion]
    }

# =====================================================
# LISTAR PROYECTOS (FILTRADO POR DIRECCIÓN + FECHA + CLASIFICACIÓN)
# =====================================================

from typing import Optional
from datetime import datetime

@app.get("/api/proyectos")
def proyectos_por_direccion(
    direccion_id: int,
    fecha: Optional[str] = None,
    clasificacion_id: Optional[int] = None
):

    with engine.connect() as conn:

        fecha_corte = None
        if fecha:
            fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()

        resultados = conn.execute(text("""

        SELECT 
            p.id,
            p.nombre
        FROM proyectos p

        JOIN proyecto_version pv
            ON pv.proyecto_id = p.id

        WHERE pv.direccion_id = :direccion_id
        AND (:fecha IS NULL OR pv.fecha_corte = :fecha)
        AND (:clasificacion_id IS NULL OR pv.clasificacion_id = :clasificacion_id)

        ORDER BY p.nombre

        """), {
            "direccion_id": direccion_id,
            "fecha": fecha_corte,
            "clasificacion_id": clasificacion_id
        }).fetchall()

    return [dict(r._mapping) for r in resultados]

# =====================================================
# HISTÓRICO + DETALLE PROYECTO (POR FECHA)
# =====================================================

@app.get("/public/reportes/{proyecto_id}/historico")
def obtener_historico(proyecto_id: int, fecha: str):

    try:
        fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    with engine.connect() as conn:

        # ================= IDENTIFICACIÓN =================

        identificacion = conn.execute(text("""
            SELECT 
                cui,
                codigo_dsp,
                ubicacion,
                tipologia,
                entidad_formuladora
            FROM proyectos
            WHERE id = :id
        """), {"id": proyecto_id}).fetchone()

        # ================= HISTÓRICO EJECUTADO =================

        historico = conn.execute(text("""
        SELECT 
            fecha_corte,
            avance_fisico_ejecutado,
            avance_presupuesto_ejecutado
        FROM data_ejecucion
        WHERE proyecto_id = :id
        AND fecha_corte <= :fecha
        ORDER BY fecha_corte
        """), {
            "id": proyecto_id,
            "fecha": fecha_corte
        }).fetchall()

        if not historico:
            raise HTTPException(status_code=404, detail="Sin datos para esa fecha")

        # ================= PROGRAMADO =================

        programado_rows = conn.execute(text("""
        SELECT 
            fecha_corte,
            avance_fisico_programado
        FROM data_programada
        WHERE proyecto_id = :id
        AND fecha_corte <= :fecha
        """), {
            "id": proyecto_id,
            "fecha": fecha_corte
        }).fetchall()

        # ================= VERSION =================

        version = conn.execute(text("""
        SELECT *
        FROM proyecto_version
        WHERE proyecto_id = :id
        AND fecha_corte <= :fecha
        ORDER BY fecha_corte DESC
        LIMIT 1
        """), {
            "id": proyecto_id,
            "fecha": fecha_corte
        }).fetchone()

        # ================= ARC =================

        arc_rows = conn.execute(text("""
        SELECT DISTINCT ON (codigo_arc)
            codigo_arc,
            descripcion,
            inicio_programado,
            fin_programado,
            inicio_ejecutado,
            fin_ejecutado,
            avance_percent
        FROM proyecto_arc
        WHERE proyecto_id = :id
        AND fecha_corte <= :fecha
        ORDER BY codigo_arc, fecha_corte DESC
        """), {
            "id": proyecto_id,
            "fecha": fecha_corte
        }).fetchall()

    # ================= FORMATEO =================

    meses = [r.fecha_corte.strftime("%Y-%m-%d") for r in historico]

    fisico = [float(r.avance_fisico_ejecutado or 0) for r in historico]

    financiero = [float(r.avance_presupuesto_ejecutado or 0) for r in historico]

    programado_dict = {
        r.fecha_corte: float(r.avance_fisico_programado or 0)
        for r in programado_rows
    }

    programado = [
        programado_dict.get(r.fecha_corte, 0)
        for r in historico
    ]

    arcs = [
        {
            "codigo": r.codigo_arc,
            "descripcion": r.descripcion,
            "inicio_programado": str(r.inicio_programado) if r.inicio_programado else None,
            "fin_programado": str(r.fin_programado) if r.fin_programado else None,
            "inicio_ejecutado": str(r.inicio_ejecutado) if r.inicio_ejecutado else None,
            "fin_ejecutado": str(r.fin_ejecutado) if r.fin_ejecutado else None,
            "avance": float(r.avance_percent or 0)
        }
        for r in arc_rows
    ]

    # ARC actual según fecha

    arc_actual = None

    for r in arc_rows:
        if (
            r.inicio_programado
            and r.fin_programado
            and r.inicio_programado <= fecha_corte <= r.fin_programado
        ):
            arc_actual = r.codigo_arc
            break

    return {

        # ================= IDENTIFICACIÓN =================
        "cui": identificacion.cui if identificacion else None,
        "codigo_dsp": identificacion.codigo_dsp if identificacion else None,
        "ubicacion": identificacion.ubicacion if identificacion else None,
        "tipologia": identificacion.tipologia if identificacion else None,
        "entidad_formuladora": identificacion.entidad_formuladora if identificacion else None,

        # ================= ENTIDAD EJECUTORA =================
        "entidad_ejecutora": version.entidad_ejecutora if version else None,

        # ================= CONTACTO =================
        "coordinador": version.coordinador if version else None,
        "correo": version.correo if version else None,
        "celular": version.celular if version else None,

        # ================= HISTÓRICO =================
        "meses": meses,
        "fisico": fisico,
        "financiero": financiero,
        "programado": programado,

        # ================= PRESUPUESTO =================
        "presupuesto_programado": float(version.presupuesto_programado or 0) if version else 0,

        # ================= PLAZOS =================
        "inicio_programado": str(version.fecha_inicio_programado) if version and version.fecha_inicio_programado else None,
        "inicio_ejecutado": str(version.fecha_inicio_ejecutado) if version and version.fecha_inicio_ejecutado else None,
        "fin_programado": str(version.fecha_fin_programado) if version and version.fecha_fin_programado else None,

        # ================= CLASIFICACIÓN =================
        "dependencias": version.dependencias_externas if version else None,
        "es_invierte": bool(version.proyecto_inversion) if version else False,

        # ================= ARC =================
        "arc_actual": arc_actual,
        "arcs": arcs
    }

# =====================================================
# MODELO LOGIN
# =====================================================

class LoginRequest(BaseModel):
    email: str
    password: str

# =====================================================
# LOGIN
# =====================================================

from passlib.hash import bcrypt

@app.post("/login")
def login(data: LoginRequest):

    with engine.connect() as connection:
        result = connection.execute(
            text("""
            SELECT id, email, password_hash, rol
            FROM usuarios
            WHERE email = :email
            """),
            {"email": data.email}
        ).mappings().fetchone()

    if result is None:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")

    password_hash = result["password_hash"]

    if not bcrypt.verify(data.password, password_hash):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    token = jwt.encode(
        {
            "sub": data.email,
            "rol": result["rol"],
            "exp": expire
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "rol": result["rol"]
    }

# =====================================================
# OBTENER USUARIO ACTUAL
# =====================================================

def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")

        with engine.connect() as connection:
            user = connection.execute(
                text("SELECT * FROM usuarios WHERE email = :email"),
                {"email": email}
            ).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return user

    except:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# =====================================================
# SUBIR EXCEL (ADMIN)
# =====================================================

@app.post("/admin/upload-excel")
def upload_excel(
    file: UploadFile = File(...),
):

    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .xlsx")

    try:
        df = pd.read_excel(file.file)
        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
            .str.replace(" ", "_")
)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo el Excel: {str(e)}")

    columnas_obligatorias = [
        "nombre",
        "direccion_id",
        "fecha_corte",
        "avance_fisico",
        "avance_financiero",
        "avance_programado",
        "presupuesto_actual",
        "estado",
        "fecha_inicio_programado",
        "fecha_inicio_ejecutado",
        "fecha_fin_programado",
        "dependencias_externas",
        "presupuesto_programado",
        "proyecto_inversion",
        "clasificacion",
        "dependencias_internas"
    ]
    faltantes = [c for c in columnas_obligatorias if c not in df.columns]

    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas en el Excel: {faltantes}"
        )

    with engine.begin() as conn:

        for _, row in df.iterrows():

            nombre = str(row.nombre).strip()
            direccion_id = int(row.direccion_id)
            fecha_corte = pd.to_datetime(row["fecha_corte"]).date()

            avance_fisico = float(row["avance_fisico"] or 0)
            avance_financiero = float(row["avance_financiero"] or 0)
            avance_programado = float(row["avance_programado"] or 0)
            presupuesto_actual = float(row["presupuesto_actual"] or 0)
            presupuesto_programado = float(row["presupuesto_programado"] or 0)

            estado = str(row["estado"]).strip()

            toma_decisiones = (
                str(row["toma_decisiones"]).strip()
                if "toma_decisiones" in df.columns and pd.notna(row["toma_decisiones"])
                else None
)

            dependencias_externas = (
                str(row["dependencias_externas"]).strip()
                if pd.notna(row["dependencias_externas"])
                else None
            )

            dependencias_internas = (
                str(row["dependencias_internas"]).strip()
                if pd.notna(row["dependencias_internas"])
                else None
            )

            # =====================================================
            # CAMPOS DE IDENTIFICACIÓN (FICHA)
            # =====================================================

            cui = str(row["cui"]).strip() if "cui" in df.columns and pd.notna(row["cui"]) else None
            codigo_dsp = str(row["codigo_dsp"]).strip() if "codigo_dsp" in df.columns and pd.notna(row["codigo_dsp"]) else None
            ubicacion = str(row["ubicacion"]).strip() if "ubicacion" in df.columns and pd.notna(row["ubicacion"]) else None
            tipologia = str(row["tipologia"]).strip() if "tipologia" in df.columns and pd.notna(row["tipologia"]) else None
            entidad_ejecutora = str(row["entidad_ejecutora"]).strip() if "entidad_ejecutora" in df.columns and pd.notna(row["entidad_ejecutora"]) else None
            entidad_formuladora = str(row["entidad_formuladora"]).strip() if "entidad_formuladora" in df.columns and pd.notna(row["entidad_formuladora"]) else None
            coordinador = str(row["coordinador"]).strip() if "coordinador" in df.columns and pd.notna(row["coordinador"]) else None
            correo = str(row["correo"]).strip() if "correo" in df.columns and pd.notna(row["correo"]) else None
            celular = str(row["celular"]).strip() if "celular" in df.columns and pd.notna(row["celular"]) else None

            # ================= PROYECTO INVERSIÓN =================

            if pd.isna(row["proyecto_inversion"]):
                proyecto_inversion = None
            else:
                valor = str(row["proyecto_inversion"]).strip().lower()

                if valor in ["true", "1", "si", "sí"]:
                    proyecto_inversion = True
                elif valor in ["false", "0", "no"]:
                    proyecto_inversion = False
                else:
                    proyecto_inversion = None


            # ================= CLASIFICACIÓN =================

            clasificacion_nombre = normalizar_texto(row["clasificacion"])

            clasificaciones = conn.execute(text("""
            SELECT id, nombre
            FROM clasificaciones
            """)).fetchall()

            clasificacion_id = None

            for c in clasificaciones:
                if normalizar_texto(c.nombre) == clasificacion_nombre:
                    clasificacion_id = c.id
                    break

            if not clasificacion_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"La clasificación '{row['clasificacion']}' no existe"
                )

            # ================= DIRECCIÓN =================

            direccion_row = conn.execute(text("""
                SELECT id
                FROM direcciones
                WHERE id = :direccion_id
            """), {"direccion_id": direccion_id}).fetchone()

            if not direccion_row:
                raise HTTPException(
                    status_code=400,
                    detail=f"La dirección '{direccion_id}' no existe"
                )

            direccion_id = direccion_row.id

            # ================= PROYECTO =================

            proyecto = None

            # 1️⃣ buscar por nombre
            proyecto = conn.execute(text("""
                SELECT id
                FROM proyectos
                WHERE nombre = :nombre
            """), {"nombre": nombre}).fetchone()

            # 2️⃣ si no existe por nombre, buscar por CUI
            if not proyecto and cui:

                proyecto = conn.execute(text("""
                    SELECT id
                    FROM proyectos
                    WHERE cui = :cui
                """), {"cui": cui}).fetchone()

            # 3️⃣ si existe proyecto → actualizar
            if proyecto:

                proyecto_id = proyecto.id

                conn.execute(text("""
                    UPDATE proyectos
                    SET
                        nombre = COALESCE(:nombre, nombre),
                        cui = COALESCE(:cui, cui),
                        codigo_dsp = COALESCE(:codigo_dsp, codigo_dsp),
                        ubicacion = COALESCE(:ubicacion, ubicacion),
                        tipologia = COALESCE(:tipologia, tipologia),
                        entidad_formuladora = COALESCE(:entidad_formuladora, entidad_formuladora)
                    WHERE id = :proyecto_id
                """), {
                    "proyecto_id": proyecto_id,
                    "nombre": nombre,
                    "cui": cui,
                    "codigo_dsp": codigo_dsp,
                    "ubicacion": ubicacion,
                    "tipologia": tipologia,
                    "entidad_formuladora": entidad_formuladora
                })

            # 4️⃣ si no existe → crear proyecto
            else:

                nuevo = conn.execute(text("""
                    INSERT INTO proyectos (
                        nombre,
                        cui,
                        codigo_dsp,
                        ubicacion,
                        tipologia,
                        entidad_formuladora
                    )
                    VALUES (
                        :nombre,
                        :cui,
                        :codigo_dsp,
                        :ubicacion,
                        :tipologia,
                        :entidad_formuladora
                    )
                    RETURNING id
                """), {
                    "nombre": nombre,
                    "cui": cui,
                    "codigo_dsp": codigo_dsp,
                    "ubicacion": ubicacion,
                    "tipologia": tipologia,
                    "entidad_formuladora": entidad_formuladora
                }).fetchone()

                proyecto_id = nuevo.id


            # ================= DATA EJECUCION =================

            conn.execute(text("""

            INSERT INTO data_ejecucion (

                proyecto_id,
                fecha_corte,
                avance_fisico_ejecutado,
                avance_presupuesto_ejecutado

            )

            VALUES (

                :proyecto_id,
                :fecha_corte,
                :avance_fisico,
                :avance_financiero

            )

            ON CONFLICT (proyecto_id, fecha_corte)
            DO UPDATE SET

            avance_fisico_ejecutado = EXCLUDED.avance_fisico_ejecutado,
            avance_presupuesto_ejecutado = EXCLUDED.avance_presupuesto_ejecutado

            """), {

                "proyecto_id": proyecto_id,
                "fecha_corte": fecha_corte,
                "avance_fisico": avance_fisico,
                "avance_financiero": avance_financiero

            })

            # ================= DATA PROGRAMADA =================

            conn.execute(text("""

            INSERT INTO data_programada (

                proyecto_id,
                fecha_corte,
                avance_fisico_programado

            )

            VALUES (

                :proyecto_id,
                :fecha_corte,
                :avance_programado

            )

            ON CONFLICT (proyecto_id, fecha_corte)
            DO UPDATE SET

            avance_fisico_programado = EXCLUDED.avance_fisico_programado

            """), {
                "proyecto_id": proyecto_id,
                "fecha_corte": fecha_corte,
                "avance_programado": avance_programado
            })


            # ================= VERSION =================

            version = conn.execute(text("""

            INSERT INTO proyecto_version (

                proyecto_id,
                fecha_corte,
                estado,
                fecha_inicio_programado,
                fecha_inicio_ejecutado,
                fecha_fin_programado,
                dependencias_externas,
                presupuesto_programado,
                proyecto_inversion,
                clasificacion_id,
                direccion_id,
                entidad_ejecutora,
                coordinador,
                correo,
                celular

            )

            VALUES (

                :proyecto_id,
                :fecha_corte,
                :estado,
                :fecha_inicio_programado,
                :fecha_inicio_ejecutado,
                :fecha_fin_programado,
                :dependencias_externas,
                :presupuesto_programado,
                :proyecto_inversion,
                :clasificacion_id,
                :direccion_id,
                :entidad_ejecutora,
                :coordinador,
                :correo,
                :celular

            )

            ON CONFLICT (proyecto_id, fecha_corte)
            DO UPDATE SET

            estado = EXCLUDED.estado,
            direccion_id = EXCLUDED.direccion_id,
            entidad_ejecutora = EXCLUDED.entidad_ejecutora,
            coordinador = EXCLUDED.coordinador,
            correo = EXCLUDED.correo,
            celular = EXCLUDED.celular

            RETURNING id

            """), {
                "proyecto_id": proyecto_id,
                "fecha_corte": fecha_corte,
                "estado": estado,
                "fecha_inicio_programado": pd.to_datetime(row["fecha_inicio_programado"]).date() if pd.notna(row["fecha_inicio_programado"]) else None,
                "fecha_inicio_ejecutado": pd.to_datetime(row["fecha_inicio_ejecutado"]).date() if pd.notna(row["fecha_inicio_ejecutado"]) else None,
                "fecha_fin_programado": pd.to_datetime(row["fecha_fin_programado"]).date() if pd.notna(row["fecha_fin_programado"]) else None,
                "dependencias_externas": dependencias_externas,
                "presupuesto_programado": presupuesto_programado,
                "proyecto_inversion": proyecto_inversion,
                "clasificacion_id": clasificacion_id,
                "direccion_id": direccion_id,
                "entidad_ejecutora": entidad_ejecutora,
                "coordinador": coordinador,
                "correo": correo,
                "celular": celular
            }).fetchone()


            version_id = version.id

            # ================= DEPENDENCIAS INTERNAS =================

            if dependencias_internas:

                conn.execute(text("""
                    DELETE FROM proyecto_dependencia_interna
                    WHERE proyecto_version_id = :version_id
                """), {"version_id": version_id})

                codigos = [c.strip() for c in dependencias_internas.split(";") if c.strip()]

                for codigo in codigos:

                    direccion_dep = conn.execute(text("""
                        SELECT id
                        FROM direcciones
                        WHERE codigo = :codigo
                    """), {"codigo": codigo}).fetchone()

                    if direccion_dep:
                        conn.execute(text("""
                            INSERT INTO proyecto_dependencia_interna (
                                proyecto_version_id,
                                direccion_id
                            )
                            VALUES (:version_id, :direccion_id)
                        """), {
                            "version_id": version_id,
                            "direccion_id": direccion_dep.id
                        })

            # ================= ARC DEL PROYECTO =================

            if "codigo_arc" in df.columns and pd.notna(row["codigo_arc"]):

                conn.execute(text("""

                    INSERT INTO proyecto_arc (

                        proyecto_id,
                        fecha_corte,
                        codigo_arc,
                        descripcion,
                        inicio_programado,
                        fin_programado,
                        inicio_ejecutado,
                        fin_ejecutado,
                        avance_percent

                    )

                    VALUES (

                        :proyecto_id,
                        :fecha_corte,
                        :codigo_arc,
                        :descripcion,
                        :inicio_programado,
                        :fin_programado,
                        :inicio_ejecutado,
                        :fin_ejecutado,
                        :avance_percent

                    )

                    ON CONFLICT (proyecto_id, fecha_corte, codigo_arc)
                    DO UPDATE SET

                    descripcion = EXCLUDED.descripcion,
                    inicio_programado = EXCLUDED.inicio_programado,
                    fin_programado = EXCLUDED.fin_programado,
                    inicio_ejecutado = EXCLUDED.inicio_ejecutado,
                    fin_ejecutado = EXCLUDED.fin_ejecutado,
                    avance_percent = EXCLUDED.avance_percent

                """), {

                    "proyecto_id": proyecto_id,
                    "fecha_corte": fecha_corte,

                    "codigo_arc": str(row["codigo_arc"]).strip(),

                    "descripcion": str(row["descripcion_arc"]).strip()
                        if "descripcion_arc" in df.columns and pd.notna(row["descripcion_arc"])
                        else None,

                    "inicio_programado":
                        pd.to_datetime(row["inicio_programado_arc"]).date()
                        if "inicio_programado_arc" in df.columns and pd.notna(row["inicio_programado_arc"])
                        else None,

                    "fin_programado":
                        pd.to_datetime(row["fin_programado_arc"]).date()
                        if "fin_programado_arc" in df.columns and pd.notna(row["fin_programado_arc"])
                        else None,

                    "inicio_ejecutado":
                        pd.to_datetime(row["inicio_ejecutado_arc"]).date()
                        if "inicio_ejecutado_arc" in df.columns and pd.notna(row["inicio_ejecutado_arc"])
                        else None,

                    "fin_ejecutado":
                        pd.to_datetime(row["fin_ejecutado_arc"]).date()
                        if "fin_ejecutado_arc" in df.columns and pd.notna(row["fin_ejecutado_arc"])
                        else None,

                    "avance_percent":
                        float(row["avance_arc"] or 0)
                        if "avance_arc" in df.columns
                        else 0

                })

    return {
        "mensaje": "Excel cargado correctamente",
        "filas_procesadas": len(df)
    }

@app.post("/admin/upload-arc")
def upload_arc(file: UploadFile = File(...)):

    df = pd.read_excel(file.file)

    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
    )

    columnas_obligatorias = [
        "nombre",
        "fecha_corte",
        "codigo_arc"
    ]

    faltantes = [c for c in columnas_obligatorias if c not in df.columns]

    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas: {faltantes}"
        )

    with engine.begin() as conn:

        for _, row in df.iterrows():

            proyecto = conn.execute(text("""
                SELECT id
                FROM proyectos
                WHERE nombre = :nombre
            """), {"nombre": row["nombre"]}).fetchone()

            if not proyecto:
                raise HTTPException(
                    status_code=400,
                    detail=f"Proyecto '{row['nombre']}' no existe"
                )

            proyecto_id = proyecto.id

            fecha_corte = pd.to_datetime(row["fecha_corte"]).date()

            descripcion = (
                str(row["descripcion_arc"]).strip()
                if "descripcion_arc" in df.columns and pd.notna(row["descripcion_arc"])
                else None
            )

            inicio_programado = (
                pd.to_datetime(row["inicio_programado_arc"]).date()
                if "inicio_programado_arc" in df.columns and pd.notna(row["inicio_programado_arc"])
                else None
            )

            fin_programado = (
                pd.to_datetime(row["fin_programado_arc"]).date()
                if "fin_programado_arc" in df.columns and pd.notna(row["fin_programado_arc"])
                else None
            )

            inicio_ejecutado = (
                pd.to_datetime(row["inicio_ejecutado_arc"]).date()
                if "inicio_ejecutado_arc" in df.columns and pd.notna(row["inicio_ejecutado_arc"])
                else None
            )

            fin_ejecutado = (
                pd.to_datetime(row["fin_ejecutado_arc"]).date()
                if "fin_ejecutado_arc" in df.columns and pd.notna(row["fin_ejecutado_arc"])
                else None
            )

            avance_percent = (
                float(row["avance_arc"] or 0)
                if "avance_arc" in df.columns
                else 0
            )

            conn.execute(text("""
            INSERT INTO proyecto_arc (
                proyecto_id,
                fecha_corte,
                codigo_arc,
                descripcion,
                inicio_programado,
                fin_programado,
                inicio_ejecutado,
                fin_ejecutado,
                avance_percent
            )
            VALUES (
                :proyecto_id,
                :fecha_corte,
                :codigo_arc,
                :descripcion,
                :inicio_programado,
                :fin_programado,
                :inicio_ejecutado,
                :fin_ejecutado,
                :avance_percent
            )
            ON CONFLICT (proyecto_id, fecha_corte, codigo_arc)
            DO UPDATE SET
                descripcion = EXCLUDED.descripcion,
                inicio_programado = EXCLUDED.inicio_programado,
                fin_programado = EXCLUDED.fin_programado,
                inicio_ejecutado = EXCLUDED.inicio_ejecutado,
                fin_ejecutado = EXCLUDED.fin_ejecutado,
                avance_percent = EXCLUDED.avance_percent
            """), {
                "proyecto_id": proyecto_id,
                "fecha_corte": fecha_corte,
                "codigo_arc": str(row["codigo_arc"]).strip(),
                "descripcion": descripcion,
                "inicio_programado": inicio_programado,
                "fin_programado": fin_programado,
                "inicio_ejecutado": inicio_ejecutado,
                "fin_ejecutado": fin_ejecutado,
                "avance_percent": avance_percent
            })
           
    return {
        "mensaje": "ARC cargados correctamente",
        "filas_procesadas": len(df)
    }

# =====================================================
# FECHAS DISPONIBLES DEL SISTEMA (CALENDARIO GLOBAL)
# =====================================================

@app.get("/api/fechas")
def obtener_fechas():

    with engine.connect() as conn:

        fechas = conn.execute(text("""
            SELECT DISTINCT fecha_corte
            FROM data_ejecucion
            ORDER BY fecha_corte
        """)).fetchall()

    return [
        f.fecha_corte.strftime("%Y-%m-%d")
        for f in fechas
    ]
