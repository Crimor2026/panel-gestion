# =====================================================
# IMPORTS
# =====================================================

import os
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Optional

import pandas as pd
import pytz

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

from dotenv import load_dotenv
load_dotenv()

def normalizar_texto(texto):

    if texto is None:
        return None

    texto = str(texto).strip().lower()

    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")

    return texto


def limpiar_numero(valor):

    if valor is None:
        return 0

    texto = str(valor).strip()

    if texto == "":
        return 0

    texto = texto.replace("S/","")
    texto = texto.replace("%","")
    texto = texto.replace(",", ".")
    texto = texto.replace(" ", "")

    try:
        return float(texto)
    except:
        return 0


def limpiar_fecha(valor):

    # Si viene vacío
    if valor is None:
        return None

    if valor == "":
        return None

    # Si pandas lo interpreta como NaT
    if pd.isna(valor):
        return None

    try:
        return pd.to_datetime(valor).date()
    except:
        return None

# =====================================================
# APP
# =====================================================

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../frontend"))

# ✅ AQUÍ VA (este bloque)
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR),
    name="static"
)

# =====================================================
# CREAR ADMIN AUTOMÁTICO
# =====================================================

def crear_admin():

    password_hash = pwd_context.hash("admin123")

    with engine.connect() as conn:

        existe = conn.execute(text("""
            SELECT id FROM usuarios WHERE email = :email
        """), {
            "email": "cmorales@atu.gob.pe"
        }).fetchone()

        if not existe:

            conn.execute(text("""
                INSERT INTO usuarios (
                    nombre,
                    email,
                    password_hash,
                    rol,
                    activo,
                    fecha_creacion
                )
                VALUES (
                    :nombre,
                    :email,
                    :password_hash,
                    :rol,
                    true,
                    NOW()
                )
            """), {
                "nombre": "Cristhian Morales",
                "email": "cmorales@atu.gob.pe",
                "password_hash": password_hash,
                "rol": "admin"
            })

            conn.commit()


@app.on_event("startup")
def startup_event():
    crear_admin()

# =====================================================
# RUTAS
# =====================================================

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

    try:

        fecha_corte = None
        if fecha:
            fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()

        with engine.connect() as conn:

            # ================= KPIs =================
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
                        AND (:fecha IS NULL OR pv2.fecha_corte = :fecha)
                        ORDER BY pv2.fecha_corte DESC
                        LIMIT 1
                    ) pv ON true
                """),
                {"fecha": fecha_corte}
            ).fetchone()

            # ================= ESTADOS =================
            estados = conn.execute(
                text("""
                    SELECT pv.estado, COUNT(*) as cantidad
                    FROM proyectos p
                    JOIN LATERAL (
                        SELECT *
                        FROM proyecto_version pv2
                        WHERE pv2.proyecto_id = p.id
                        AND (:fecha IS NULL OR pv2.fecha_corte = :fecha)
                        ORDER BY pv2.fecha_corte DESC
                        LIMIT 1
                    ) pv ON true
                    GROUP BY pv.estado
                """),
                {"fecha": fecha_corte}
            ).fetchall()

            # ================= DEPENDENCIAS EXTERNAS =================
            dependencias = conn.execute(text("""
                SELECT 
                    CASE 
                        WHEN pv.dependencias_externas IS NULL 
                            OR TRIM(pv.dependencias_externas) = '' 
                            OR LOWER(TRIM(pv.dependencias_externas)) IN ('ninguna', 'sin dependencia', 'undefined', 'null')
                        THEN 'SIN DEPENDENCIA'
                        ELSE UPPER(TRIM(pv.dependencias_externas))
                    END AS dependencia,
                    COUNT(*) as cantidad
                FROM proyectos p
                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (
                        pv2.fecha_corte <= :fecha
                        OR :fecha IS NULL
                    )
                    ORDER BY pv2.fecha_corte DESC
                    LIMIT 1
                ) pv ON true
                GROUP BY dependencia
                ORDER BY cantidad DESC
            """), {
                "fecha": fecha_corte
            }).fetchall()

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
                    AND (:fecha IS NULL OR pv2.fecha_corte = :fecha)
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
            "kpis": dict(kpis._mapping) if kpis else {
                "total": 0,
                "en_ejecucion": 0,
                "paralizado": 0,
                "sin_iniciar": 0,
                "concluido": 0
            },
            "estados": [dict(r._mapping) for r in estados],
            "dependencias": [dict(r._mapping) for r in dependencias],
            "direcciones_total": [dict(r._mapping) for r in direcciones_total],
            "direcciones_filtradas": [dict(r._mapping) for r in direcciones_filtradas]
        }

    except Exception as e:
        print("ERROR dashboard_global:", str(e))

        return {
            "kpis": {
                "total": 0,
                "en_ejecucion": 0,
                "paralizado": 0,
                "sin_iniciar": 0,
                "concluido": 0
            },
            "estados": [],
            "dependencias": [],
            "direcciones_total": [],
            "direcciones_filtradas": []
        }

# =====================================================
# DASHBOARD POR DIRECCIÓN
# =====================================================

@app.get("/api/dashboard/direccion/{direccion_id}")
def dashboard_por_direccion(direccion_id: int, fecha: Optional[str] = None):

    try:

        fecha_corte = None
        if fecha:
            fecha_corte = datetime.strptime(fecha, "%Y-%m-%d").date()

        with engine.connect() as conn:

            # ================= ESTADOS =================
            estados = conn.execute(text("""
                SELECT pv.estado, COUNT(*) as cantidad
                FROM proyectos p
                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (:fecha IS NULL OR pv2.fecha_corte = :fecha)
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
                    CASE 
                        WHEN d.codigo IS NULL THEN 'SIN DEPENDENCIA'
                        ELSE UPPER(TRIM(d.codigo))
                    END AS dependencia,
                    COUNT(*) as cantidad
                FROM proyectos p
                JOIN LATERAL (
                    SELECT *
                    FROM proyecto_version pv2
                    WHERE pv2.proyecto_id = p.id
                    AND (
                        pv2.fecha_corte <= :fecha
                        OR :fecha IS NULL
                    )
                    ORDER BY pv2.fecha_corte DESC
                    LIMIT 1
                ) pv ON true
                LEFT JOIN proyecto_dependencia_interna pdi
                    ON pdi.proyecto_version_id = pv.id
                LEFT JOIN direcciones d
                    ON d.id = pdi.direccion_id
                WHERE pv.direccion_id = :direccion_id   -- 🔥 CLAVE
                GROUP BY dependencia
                ORDER BY cantidad DESC
            """), {
                "fecha": fecha_corte,
                "direccion_id": direccion_id
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
                    AND (:fecha IS NULL OR pv2.fecha_corte = :fecha)
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

    except Exception as e:
        print("ERROR dashboard_direccion:", str(e))
        return {"error": str(e)}
    
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
        SELECT
            codigo_arc,
            descripcion,
            inicio_programado,
            fin_programado,
            inicio_ejecutado,
            fin_ejecutado,
            avance_percent
        FROM proyecto_arc
        WHERE proyecto_id = :id
        AND fecha_corte = :fecha
        ORDER BY codigo_arc
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

    import math

    arcs = []

    for r in arc_rows:

        avance = 0

        try:
            if r.avance_percent is not None and not math.isnan(float(r.avance_percent)):
                avance = float(r.avance_percent)
        except:
            avance = 0

        arcs.append({
            "codigo": r.codigo_arc,
            "descripcion": r.descripcion,
            "inicio_programado": str(r.inicio_programado) if r.inicio_programado else None,
            "fin_programado": str(r.fin_programado) if r.fin_programado else None,
            "inicio_ejecutado": str(r.inicio_ejecutado) if r.inicio_ejecutado else None,
            "fin_ejecutado": str(r.fin_ejecutado) if r.fin_ejecutado else None,
            "avance": avance
        })

    # ARC actual según fecha

    arc_actual = None

    for r in arc_rows:
        if r.inicio_programado and r.fin_programado:
            if r.inicio_programado <= fecha_corte <= r.fin_programado:
                arc_actual = r.codigo_arc
                break

    # si ninguno está activo, mostrar el primero programado
    if arc_actual is None and arc_rows:
        arc_actual = arc_rows[0].codigo_arc

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
        "presupuesto_programado": float(version.presupuesto_programado) if version and version.presupuesto_programado else 0,

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

@app.post("/login")
def login(data: LoginRequest):

    email = data.email.lower().strip()

    with engine.connect() as connection:
        result = connection.execute(
            text("""
            SELECT id, email, password_hash, rol, nombre, ultima_conexion
            FROM usuarios
            WHERE email = :email AND activo = true
            """),
            {"email": email}
        ).mappings().fetchone()

    if result is None:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")

    password_hash = result["password_hash"]

    if not pwd_context.verify(data.password, password_hash):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")

    # 🔥 función hora Perú
    def obtener_fecha_lima():
        import pytz
        lima = pytz.timezone("America/Lima")
        return datetime.now(lima)

    ultima_conexion = result["ultima_conexion"]

    # 🔥 nueva hora en Perú
    ahora = obtener_fecha_lima()

    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE usuarios
            SET ultima_conexion = :fecha
            WHERE id = :id
        """), {
            "id": result["id"],
            "fecha": ahora
        })
        conn.commit()

    # 🔥 token SIEMPRE en UTC (IMPORTANTE)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    token = jwt.encode(
        {
            "sub": email,
            "rol": result["rol"],
            "exp": expire
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "rol": result["rol"],
        "nombre": result["nombre"],
        "email": result["email"],  # 🔥 IMPORTANTE para frontend
        "ultima_conexion": (
            ultima_conexion.strftime("%d/%m/%Y %I:%M %p")
            if ultima_conexion else None
        )
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
        email = payload.get("sub").lower().strip()

        with engine.connect() as connection:
            user = connection.execute(
                text("""
                    SELECT *
                    FROM usuarios
                    WHERE email = :email AND activo = true
                """),
                {"email": email}
            ).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return user

    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# =====================================================
# JERARQUÍA DE ROLES
# =====================================================

JERARQUIA = {
    "admin": 3,
    "coordinador": 2,
    "especialista": 1,
    "visor": 0
}

def requiere_rol(nivel_requerido):
    def wrapper(user = Depends(obtener_usuario_actual)):
        if JERARQUIA.get(user.rol, 0) < JERARQUIA[nivel_requerido]:
            raise HTTPException(status_code=403, detail="No autorizado")
        return user
    return wrapper

# =====================================================
# SOLO ADMIN
# =====================================================

def solo_admin(user = Depends(requiere_rol("admin"))):
    return user

# =====================================================
# CREAR USUARIO (ADMIN)
# =====================================================

@app.post("/admin/crear-usuario")
def crear_usuario(data: dict, user=Depends(solo_admin)):

    nombre = data.get("nombre")
    email = data.get("email").lower().strip()
    password = data.get("password")
    rol = data.get("rol", "usuario")

    if not nombre or not email or not password:
        raise HTTPException(status_code=400, detail="Faltan datos")

    password_hash = pwd_context.hash(password)

    with engine.connect() as conn:

        existe = conn.execute(text("""
            SELECT id FROM usuarios WHERE email = :email
        """), {"email": email}).fetchone()

        if existe:
            raise HTTPException(status_code=400, detail="El usuario ya existe")

        conn.execute(text("""
            INSERT INTO usuarios (
                nombre,
                email,
                password_hash,
                rol,
                activo,
                fecha_creacion
            )
            VALUES (
                :nombre,
                :email,
                :password_hash,
                :rol,
                true,
                NOW()
            )
        """), {
            "nombre": nombre,
            "email": email,
            "password_hash": password_hash,
            "rol": rol
        })

        conn.commit()

    return {"mensaje": "Usuario creado correctamente"}
    
# =====================================================
# SUBIR EXCEL (ADMIN)
# =====================================================

print("UPLOAD_EXCEL VERSION NUEVA")

@app.post("/admin/upload-excel")
def upload_excel(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .xlsx")

    try:
        df = pd.read_excel(file.file)
        df = df.fillna("")
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
        "clasificacion"
    ]

    faltantes = [c for c in columnas_obligatorias if c not in df.columns]

    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas en el Excel: {faltantes}"
        )

    with engine.connect() as conn:

        for _, row in df.iterrows():

            try:

                # ================= CAMPOS BÁSICOS =================

                nombre_original = " ".join(str(row.get("nombre")).strip().split()) if row.get("nombre") else None
                nombre_normalizado = normalizar_texto(nombre_original)

                direccion_id = int(row.get("direccion_id")) if row.get("direccion_id") else None

                if not direccion_id:
                    print(f"Fila ignorada (sin direccion_id): {nombre_original}")
                    continue

                fecha_corte = pd.to_datetime(row.get("fecha_corte")).date()

                avance_fisico = limpiar_numero(row.get("avance_fisico"))
                avance_financiero = limpiar_numero(row.get("avance_financiero"))
                avance_programado = limpiar_numero(row.get("avance_programado"))
                presupuesto_programado = limpiar_numero(row.get("presupuesto_programado"))

                estado = str(row.get("estado")).strip() if row.get("estado") else None

                dependencias_externas = str(row.get("dependencias_externas")).strip() if row.get("dependencias_externas") else None
                dependencias_internas = str(row.get("dependencias_internas")).strip() if row.get("dependencias_internas") else None
                
                # ================= IDENTIFICACIÓN =================

                cui = str(row.get("cui")).strip() if row.get("cui") else None
                codigo_dsp = str(row.get("codigo_dsp")).strip() if row.get("codigo_dsp") else None
                ubicacion = str(row.get("ubicacion")).strip() if row.get("ubicacion") else None
                tipologia = str(row.get("tipologia")).strip() if row.get("tipologia") else None
                entidad_ejecutora = str(row.get("entidad_ejecutora")).strip() if row.get("entidad_ejecutora") else None
                entidad_formuladora = str(row.get("entidad_formuladora")).strip() if row.get("entidad_formuladora") else None
                coordinador = str(row.get("coordinador")).strip() if row.get("coordinador") else None
                correo = str(row.get("correo")).strip() if row.get("correo") else None
                celular = str(row.get("celular")).strip() if row.get("celular") else None
                
                # ================= PROYECTO INVERSIÓN =================

                valor = str(row.get("proyecto_inversion", "")).strip().lower()

                if valor in ["true", "1", "si", "sí"]:
                    proyecto_inversion = True
                elif valor in ["false", "0", "no"]:
                    proyecto_inversion = False
                else:
                    proyecto_inversion = None


                # ================= CLASIFICACIÓN =================

                clasificacion_id = None

                if row.get("clasificacion"):

                    clasificacion_id = conn.execute(text("""
                        SELECT id
                        FROM clasificaciones
                        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre))
                    """), {
                        "nombre": row.get("clasificacion")
                    }).scalar()

                    if not clasificacion_id:
                        print(f"Clasificación no encontrada: {row.get('clasificacion')}")
                        clasificacion_id = None


                # ================= DIRECCIÓN =================

                direccion_row = conn.execute(text("""
                    SELECT id
                    FROM direcciones
                    WHERE id = :direccion_id
                """), {
                    "direccion_id": direccion_id
                }).fetchone()

                if not direccion_row:

                    print(f"Dirección no existe: {direccion_id}")

                    # no detener carga
                    direccion_id = None

                else:

                    direccion_id = direccion_row.id


                    # ================= PROYECTO =================

                    proyecto = conn.execute(text("""
                        SELECT id
                        FROM proyectos
                        WHERE LOWER(TRIM(unaccent(nombre))) = :nombre
                        AND direccion_id = :direccion_id
                    """), {
                        "nombre": nombre_normalizado,
                        "direccion_id": direccion_id
                    }).fetchone()

                    if proyecto:

                        proyecto_id = proyecto.id

                        conn.execute(text("""
                            UPDATE proyectos
                            SET
                                cui = :cui,
                                codigo_dsp = :codigo_dsp,
                                ubicacion = :ubicacion,
                                tipologia = :tipologia,
                                entidad_formuladora = :entidad_formuladora
                            WHERE id = :id
                        """), {
                            "id": proyecto_id,
                            "cui": cui,
                            "codigo_dsp": codigo_dsp,
                            "ubicacion": ubicacion,
                            "tipologia": tipologia,
                            "entidad_formuladora": entidad_formuladora
                        })

                    else:

                        nuevo = conn.execute(text("""
                            INSERT INTO proyectos (nombre, direccion_id)
                            VALUES (:nombre, :direccion_id)
                            RETURNING id
                        """), {
                            "nombre": nombre_original,
                            "direccion_id": direccion_id
                        }).fetchone()

                        proyecto_id = nuevo.id


                    # ================= VERSION (SIEMPRE) =================

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
                        "fecha_inicio_programado": limpiar_fecha(row.get("fecha_inicio_programado")),
                        "fecha_inicio_ejecutado": limpiar_fecha(row.get("fecha_inicio_ejecutado")),
                        "fecha_fin_programado": limpiar_fecha(row.get("fecha_fin_programado")),
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

                    # ================= DATA EJECUCIÓN =================

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
                        "fecha_inicio_programado": limpiar_fecha(row.get("fecha_inicio_programado")),
                        "fecha_inicio_ejecutado": limpiar_fecha(row.get("fecha_inicio_ejecutado")),
                        "fecha_fin_programado": limpiar_fecha(row.get("fecha_fin_programado")),
                        "dependencias_externas": dependencias_externas,
                        "presupuesto_programado": presupuesto_programado,
                        "proyecto_inversion": proyecto_inversion,
                        "clasificacion_id": clasificacion_id,
                        "direccion_id": direccion_id,
                        "entidad_ejecutora": row.get("entidad_ejecutora"),
                        "coordinador": row.get("coordinador"),
                        "correo": row.get("correo"),
                        "celular": row.get("celular")
                    }).fetchone()

                    version_id = version.id


                    conn.commit()

            except Exception as e:

                import traceback
                traceback.print_exc()

                print(f"Error en proyecto {row.get('nombre')} -> {e}")

                conn.rollback()

                continue

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

            conn.commit()

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
        "direccion_id",
        "fecha_corte",
        "codigo_arc"
    ]

    faltantes = [c for c in columnas_obligatorias if c not in df.columns]

    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas: {faltantes}"
        )

    with engine.connect() as conn:

        for _, row in df.iterrows():

            try:

                # ================= NOMBRE =================

                nombre_original = " ".join(str(row.get("nombre")).strip().split())
                nombre_normalizado = normalizar_texto(nombre_original)

                direccion_id = int(row.get("direccion_id")) if row.get("direccion_id") else None

                if not direccion_id:
                    print(f"Fila ignorada (sin direccion_id): {nombre_original}")
                    continue


                # ================= VALIDAR DIRECCION =================

                direccion_row = conn.execute(text("""
                    SELECT id
                    FROM direcciones
                    WHERE id = :direccion_id
                """), {
                    "direccion_id": direccion_id
                }).fetchone()

                if not direccion_row:

                    print(f"Dirección no existe: {direccion_id}")
                    continue

                direccion_id = direccion_row.id


                # ================= BUSCAR PROYECTO =================

                proyecto = conn.execute(text("""
                    SELECT id
                    FROM proyectos
                    WHERE LOWER(TRIM(unaccent(nombre))) = :nombre
                    AND direccion_id = :direccion_id
                """), {
                    "nombre": nombre_normalizado,
                    "direccion_id": direccion_id
                }).fetchone()

                if not proyecto:

                    print(f"Proyecto no encontrado: {nombre_original}")
                    continue

                proyecto_id = proyecto.id


                # ================= FECHA =================

                fecha_corte = pd.to_datetime(row["fecha_corte"]).date()


                # ================= CAMPOS ARC =================

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


                # ================= INSERT ARC =================

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

                conn.commit()

            except Exception as e:

                import traceback
                traceback.print_exc()

                print(f"Error ARC proyecto {row.get('nombre')} -> {e}")

                conn.rollback()

                continue

    return {
        "mensaje": "ARC cargados correctamente",
        "filas_procesadas": len(df)
    }

# =====================================================
# FECHAS DISPONIBLES DEL SISTEMA (CALENDARIO GLOBAL)
# =====================================================

@app.get("/api/fechas")
def obtener_fechas():

    try:
        with engine.connect() as conn:

            fechas = conn.execute(text("""
                SELECT DISTINCT fecha_corte
                FROM public.data_ejecucion
                WHERE fecha_corte IS NOT NULL
                ORDER BY fecha_corte
            """)).fetchall()

        return [
            f.fecha_corte.strftime("%Y-%m-%d")
            for f in fechas
        ]

    except Exception as e:
        print("ERROR /api/fechas:", str(e))
        return {
            "error": str(e)
        }

# =====================================================
# CAMBIAR CONTRASEÑA
# =====================================================

@app.post("/api/cambiar-password")
def cambiar_password(
    data: dict,
    user = Depends(obtener_usuario_actual)
):
    password_actual = data.get("password_actual")
    password_nueva = data.get("password_nueva")

    if not password_actual or not password_nueva:
        raise HTTPException(status_code=400, detail="Faltan datos")

    if not pwd_context.verify(password_actual, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")

    nueva_hash = pwd_context.hash(password_nueva)

    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE usuarios
            SET password_hash = :hash
            WHERE id = :id
        """), {
            "hash": nueva_hash,
            "id": user.id
        })
        conn.commit()

    return {"mensaje": "Contraseña actualizada"}


# =====================================================
# IA - AURA
# =====================================================

router = APIRouter(
    prefix="/api/ia",
    tags=["IA - Aura"]
)


class Pregunta(BaseModel):
    pregunta: str
    data: dict | None = None


@router.post("")
async def consultar_ia(req: Pregunta):

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return {"respuesta": "Error: API key no configurada"}

    prompt = f"""
Eres Aura, asistente de proyectos de transporte urbano (ATU).

Usa estos datos si ayudan:
{req.data}

Responde claro, breve y profesional:
{req.pregunta}
"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {"role": "system", "content": "Eres Aura, asistente profesional."},
                    {"role": "user", "content": prompt}
                ]
            }
        )

        if response.status_code != 200:
            return {
                "respuesta": f"Error IA ({response.status_code})"
            }

        data = response.json()

        return {
            "respuesta": data["choices"][0]["message"]["content"]
        }

    except Exception as e:
        return {
            "respuesta": f"Error IA: {str(e)}"
        }


# =====================================================
# ACTIVAR RUTER IA
# =====================================================

app.include_router(router)