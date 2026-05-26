# =====================================================
# IMPORTS
# =====================================================

import os
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Optional

import pandas as pd
import pdfkit
import pytz
import requests

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, APIRouter, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import text
from fastapi.responses import FileResponse

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

    # 🔥 1. VACÍOS REALES
    if valor is None or valor == "":
        return None

    try:
        import pandas as pd

        # 🔥 2. CONVERTIR
        fecha = pd.to_datetime(valor, errors="coerce")

        # 🔥 3. INVALIDOS → NULL
        if pd.isna(fecha):
            return None

        fecha = fecha.date()

        # 🔥 4. FILTRO ANTI BASURA (CLAVE 🔥)
        if fecha.year < 2000:
            return None

        return fecha

    except:
        return None

# =====================================================
# SEGURIDAD
# =====================================================

SECRET_KEY = os.getenv("SECRET_KEY", "CLAVE_LOCAL_TEMPORAL")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# =====================================================
# APP
# =====================================================

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

# =====================================================
# RUTAS BASE
# =====================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../frontend"))

# =====================================================
# STATIC (CSS, JS, IMG)
# =====================================================

app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR),
    name="static"
)

app.mount(
    "/frontend",
    StaticFiles(directory="frontend"),
    name="frontend"
)

# =====================================================
# REPORTES (DINÁMICO)
# =====================================================

@app.get("/reportes/{tipo}")
def ver_reporte(tipo: str):

    rutas = {
        "A": "reporteA.html",
        "B": "reporteB.html",
        "C": "reporteC.html",
        "D": "reporteD.html",
        "E": "reporteE.html",
        "F": "reporteF.html",
        "TEMA": "reportextema.html",
        "LLENADO": "llenado.html"
    }

    archivo = rutas.get(tipo)

    if not archivo:
        return {"error": f"No existe el reporte: {tipo}"}

    ruta = os.path.join(FRONTEND_DIR, f"reportes/{archivo}")

    return FileResponse(ruta)

# =====================================================
# LANDING REPORTES (opcional)
# =====================================================

@app.get("/reportes")
def landing_reportes():
    ruta = os.path.join(FRONTEND_DIR, "reportes/reportes.html")
    return FileResponse(ruta)

# =====================================================
# INFORME TEMÁTICO
# =====================================================

@app.get("/reportextema")
def reportextema():

    return FileResponse(
        os.path.join(
            FRONTEND_DIR,
            "reportextema/reportextema.html"
        )
    )

# =====================================================
# TABLERO - FLUJOGRAMA
# =====================================================

import os
from fastapi.responses import FileResponse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/tablero")
def tablero():
    return FileResponse(os.path.join(FRONTEND_DIR, "tablero/tablero.html"))

@app.get("/pdf-tablero")
def generar_pdf_tablero():

    ruta_html = os.path.join(FRONTEND_DIR, "tablero/tablero.html")

    output_pdf = "tablero.pdf"

    config = pdfkit.configuration(wkhtmltopdf="/usr/bin/wkhtmltopdf")

    pdfkit.from_file(ruta_html, output_pdf, configuration=config)

    return FileResponse(output_pdf, media_type="application/pdf", filename="tablero.pdf")

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
            kpis = conn.execute(text("""
                SELECT 
                    COUNT(*) AS total,

                    COUNT(*) FILTER (WHERE LOWER(fl.estado) LIKE '%ejec%') AS en_ejecucion,
                    COUNT(*) FILTER (WHERE LOWER(fl.estado) LIKE '%paraliz%') AS paralizado,
                    COUNT(*) FILTER (WHERE LOWER(fl.estado) LIKE '%sin%') AS sin_iniciar,
                    COUNT(*) FILTER (WHERE LOWER(fl.estado) LIKE '%conclu%') AS concluido

                FROM (

                    SELECT DISTINCT ON (proyecto_id)
                        proyecto_id,
                        estado
                    FROM ficha_llenado
                    WHERE (:fecha IS NULL OR fecha_corte = :fecha)
                    ORDER BY proyecto_id, fecha_corte DESC

                ) fl;
            """), {"fecha": fecha_corte}).fetchone()


            # ================= ESTADOS =================
            estados = conn.execute(text("""
                SELECT estado, COUNT(*) as cantidad
                FROM (
                    SELECT DISTINCT ON (proyecto_id)
                        proyecto_id,
                        estado
                    FROM ficha_llenado
                    WHERE (:fecha IS NULL OR fecha_corte = :fecha)
                    ORDER BY proyecto_id, fecha_corte DESC
                ) t
                GROUP BY estado
                ORDER BY cantidad DESC
            """), {"fecha": fecha_corte}).fetchall()


            # ================= DEPENDENCIAS =================
            dependencias = conn.execute(text("""
                SELECT 
                    CASE 
                        WHEN fl.dependencias_externas IS NULL 
                            OR TRIM(fl.dependencias_externas) = '' 
                        THEN 'SIN DEPENDENCIA'
                        ELSE UPPER(TRIM(fl.dependencias_externas))
                    END AS dependencia,

                    COUNT(fl.id) as cantidad

                FROM proyectos p

                LEFT JOIN LATERAL (
                    SELECT *
                    FROM ficha_llenado fl2
                    WHERE fl2.proyecto_id = p.id
                    AND (
                        fl2.fecha_corte <= :fecha OR :fecha IS NULL
                    )
                    ORDER BY fl2.fecha_corte DESC
                    LIMIT 1
                ) fl ON true

                -- 🔥 CLAVE
                WHERE fl.id IS NOT NULL

                GROUP BY dependencia
            """), {"fecha": fecha_corte}).fetchall()


            # ================= DIRECCIONES =================
            direcciones_total = conn.execute(text("""
                SELECT 
                    d.id,
                    d.nombre AS direccion,
                    COUNT(*) as cantidad
                FROM proyectos p
                LEFT JOIN LATERAL (
                    SELECT *
                    FROM ficha_llenado fl2
                    WHERE fl2.proyecto_id = p.id
                    AND (:fecha IS NULL OR fl2.fecha_corte = :fecha)
                    ORDER BY fl2.fecha_corte DESC
                    LIMIT 1
                ) fl ON true
                JOIN direcciones d ON d.id = fl.direccion_id
                GROUP BY d.id, d.nombre
            """), {"fecha": fecha_corte}).fetchall()


            # ================= DIRECCIONES FILTRADAS =================
            direcciones_filtradas = conn.execute(text("""
                SELECT 
                    d.id,
                    d.nombre AS direccion,
                    COUNT(*) as cantidad
                FROM ficha_llenado fl
                JOIN direcciones d ON d.id = fl.direccion_id
                WHERE (:fecha IS NULL OR fl.fecha_corte = :fecha)
                GROUP BY d.id, d.nombre
            """), {"fecha": fecha_corte}).fetchall()


            # ================= PROYECTOS =================
            proyectos = conn.execute(text("""
                SELECT p.nombre, fl.estado
                FROM proyectos p
                LEFT JOIN LATERAL (
                    SELECT *
                    FROM ficha_llenado fl2
                    WHERE fl2.proyecto_id = p.id
                    AND (:fecha IS NULL OR fl2.fecha_corte = :fecha)
                    ORDER BY fl2.fecha_corte DESC
                    LIMIT 1
                ) fl ON true
                ORDER BY p.nombre
            """), {"fecha": fecha_corte}).fetchall()


            return {
                "kpis": dict(kpis._mapping) if kpis else {},
                "estados": [dict(r._mapping) for r in estados],
                "dependencias": [dict(r._mapping) for r in dependencias],
                "direcciones_total": [dict(r._mapping) for r in direcciones_total],
                "direcciones_filtradas": [dict(r._mapping) for r in direcciones_filtradas],
                "proyectos": [dict(r._mapping) for r in proyectos]
            }

    except Exception as e:
        print("ERROR dashboard_global:", str(e))
        return {"error": str(e)}

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
                SELECT estado, COUNT(*) as cantidad
                FROM (
                    SELECT DISTINCT ON (proyecto_id)
                        proyecto_id,
                        estado
                    FROM ficha_llenado
                    WHERE fecha_corte = :fecha
                    AND direccion_id = :direccion_id
                    ORDER BY proyecto_id, fecha_corte DESC
                ) t
                GROUP BY estado
            """), {
                "direccion_id": direccion_id,
                "fecha": fecha_corte
            }).fetchall()

            # ================= DEPENDENCIAS INTERNAS =================
            dependencias = conn.execute(text("""
                SELECT 
                    CASE 
                        WHEN dependencias_externas IS NULL 
                            OR TRIM(dependencias_externas) = '' 
                        THEN 'SIN DEPENDENCIA'
                        ELSE UPPER(TRIM(dependencias_externas))
                    END AS dependencia,
                    COUNT(*) as cantidad
                FROM (
                    SELECT DISTINCT ON (proyecto_id)
                        proyecto_id,
                        dependencias_externas
                    FROM ficha_llenado
                    WHERE fecha_corte = :fecha
                    AND direccion_id = :direccion_id
                    ORDER BY proyecto_id, fecha_corte DESC
                ) t
                GROUP BY dependencia
                ORDER BY cantidad DESC
            """), {
                "direccion_id": direccion_id,
                "fecha": fecha_corte
            }).fetchall()


            # ================= CLASIFICACIÓN =================
            clasificacion = conn.execute(text("""
                SELECT 
                    COALESCE(c.nombre, 'SIN CLASIFICACION') AS clasificacion,
                    COUNT(*) as cantidad
                FROM (
                    SELECT DISTINCT ON (proyecto_id)
                        proyecto_id,
                        clasificacion_id
                    FROM ficha_llenado
                    WHERE fecha_corte = :fecha
                    AND direccion_id = :direccion_id
                    ORDER BY proyecto_id, fecha_corte DESC
                ) fl

                LEFT JOIN clasificaciones c
                    ON c.id = fl.clasificacion_id

                GROUP BY clasificacion
                ORDER BY clasificacion
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

        LEFT JOIN LATERAL (
            SELECT *
            FROM ficha_llenado fl
            WHERE fl.proyecto_id = p.id
            AND (:fecha IS NULL OR fl.fecha_corte = :fecha)
            ORDER BY fl.fecha_corte DESC
            LIMIT 1
        ) fl ON true

        WHERE COALESCE(fl.direccion_id, p.direccion_id) = :direccion_id
        AND (:clasificacion_id IS NULL OR fl.clasificacion_id = :clasificacion_id)

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
        FROM ficha_llenado
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
                spi,
                avance_percent,
                fecha_corte
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
            "spi": r.spi,
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
        "spi": float(version.spi) if version and version.spi is not None else None,

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


class TabRequest(BaseModel):

    id: str
    nombre: str
    proyecto_id: int

@app.post("/api/tablero/tab")
def guardar_tab(tab: TabRequest):

    with engine.begin() as conn:

        conn.execute(text("""

            INSERT INTO tabs (
                id,
                nombre,
                proyecto_id
            )
            VALUES (
                :id,
                :nombre,
                :proyecto_id
            )

            ON CONFLICT (id)
            DO UPDATE SET

                nombre = EXCLUDED.nombre,
                proyecto_id = EXCLUDED.proyecto_id

        """), {

            "id": tab.id,
            "nombre": tab.nombre,
            "proyecto_id": tab.proyecto_id

        })

    return {
        "ok": True
    }

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
        "email": result["email"],  # 🔥 importante para frontend
        "ultima_conexion": (
            ultima_conexion.isoformat() if ultima_conexion else None
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

                # ================= NOMBRE =================

                nombre_original = " ".join(str(row.get("nombre")).strip().split())

                if not nombre_original:
                    print("Fila ignorada (sin nombre)")
                    continue

                nombre_normalizado = normalizar_texto(nombre_original)


                # ================= DIRECCIÓN =================

                raw_dir = row.get("direccion_id")

                # 🔥 detectar vacío real (incluye NaN)
                if pd.isna(raw_dir) or str(raw_dir).strip() == "":
                    print(f"Fila ignorada (direccion_id vacío): {nombre_original}")
                    continue

                try:
                    direccion_id = int(float(raw_dir))  # 🔥 convierte 11.0 → 11
                except:
                    print(f"ERROR direccion_id inválido: {raw_dir} - {nombre_original}")
                    continue

                # ================= FECHA =================
                try:
                    fecha_corte = pd.to_datetime(row.get("fecha_corte")).date()
                except:
                    fecha_corte = None

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

                valor_clas = row.get("clasificacion")

                if valor_clas:

                    valor_clas = " ".join(str(valor_clas).strip().split())
                    valor_normalizado = normalizar_texto(valor_clas)

                    clasificacion_id = conn.execute(text("""
                        SELECT id
                        FROM clasificaciones
                        WHERE LOWER(TRIM(unaccent(nombre))) = :nombre
                    """), {
                        "nombre": valor_normalizado
                    }).scalar()

                    # 🔥 SI NO EXISTE → CREAR
                    if not clasificacion_id:

                        print(f"⚠️ Creando clasificación nueva: {valor_clas}")

                        nueva = conn.execute(text("""
                            INSERT INTO clasificaciones (nombre)
                            VALUES (:nombre)
                            RETURNING id
                        """), {
                            "nombre": valor_clas
                        }).fetchone()

                        clasificacion_id = nueva.id

                # ================= DIRECCIÓN =================

                    direccion_row = conn.execute(text("""
                        SELECT id
                        FROM direcciones
                        WHERE id = :direccion_id
                    """), {
                        "direccion_id": direccion_id
                    }).fetchone()

                    if not direccion_row:
                        print(f"Dirección no existe: {direccion_id} - {nombre_original}")
                        continue  # 🔥 CORTA AQUÍ

                    # 🔥 si pasa, ya es válido
                    direccion_id = direccion_row.id

                    # ================= PROYECTO (MATCH POR SIMILITUD) =================

                    import difflib

                    proyectos = conn.execute(text("""
                        SELECT id, nombre
                        FROM proyectos
                        WHERE direccion_id = :direccion_id
                    """), {
                        "direccion_id": direccion_id
                    }).fetchall()

                    proyecto = None
                    mejor_score = 0

                    for p in proyectos:
                        nombre_bd = normalizar_texto(p.nombre)

                        score = difflib.SequenceMatcher(None, nombre_bd, nombre_normalizado).ratio()

                        if score > mejor_score:
                            mejor_score = score
                            proyecto = p

                    # 🔥 UMBRAL DE SEGURIDAD
                    if mejor_score > 0.75:
                        proyecto_id = proyecto.id
                    else:
                        proyecto = None

                    if proyecto:

                        proyecto_id = proyecto.id

                        # 🔥 VALIDAR CUI (NO DUPLICAR)
                        if cui:
                            existe = conn.execute(text("""
                                SELECT id FROM proyectos WHERE cui = :cui
                            """), {"cui": cui}).fetchone()

                            if not existe or existe.id == proyecto_id:
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
                                print(f"CUI duplicado ignorado: {cui}")

                        else:
                            # 🔥 SI NO HAY CUI, IGUAL ACTUALIZA LO DEMÁS
                            conn.execute(text("""
                                UPDATE proyectos
                                SET
                                    codigo_dsp = :codigo_dsp,
                                    ubicacion = :ubicacion,
                                    tipologia = :tipologia,
                                    entidad_formuladora = :entidad_formuladora
                                WHERE id = :id
                            """), {
                                "id": proyecto_id,
                                "codigo_dsp": codigo_dsp,
                                "ubicacion": ubicacion,
                                "tipologia": tipologia,
                                "entidad_formuladora": entidad_formuladora
                            })

                    else:

                        nuevo = conn.execute(text("""
                            INSERT INTO proyectos (nombre, direccion_id)
                            VALUES (:nombre, :direccion_id)
                            ON CONFLICT (nombre, direccion_id)
                            DO UPDATE SET nombre = EXCLUDED.nombre
                            RETURNING id
                        """), {
                            "nombre": nombre_original,
                            "direccion_id": direccion_id
                        }).fetchone()

                        proyecto_id = nuevo.id

                        # 🔥 INSERTAR CUI SOLO SI NO EXISTE EN OTRO
                        if cui:
                            existe = conn.execute(text("""
                                SELECT id FROM proyectos WHERE cui = :cui
                            """), {"cui": cui}).fetchone()

                            if not existe or existe.id == proyecto_id:
                                conn.execute(text("""
                                    UPDATE proyectos SET cui = :cui WHERE id = :id
                                """), {
                                    "cui": cui,
                                    "id": proyecto_id
                                })
                            else:
                                print(f"CUI duplicado ignorado en insert: {cui}")

                    # ================= VERSION (AHORA FICHA_LLENAdo 🔥) =================

                    version = conn.execute(text("""

                    INSERT INTO ficha_llenado (
                        proyecto_id,
                        fecha_corte,
                        estado,
                        fecha_inicio_programado,
                        fecha_inicio_ejecutado,
                        fecha_fin_programado,
                        spi,
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
                        :spi,
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
                        estado = COALESCE(EXCLUDED.estado, ficha_llenado.estado),
                        fecha_inicio_programado = COALESCE(EXCLUDED.fecha_inicio_programado, ficha_llenado.fecha_inicio_programado),
                        fecha_inicio_ejecutado = COALESCE(EXCLUDED.fecha_inicio_ejecutado, ficha_llenado.fecha_inicio_ejecutado),
                        fecha_fin_programado = COALESCE(EXCLUDED.fecha_fin_programado, ficha_llenado.fecha_fin_programado),
                        spi = COALESCE(EXCLUDED.spi, ficha_llenado.spi),
                        dependencias_externas = COALESCE(EXCLUDED.dependencias_externas, ficha_llenado.dependencias_externas),
                        presupuesto_programado = COALESCE(EXCLUDED.presupuesto_programado, ficha_llenado.presupuesto_programado),
                        proyecto_inversion = COALESCE(EXCLUDED.proyecto_inversion, ficha_llenado.proyecto_inversion),
                        clasificacion_id = COALESCE(EXCLUDED.clasificacion_id, ficha_llenado.clasificacion_id),
                        direccion_id = COALESCE(EXCLUDED.direccion_id, ficha_llenado.direccion_id),
                        entidad_ejecutora = COALESCE(EXCLUDED.entidad_ejecutora, ficha_llenado.entidad_ejecutora),
                        coordinador = COALESCE(EXCLUDED.coordinador, ficha_llenado.coordinador),
                        correo = COALESCE(EXCLUDED.correo, ficha_llenado.correo),
                        celular = COALESCE(EXCLUDED.celular, ficha_llenado.celular)

                    RETURNING id

                    """), {
                        "proyecto_id": proyecto_id,
                        "fecha_corte": fecha_corte,
                        "estado": estado,
                        "fecha_inicio_programado": limpiar_fecha(row.get("fecha_inicio_programado")),
                        "spi": float(row.get("spi") or 0) if str(row.get("spi")).strip() != "" else None,
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

                    # ================= DEPENDENCIAS INTERNAS =================

                    if dependencias_internas:

                        conn.execute(text("""
                            DELETE FROM proyecto_dependencia_interna
                            WHERE ficha_llenado_id = :version_id
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
                                        ficha_llenado_id,
                                        direccion_id
                                    )
                                    VALUES (:version_id, :direccion_id)
                                """), {
                                    "version_id": version_id,
                                    "direccion_id": direccion_dep.id
                                })


                    # ================= ARC =================
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
                                spi,
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
                                :spi,
                                :avance_percent
                            )
                            ON CONFLICT (proyecto_id, fecha_corte, codigo_arc)
                            DO UPDATE SET
                                descripcion = COALESCE(EXCLUDED.descripcion, proyecto_arc.descripcion),
                                inicio_programado = COALESCE(EXCLUDED.inicio_programado, proyecto_arc.inicio_programado),
                                spi = COALESCE(EXCLUDED.spi, proyecto_arc.spi),
                                fin_programado = COALESCE(EXCLUDED.fin_programado, proyecto_arc.fin_programado),
                                inicio_ejecutado = COALESCE(EXCLUDED.inicio_ejecutado, proyecto_arc.inicio_ejecutado),
                                fin_ejecutado = COALESCE(EXCLUDED.fin_ejecutado, proyecto_arc.fin_ejecutado),
                                spi = COALESCE(EXCLUDED.spi, proyecto_arc.spi),
                                avance_percent = COALESCE(EXCLUDED.avance_percent, proyecto_arc.avance_percent)
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
                            "spi":
                                float(row["spi"] or 0)
                                if "spi" in df.columns and pd.notna(row["spi"])
                                else 0,
                            "avance_percent":
                                float(row["avance_arc"] or 0)
                                if "avance_arc" in df.columns
                                else 0
                        })

                    # ================= COMMIT =================
                    conn.commit()

            except Exception as e:
                print(f"ERROR REAL EN FILA:", row.to_dict())
                print(f"DETALLE:", e)
                raise e

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

                if not nombre_original:
                    print("Fila ignorada (sin nombre)")
                    continue

                nombre_normalizado = normalizar_texto(nombre_original)


                # ================= DIRECCIÓN =================

                raw_dir = row.get("direccion_id")

                # 🔥 detectar vacío real (incluye NaN)
                if pd.isna(raw_dir) or str(raw_dir).strip() == "":
                    print(f"Fila ignorada (direccion_id vacío): {nombre_original}")
                    continue

                try:
                    direccion_id = int(float(raw_dir))  # 🔥 convierte 11.0 → 11
                except:
                    print(f"ERROR direccion_id inválido: {raw_dir} - {nombre_original}")
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


                # ================= BUSCAR PROYECTO (MATCH POR SIMILITUD) =================

                import difflib

                proyectos = conn.execute(text("""
                    SELECT id, nombre
                    FROM proyectos
                    WHERE direccion_id = :direccion_id
                """), {
                    "direccion_id": direccion_id
                }).fetchall()

                mejor_match = None
                mejor_score = 0

                for p in proyectos:
                    nombre_bd = normalizar_texto(p.nombre)

                    score = difflib.SequenceMatcher(None, nombre_bd, nombre_normalizado).ratio()

                    if score > mejor_score:
                        mejor_score = score
                        mejor_match = p

                # 🔥 VALIDACIÓN FINAL
                if mejor_score > 0.75:
                    proyecto = mejor_match
                    proyecto_id = proyecto.id
                else:
                    print(f"❌ Proyecto no encontrado: {nombre_original} | score={mejor_score}")
                    continue


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

                spi = (
                    float(row["spi"] or 0)
                    if "spi" in df.columns and pd.notna(row["spi"])
                    else 0
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
                    spi,
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
                    :spi,
                    :avance_percent
                )
                ON CONFLICT (proyecto_id, fecha_corte, codigo_arc)
                DO UPDATE SET
                    descripcion = EXCLUDED.descripcion,
                    inicio_programado = EXCLUDED.inicio_programado,
                    fin_programado = EXCLUDED.fin_programado,
                    spi = EXCLUDED.spi,
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
                    "spi": spi,
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
# MODELO REPORTEXTEMA
# =====================================================

class ReporteTema(BaseModel):

    tema_id: str

    fecha: str

    descripcion: str

    encargadas: str

    apoyo: str

    estado: str

    proyectos: str

    decisiones: str

# =====================================================
# ACTIVAR RUTER IA
# =====================================================

app.include_router(router)

# =====================================================
# OBTENER FECHA MÁXIMA (🔥 NUEVO)
# =====================================================

def obtener_fecha_max(conn, proyecto_id, codigo_arc):
    r = conn.execute(text("""
        SELECT MAX(fecha_corte)
        FROM proyecto_arc
        WHERE proyecto_id = :proyecto_id
        AND codigo_arc = :codigo_arc
    """), {
        "proyecto_id": proyecto_id,
        "codigo_arc": codigo_arc
    }).fetchone()

    return r[0] if r and r[0] else None


# =====================================================
# OBTENER VALOR ACTUAL (VERSIÓN FINAL REAL 🔥)
# =====================================================

def obtener_valor_actual(conn, proyecto_id, fecha_corte, codigo_arc, campo):

    campos_validos = {
        "descripcion",
        "inicio_programado",
        "fin_programado",
        "inicio_ejecutado",
        "fin_ejecutado",
        "spi",
        "avance_percent",
        "actividades_mes",
        "nueva_fecha_fin",
        "riesgo",
        "estado_arc"
    }

    if campo not in campos_validos:
        return None

    r = conn.execute(text(f"""
        SELECT {campo}
        FROM proyecto_arc
        WHERE proyecto_id = :proyecto_id
        AND codigo_arc = :codigo_arc
        AND fecha_corte = :fecha_corte
        ORDER BY fecha_corte DESC
        LIMIT 1
    """), {
        "proyecto_id": proyecto_id,
        "fecha_corte": fecha_corte,
        "codigo_arc": codigo_arc
    }).fetchone()

    return r[0] if r and r[0] is not None else None

# =====================================================
# GUARDAR TODA LA DATA
# =====================================================

@app.post("/api/guardar-todo")
def guardar_todo(data: dict):

    proyecto_id = data.get("proyecto_id")
    fecha_corte = limpiar_fecha(data.get("fecha_corte"))

    if not proyecto_id or not fecha_corte:
        raise HTTPException(status_code=400, detail="Faltan datos")

    reporte = data.get("reporte", {})
    arcs = data.get("arcs", [])
    finales = data.get("campos_finales", {})
    firmas = data.get("firmas", {})
    clear_fields = data.get("_clear_fields", [])

    with engine.begin() as conn:

        # =====================================================
        # FORMULARIO PRINCIPAL
        # =====================================================

        try:

            proyecto_id = data.get("proyecto_id")
            fecha_corte = limpiar_fecha(data.get("fecha_corte"))

            if not proyecto_id or not fecha_corte:
                raise HTTPException(status_code=400, detail="Faltan datos")

            # =====================================================
            # 🔥 NUEVO: CAMPOS A BORRAR INTENCIONALMENTE
            # =====================================================
            clear_fields = data.get("_clear_fields", [])

            # =====================================================
            # 🔥 SNAPSHOT BASE (CLAVE REAL)
            # =====================================================

            base = conn.execute(text("""
                SELECT *
                FROM ficha_llenado
                WHERE proyecto_id = :proyecto_id
                AND fecha_corte <= :fecha
                ORDER BY fecha_corte DESC
                LIMIT 1
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha_corte
            }).mappings().fetchone()

            # =====================================================
            # 🔥 LIMPIEZA (SNAPSHOT EN UNA SOLA LÍNEA)
            # =====================================================

            estado = None if "estado" in clear_fields else (reporte.get("estado") if reporte.get("estado") is not None else (base["estado"] if base else None))

            fecha_inicio_prog = None if "fecha_inicio_programado" in clear_fields else (limpiar_fecha(reporte.get("fecha_inicio_programado")) if reporte.get("fecha_inicio_programado") else (base["fecha_inicio_programado"] if base else None))

            fecha_inicio_ejec = None if "fecha_inicio_ejecutado" in clear_fields else (limpiar_fecha(reporte.get("fecha_inicio_ejecutado")) if reporte.get("fecha_inicio_ejecutado") else (base["fecha_inicio_ejecutado"] if base else None))

            fecha_fin_prog = None if "fecha_fin_programado" in clear_fields else (limpiar_fecha(reporte.get("fecha_fin_programado")) if reporte.get("fecha_fin_programado") else (base["fecha_fin_programado"] if base else None))

            fecha_conclusion_real = None if "fecha_conclusion_real" in clear_fields else (limpiar_fecha(reporte.get("fecha_conclusion_real")) if reporte.get("fecha_conclusion_real") else (base["fecha_conclusion_real"] if base else None))

            dependencias = None if "dependencias_externas" in clear_fields else (reporte.get("dependencias_externas") if reporte.get("dependencias_externas") is not None else (base["dependencias_externas"] if base else None))

            presupuesto_prog = None if "presupuesto_programado" in clear_fields else ((float(reporte.get("presupuesto_programado")) if reporte.get("presupuesto_programado") not in [None, ""] else None) if reporte.get("presupuesto_programado") is not None else (base["presupuesto_programado"] if base else None))

            spi = None if "spi" in clear_fields else ((float(reporte.get("spi")) if reporte.get("spi") not in [None, ""] else None) if reporte.get("spi") is not None else (base["spi"] if base else None))

            presupuesto_actualizado = None if "presupuesto_actualizado" in clear_fields else ((float(reporte.get("presupuesto_actualizado")) if reporte.get("presupuesto_actualizado") not in [None, ""] else None) if reporte.get("presupuesto_actualizado") is not None else (base["presupuesto_actualizado"] if base else None))

            avance_prog = None if "avance_programado" in clear_fields else ((float(reporte.get("avance_programado")) if reporte.get("avance_programado") not in [None, ""] else None) if reporte.get("avance_programado") is not None else (base["avance_programado"] if base else None))

            avance_real = None if "avance_fisico" in clear_fields else ((float(reporte.get("avance_fisico")) if reporte.get("avance_fisico") not in [None, ""] else None) if reporte.get("avance_fisico") is not None else (base["avance_fisico"] if base else None))

            avance_fin_prog = None if "avance_financiero_programado" in clear_fields else ((float(reporte.get("avance_financiero_programado")) if reporte.get("avance_financiero_programado") not in [None, ""] else None) if reporte.get("avance_financiero_programado") is not None else (base["avance_financiero_programado"] if base else None))

            avance_fin_real = None if "avance_financiero_real" in clear_fields else ((float(reporte.get("avance_financiero_real")) if reporte.get("avance_financiero_real") not in [None, ""] else None) if reporte.get("avance_financiero_real") is not None else (base["avance_financiero_real"] if base else None))

            proyecto_inv = None if "proyecto_inversion" in clear_fields else (reporte.get("proyecto_inversion") if reporte.get("proyecto_inversion") is not None else (base["proyecto_inversion"] if base else None))

            clasificacion_id = None if "clasificacion_id" in clear_fields else (reporte.get("clasificacion_id") if reporte.get("clasificacion_id") is not None else (base["clasificacion_id"] if base else None))

            direccion_id = None if "direccion_id" in clear_fields else (reporte.get("direccion_id") if reporte.get("direccion_id") is not None else (base["direccion_id"] if base else None))

            entidad = None if "entidad_ejecutora" in clear_fields else (reporte.get("entidad_ejecutora") if reporte.get("entidad_ejecutora") is not None else (base["entidad_ejecutora"] if base else None))

            coordinador = None if "coordinador" in clear_fields else (reporte.get("coordinador") if reporte.get("coordinador") is not None else (base["coordinador"] if base else None))

            correo = None if "correo" in clear_fields else (reporte.get("correo") if reporte.get("correo") is not None else (base["correo"] if base else None))

            celular = None if "celular" in clear_fields else (reporte.get("celular") if reporte.get("celular") is not None else (base["celular"] if base else None))

            subdireccion = None if "subdireccion" in clear_fields else (reporte.get("subdireccion") if reporte.get("subdireccion") is not None else (base["subdireccion"] if base else None))

            modalidad = None if "modalidad" in clear_fields else (reporte.get("modalidad") if reporte.get("modalidad") is not None else (base["modalidad"] if base else None))

            cui = None if "cui" in clear_fields else (reporte.get("cui") if reporte.get("cui") is not None else (base["cui"] if base else None))
                    
            # =====================================================
            # 🔥 INSERT / UPDATE (CON BORRADO CONTROLADO)
            # =====================================================

            conn.execute(text("""
                INSERT INTO ficha_llenado (
                    proyecto_id,
                    fecha_corte,
                    estado,
                    fecha_inicio_programado,
                    fecha_inicio_ejecutado,
                    fecha_fin_programado,
                    fecha_conclusion_real,
                    dependencias_externas,
                    presupuesto_programado,
                    presupuesto_actualizado,
                    avance_programado,
                    avance_fisico,
                    avance_financiero_programado,
                    avance_financiero_real,
                    spi,
                    proyecto_inversion,
                    clasificacion_id,
                    direccion_id,
                    entidad_ejecutora,
                    coordinador,
                    correo,
                    celular,
                    subdireccion,
                    modalidad,
                    cui
                )
                VALUES (
                    :proyecto_id,
                    :fecha_corte,
                    :estado,
                    :fecha_inicio_programado,
                    :fecha_inicio_ejecutado,
                    :fecha_fin_programado,
                    :fecha_conclusion_real,
                    :dependencias_externas,
                    :presupuesto_programado,
                    :presupuesto_actualizado,
                    :avance_programado,
                    :avance_fisico,
                    :avance_financiero_programado,
                    :avance_financiero_real,
                    :spi,
                    :proyecto_inversion,
                    :clasificacion_id,
                    :direccion_id,
                    :entidad_ejecutora,
                    :coordinador,
                    :correo,
                    :celular,
                    :subdireccion,
                    :modalidad,
                    :cui
                )
                ON CONFLICT (proyecto_id, fecha_corte)
                DO UPDATE SET

                    estado = CASE WHEN 'estado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.estado, ficha_llenado.estado) END,

                    fecha_inicio_programado = CASE WHEN 'fecha_inicio_programado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.fecha_inicio_programado, ficha_llenado.fecha_inicio_programado) END,
                    fecha_inicio_ejecutado = CASE WHEN 'fecha_inicio_ejecutado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.fecha_inicio_ejecutado, ficha_llenado.fecha_inicio_ejecutado) END,
                    fecha_fin_programado = CASE WHEN 'fecha_fin_programado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.fecha_fin_programado, ficha_llenado.fecha_fin_programado) END,
                    fecha_conclusion_real = CASE WHEN 'fecha_conclusion_real' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.fecha_conclusion_real, ficha_llenado.fecha_conclusion_real) END,

                    dependencias_externas = CASE WHEN 'dependencias_externas' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.dependencias_externas, ficha_llenado.dependencias_externas) END,

                    presupuesto_programado = CASE WHEN 'presupuesto_programado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.presupuesto_programado, ficha_llenado.presupuesto_programado) END,
                    presupuesto_actualizado = CASE WHEN 'presupuesto_actualizado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.presupuesto_actualizado, ficha_llenado.presupuesto_actualizado) END,

                    avance_programado = CASE WHEN 'avance_programado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.avance_programado, ficha_llenado.avance_programado) END,
                    avance_fisico = CASE WHEN 'avance_fisico' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.avance_fisico, ficha_llenado.avance_fisico) END,

                    avance_financiero_programado = CASE WHEN 'avance_financiero_programado' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.avance_financiero_programado, ficha_llenado.avance_financiero_programado) END,
                    avance_financiero_real = CASE WHEN 'avance_financiero_real' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.avance_financiero_real, ficha_llenado.avance_financiero_real) END,
                    spi = CASE WHEN 'spi' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.spi, ficha_llenado.spi) END,

                    proyecto_inversion = CASE WHEN 'proyecto_inversion' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.proyecto_inversion, ficha_llenado.proyecto_inversion) END,
                    clasificacion_id = CASE WHEN 'clasificacion_id' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.clasificacion_id, ficha_llenado.clasificacion_id) END,
                    direccion_id = CASE WHEN 'direccion_id' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.direccion_id, ficha_llenado.direccion_id) END,

                    entidad_ejecutora = CASE WHEN 'entidad_ejecutora' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.entidad_ejecutora, ficha_llenado.entidad_ejecutora) END,
                    coordinador = CASE WHEN 'coordinador' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.coordinador, ficha_llenado.coordinador) END,
                    correo = CASE WHEN 'correo' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.correo, ficha_llenado.correo) END,
                    celular = CASE WHEN 'celular' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.celular, ficha_llenado.celular) END,

                    subdireccion = CASE WHEN 'subdireccion' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.subdireccion, ficha_llenado.subdireccion) END,
                    modalidad = CASE WHEN 'modalidad' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.modalidad, ficha_llenado.modalidad) END,
                    cui = CASE WHEN 'cui' = ANY(:clear_fields) THEN NULL ELSE COALESCE(EXCLUDED.cui, ficha_llenado.cui) END
            """), {
                "proyecto_id": proyecto_id,
                "fecha_corte": fecha_corte,
                "estado": estado,
                "fecha_inicio_programado": fecha_inicio_prog,
                "fecha_inicio_ejecutado": fecha_inicio_ejec,
                "fecha_fin_programado": fecha_fin_prog,
                "fecha_conclusion_real": fecha_conclusion_real,
                "dependencias_externas": dependencias,
                "presupuesto_programado": presupuesto_prog,
                "presupuesto_actualizado": presupuesto_actualizado,
                "avance_programado": avance_prog,
                "avance_fisico": avance_real,
                "avance_financiero_programado": avance_fin_prog,
                "avance_financiero_real": avance_fin_real,
                "spi": spi,
                "proyecto_inversion": proyecto_inv,
                "clasificacion_id": clasificacion_id,
                "direccion_id": direccion_id,
                "entidad_ejecutora": entidad,
                "coordinador": coordinador,
                "correo": correo,
                "celular": celular,
                "subdireccion": subdireccion,
                "modalidad": modalidad,
                "cui": cui,
                "clear_fields": clear_fields
            })

        except Exception as e:
            print("ERROR GUARDAR REPORTE:", e)
            raise HTTPException(status_code=500, detail=str(e))

        # =====================================================
        # FORMULARIO MAESTRO
        # =====================================================

        try:
            
            proyecto_id = data.get("proyecto_id")
            fecha_corte = limpiar_fecha(data.get("fecha_corte"))
            arcs = data.get("arcs", [])

            clear_fields = data.get("_clear_fields", [])

            if not proyecto_id or not fecha_corte:
                raise HTTPException(status_code=400, detail="Faltan datos")

            if not isinstance(arcs, list):
                raise HTTPException(status_code=400, detail="ARC inválidos")

            if not arcs:
                print("ARC vacío")

            from datetime import datetime
            import math

            for arc in arcs:

                codigo_arc = arc.get("codigo_arc") or arc.get("codigo")

                # ================= BASE ARC (SNAPSHOT) =================
                base_arc = conn.execute(text("""
                    SELECT *
                    FROM proyecto_arc
                    WHERE proyecto_id = :proyecto_id
                    AND codigo_arc = :codigo_arc
                    AND fecha_corte = :fecha
                    LIMIT 1
                """), {
                    "proyecto_id": proyecto_id,
                    "codigo_arc": codigo_arc,
                    "fecha": fecha_corte
                }).mappings().fetchone()

                # ================= LIMPIEZA =================
                inicio = limpiar_fecha(arc.get("inicio_programado") or arc.get("inicio"))
                fin = limpiar_fecha(arc.get("fin_programado") or arc.get("fin"))
                inicio_ejec = limpiar_fecha(arc.get("inicio_ejecutado") or arc.get("inicio_ejec"))
                fin_ejec = limpiar_fecha(arc.get("fin_ejecutado") or arc.get("fin_ejec"))

                avance = arc.get("avance_percent") or arc.get("avance") or 0

                try:
                    avance = float(avance)
                    if math.isnan(avance):
                        avance = 0
                except:
                    avance = 0


                # ================= CAMPOS =================
                nueva_fecha_fin = limpiar_fecha(arc.get("nueva_fecha_fin"))
                riesgo = arc.get("riesgo")
                actividad = arc.get("actividades_mes")
                descripcion = arc.get("descripcion")

                # 🔥 NUEVO
                estado_arc = arc.get("estado_arc")

                # ================= FIX FINAL REAL 🔥 =================

                def limpiar(v, campo):

                    if isinstance(v, str):
                        v = v.strip()

                    if v == "-":   # 🔥 solo si es EXACTO
                        clear_fields.append(campo)
                        return None

                    if v in ("", "null", None):
                        return None

                    return v

                descripcion = limpiar(arc.get("descripcion"), "descripcion")
                inicio = limpiar(arc.get("inicio_programado"), "inicio_programado")
                fin = limpiar(arc.get("fin_programado"), "fin_programado")
                inicio_ejec = limpiar(arc.get("inicio_ejecutado"), "inicio_ejecutado")
                spi = limpiar(arc.get("spi"), "spi")
                fin_ejec = limpiar(arc.get("fin_ejecutado"), "fin_ejecutado")
                nueva_fecha_fin = limpiar(arc.get("nueva_fecha_fin"), "nueva_fecha_fin")
                riesgo = limpiar(arc.get("riesgo"), "riesgo")
                actividad = limpiar(arc.get("actividades_mes"), "actividades_mes")
                estado_arc = limpiar(arc.get("estado_arc"), "estado_arc")

                try:
                    avance = float(arc.get("avance_percent") or 0)
                except:
                    avance = 0

                try:
                    spi = float(spi or 0)
                except:
                    spi = 0
                
                # ================= INSERT / UPDATE =================
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
                        spi,
                        avance_percent,
                        actividades_mes,
                        no_realizado,
                        proximo_mes,
                        nueva_fecha_fin,
                        riesgo,
                        estado_arc
                    )
                    VALUES (
                        :proyecto_id,
                        :fecha_corte,
                        :codigo_arc,
                        :descripcion,
                        :inicio,
                        :fin,
                        :inicio_ejec,
                        :fin_ejec,
                        :spi
                        :avance,
                        :actividad,
                        :no_realizado,
                        :proximo,
                        :nueva_fecha_fin,
                        :riesgo,
                        :estado_arc
                    )
                    ON CONFLICT (proyecto_id, fecha_corte, codigo_arc)
                    DO UPDATE SET

                        descripcion =
                            CASE 
                                WHEN 'descripcion' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.descripcion, proyecto_arc.descripcion)
                            END,

                        inicio_programado =
                            COALESCE(EXCLUDED.inicio_programado, proyecto_arc.inicio_programado),

                        fin_programado =
                            COALESCE(EXCLUDED.fin_programado, proyecto_arc.fin_programado),

                        inicio_ejecutado =
                            COALESCE(EXCLUDED.inicio_ejecutado, proyecto_arc.inicio_ejecutado),

                        fin_ejecutado =
                            COALESCE(EXCLUDED.fin_ejecutado, proyecto_arc.fin_ejecutado),

                        spi =
                            CASE
                                WHEN 'spi' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.spi, proyecto_arc.spi)
                            END,

                        avance_percent =
                            COALESCE(EXCLUDED.avance_percent, proyecto_arc.avance_percent),

                        actividades_mes =
                            CASE 
                                WHEN 'actividades_mes' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.actividades_mes, proyecto_arc.actividades_mes)
                            END,

                        no_realizado =
                            COALESCE(EXCLUDED.no_realizado, proyecto_arc.no_realizado),

                        proximo_mes =
                            COALESCE(EXCLUDED.proximo_mes, proyecto_arc.proximo_mes),

                        nueva_fecha_fin =
                            CASE 
                                WHEN 'nueva_fecha_fin' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.nueva_fecha_fin, proyecto_arc.nueva_fecha_fin)
                            END,

                        riesgo =
                            CASE 
                                WHEN 'riesgo' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.riesgo, proyecto_arc.riesgo)
                            END,

                        estado_arc =
                            CASE 
                                WHEN 'estado_arc' = ANY(:clear_fields) THEN NULL
                                ELSE COALESCE(EXCLUDED.estado_arc, proyecto_arc.estado_arc)
                            END
                """), {
                    "proyecto_id": proyecto_id,
                    "fecha_corte": fecha_corte,
                    "codigo_arc": codigo_arc,
                    "descripcion": descripcion,
                    "inicio": inicio,
                    "fin": fin,
                    "inicio_ejec": inicio_ejec,
                    "fin_ejec": fin_ejec,
                    "spi": spi,
                    "avance": avance,
                    "no_realizado": arc.get("no_realizado"),
                    "proximo": arc.get("proximo_mes"),
                    "nueva_fecha_fin": nueva_fecha_fin,
                    "riesgo": riesgo,
                    "actividad": actividad,
                    "clear_fields": clear_fields,
                    "estado_arc": estado_arc
                })

        except Exception as e:
            print("ERROR GUARDAR ARC:", e)
            raise HTTPException(status_code=500, detail=str(e))

        # =====================================================
        # 🔥 FILA 9 y 10 (FIX REAL FINAL)
        # =====================================================

        try:

            from datetime import datetime

            proyecto_id = data.get("proyecto_id")
            fecha = data.get("fecha_corte")

            if not proyecto_id or not fecha:
                raise HTTPException(status_code=400, detail="Faltan datos")

            # 🔥 FIX CLAVE
            fecha = datetime.strptime(fecha, "%Y-%m-%d").date()

            clear_fields = data.get("_clear_fields", [])

            # 🔥 YA NO VA with engine.begin() AQUÍ

            # 🔥 ASEGURAR FILA
            conn.execute(text("""
                INSERT INTO ficha_llenado (proyecto_id, fecha_corte)
                VALUES (:proyecto_id, :fecha)
                ON CONFLICT (proyecto_id, fecha_corte) DO NOTHING
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha
            })

            # 🔥 UPDATE
            conn.execute(text("""
                UPDATE ficha_llenado
                SET
                    acuerdos =
                        CASE
                            WHEN 'acuerdos' = ANY(:clear_fields) THEN NULL
                            ELSE COALESCE(NULLIF(:acuerdos, ''), acuerdos)
                        END,

                    otros =
                        CASE
                            WHEN 'otros' = ANY(:clear_fields) THEN NULL
                            ELSE COALESCE(NULLIF(:otros, ''), otros)
                        END,

                    urgentes =
                        CASE
                            WHEN 'urgentes' = ANY(:clear_fields) THEN NULL
                            ELSE COALESCE(NULLIF(:urgentes, ''), urgentes)
                        END

                WHERE proyecto_id = :proyecto_id
                AND fecha_corte = :fecha
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha,
                "acuerdos": finales.get("acuerdos"),
                "otros": finales.get("otros"),
                "urgentes": finales.get("urgentes"),
                "clear_fields": clear_fields
            })

        except Exception as e:
            print("🔥 ERROR CAMPOS FINALES:", e)
            raise HTTPException(status_code=500, detail=str(e))

        # =====================================================
        # 🔥 GUARDAR TABLERO (LO QUE TE FALTA)
        # =====================================================

        try:

            tablero_data = data.get("reporte", {})

            conn.execute(text("""
                INSERT INTO tablero (proyecto_id, fecha, data)
                VALUES (:proyecto_id, :fecha, :data)
                ON CONFLICT (proyecto_id, fecha)
                DO UPDATE SET data = EXCLUDED.data
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha_corte,
                "data": json.dumps(tablero_data)
            })

        except Exception as e:
            print("ERROR TABLERO:", e)
            raise HTTPException(status_code=500, detail=str(e))

        # =====================================================
        # 🔥 FIRMAS - GUARDAR SOLO TEXTOS (FIX REAL FINAL)
        # =====================================================
        try:

            from datetime import datetime

            proyecto_id = data.get("proyecto_id")
            fecha_str = data.get("fecha_corte")

            firmas = data.get("firmas", {})
            print("FIRMAS RECIBIDAS:", firmas)

            if not proyecto_id or not fecha_str:
                raise HTTPException(status_code=400, detail="Faltan datos")

            fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()

            def limpiar(valor):
                if valor in ["", "-"]:
                    return None
                return valor

            # 🔥 USAR MISMA CONEXIÓN (SIN NUEVO engine.begin)

            conn.execute(text("""
                INSERT INTO firmas (proyecto_id, fecha_corte)
                VALUES (:proyecto_id, :fecha)
                ON CONFLICT (proyecto_id, fecha_corte) DO NOTHING
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha
            })

            conn.execute(text("""
                INSERT INTO firmas (
                    proyecto_id, fecha_corte,
                    cargo1, nombre1,
                    cargo2, nombre2,
                    cargo3, nombre3
                )
                VALUES (
                    :proyecto_id, :fecha,
                    :cargo1, :nombre1,
                    :cargo2, :nombre2,
                    :cargo3, :nombre3
                )
                ON CONFLICT (proyecto_id, fecha_corte)
                DO UPDATE SET
                    cargo1 = EXCLUDED.cargo1,
                    nombre1 = EXCLUDED.nombre1,
                    cargo2 = EXCLUDED.cargo2,
                    nombre2 = EXCLUDED.nombre2,
                    cargo3 = EXCLUDED.cargo3,
                    nombre3 = EXCLUDED.nombre3
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha,
                "cargo1": limpiar(firmas.get("cargo1")),
                "nombre1": limpiar(firmas.get("nombre1")),
                "cargo2": limpiar(firmas.get("cargo2")),
                "nombre2": limpiar(firmas.get("nombre2")),
                "cargo3": limpiar(firmas.get("cargo3")),
                "nombre3": limpiar(firmas.get("nombre3")),
            })

            result = conn.execute(text("""
                SELECT *
                FROM firmas
                WHERE proyecto_id = :proyecto_id
                AND fecha_corte = :fecha
            """), {
                "proyecto_id": proyecto_id,
                "fecha": fecha
            }).mappings().fetchone()

            return dict(result) if result else {}

        except Exception as e:
            print("ERROR FIRMAS:", e)
            raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# ENDPOINT PARA LEER ARC - FORMATO D (FINAL PRO 🔥)
# =====================================================

@app.get("/api/arc/{proyecto_id}")
def obtener_arc(proyecto_id: int, fecha: str = None):

    import math
    from datetime import datetime
    
    with engine.connect() as conn:

        query = """
            SELECT
                codigo_arc,
                descripcion,
                direccion_responsable,
                inicio_programado,
                fin_programado,
                nueva_fecha_fin,
                riesgo,
                inicio_ejecutado,
                fin_ejecutado,
                spi,
                avance_percent,
                actividades_mes,
                estado_arc
            FROM proyecto_arc
            WHERE proyecto_id = :proyecto_id
        """

        params = {"proyecto_id": proyecto_id}

        # =====================================================
        # 🔥 FILTRO POR FECHA (CORRECTO)
        # =====================================================
        if fecha:
            try:
                fecha_limpia = datetime.strptime(fecha[:10], "%Y-%m-%d").date()
                query += " AND fecha_corte = :fecha"
                params["fecha"] = fecha_limpia
            except:
                pass  # evita romper si fecha viene mal

        query += " ORDER BY codigo_arc"

        result = conn.execute(text(query), params).fetchall()

        data = []

        for r in result:

            row = r._mapping  # 🔥 forma segura

            # =====================================================
            # 🔥 AVANCE SEGURO (ANTI NaN)
            # =====================================================
            avance = 0
            try:
                val = row["avance_percent"]
                if val is not None:
                    val = float(val)
                    if not math.isnan(val):
                        avance = val
            except:
                avance = 0

            # =====================================================
            # 🔥 FORMATEO LIMPIO
            # =====================================================
            data.append({
                "codigo_arc": row["codigo_arc"],
                "descripcion": row["descripcion"],

                "direccion_responsable": row["direccion_responsable"],

                "inicio_programado": row["inicio_programado"].isoformat() if row["inicio_programado"] else None,
                "fin_programado": row["fin_programado"].isoformat() if row["fin_programado"] else None,

                "inicio_ejecutado": row["inicio_ejecutado"].isoformat() if row["inicio_ejecutado"] else None,
                "fin_ejecutado": row["fin_ejecutado"].isoformat() if row["fin_ejecutado"] else None,

                "nueva_fecha_fin": row["nueva_fecha_fin"].isoformat() if row["nueva_fecha_fin"] else None,

                "riesgo": row["riesgo"],

                "actividades_mes": row["actividades_mes"],

                # 🔥 NUEVO
                "spi": float(row["spi"]) if row["spi"] is not None else 0,

                # 🔥 CLAVE
                "estado": row["estado_arc"],

                "avance_percent": avance
            })

        return data
    
# =====================================================
# DIRECCIONES USADAS EN PROYECTOS - REUTILIZABLE PROYECTOS
# =====================================================

@app.get("/api/direcciones")
def obtener_direcciones():

    with engine.connect() as conn:

        result = conn.execute(text("""
            SELECT DISTINCT d.id, d.nombre
            FROM proyectos p
            JOIN direcciones d ON p.direccion_id = d.id
            ORDER BY d.nombre
        """))

        direcciones = [dict(row._mapping) for row in result]

    return direcciones

# =====================================================
# DATOS DEL PROYECTO (FORMATO D) - FINAL LIMPIO 🔥
# =====================================================

from sqlalchemy import text

@app.get("/api/proyecto/{proyecto_id}")
def obtener_proyecto(proyecto_id: int, fecha: str = None):

    with engine.connect() as conn:

        try:

            # =====================================================
            # 🔥 VALIDACIÓN
            # =====================================================
            if not fecha:
                return {}

            fecha_limpia = fecha.split("T")[0]

            # ====================================================
            # 🔥 CONSULTA DIRECTA (SIN COALESCE, SIN JOIN)
            # =====================================================
            query = text("""
                SELECT *
                FROM ficha_llenado
                WHERE proyecto_id = :proyecto_id
                AND fecha_corte = :fecha
                LIMIT 1
            """)

            result = conn.execute(query, {
                "proyecto_id": proyecto_id,
                "fecha": fecha_limpia
            }).fetchone()

            # =====================================================
            # ❌ SIN DATA
            # =====================================================
            if not result:
                return {}

            data = dict(result._mapping)

            # =====================================================
            # 🔧 NORMALIZACIÓN SEGURA (VERSIÓN FINAL PRO 🔥)
            # =====================================================

            data["estado"] = data.get("estado") or "Sin iniciar"
            data["coordinador"] = data.get("coordinador") or ""

            # =====================================================
            # 🔥 AVANCE FÍSICO (DOBLE COMPATIBILIDAD)
            # =====================================================
            data["avance_real"] = float(
                data.get("avance_real") 
                if data.get("avance_real") is not None 
                else data.get("avance_fisico") or 0
            )

            data["avance_prog"] = float(
                data.get("avance_prog") 
                if data.get("avance_prog") is not None 
                else data.get("avance_programado") or 0
            )

            # =====================================================
            # 🔥 PRESUPUESTO (DOBLE COMPATIBILIDAD)
            # =====================================================
            data["presupuesto"] = float(
                data.get("presupuesto") 
                if data.get("presupuesto") is not None 
                else data.get("presupuesto_programado") or 0
            )

            data["presupuesto_actualizado"] = float(
                data.get("presupuesto_actualizado") or 0
            )

            # =====================================================
            # 🔥 AVANCE FINANCIERO (NUEVO - CLAVE)
            # =====================================================
            data["avance_financiero_programado"] = float(
                data.get("avance_financiero_programado") or 0
            )

            data["avance_financiero_real"] = float(
                data.get("avance_financiero_real") or 0
            )

            # =====================================================
            # 🔥 CAMPOS NUEVOS
            # =====================================================
            data["subdireccion"] = data.get("subdireccion") or ""
            data["modalidad"] = data.get("modalidad") or ""

            # =====================================================
            # 🔥 FECHAS (PARA FRONTEND)
            # =====================================================
            data["fecha_inicio_programado"] = data.get("fecha_inicio_programado")
            data["fecha_fin_programado"] = data.get("fecha_fin_programado")
            data["fecha_conclusion_real"] = data.get("fecha_conclusion_real")

            # =====================================================
            # 🔥 OTROS
            # =====================================================
            data["cui"] = data.get("cui") or ""
            data["direccion_id"] = data.get("direccion_id")

            # =====================================================
            # ✅ RETURN FINAL
            # =====================================================
            return data

        except Exception as e:
            print("❌ ERROR EN /api/proyecto:", e)
            return {"error": str(e)}
        
# =====================================================
# 🔥 OBTENER CAMPOS FINALES (CLAVE PARA FRONT)
# =====================================================

@app.get("/api/campos-finales/{proyecto_id}")
def obtener_campos_finales(proyecto_id: int, fecha: str):

    from datetime import datetime

    if not fecha:
        return {}

    fecha = datetime.strptime(fecha[:10], "%Y-%m-%d").date()

    with engine.connect() as conn:

        row = conn.execute(text("""
            SELECT acuerdos, otros, urgentes
            FROM ficha_llenado
            WHERE proyecto_id = :proyecto_id
            AND fecha_corte = :fecha
        """), {
            "proyecto_id": proyecto_id,
            "fecha": fecha
        }).fetchone()

        if not row:
            return {}

        return dict(row._mapping)

# =====================================================
# 🔥 SUBIR FIRMA (IMAGEN) - FIX FINAL PRO
# =====================================================
@app.post("/api/subir-firma")
async def subir_firma(
    file: UploadFile = File(...),
    proyecto_id: int = Form(...),
    fecha_corte: str = Form(...),
    firma_num: int = Form(...),
    cargo: str = Form(None),
    nombre: str = Form(None)
):

    from datetime import datetime
    import os

    fecha = datetime.strptime(fecha_corte, "%Y-%m-%d").date()

    # 🔥 RUTA
    FIRMAS_DIR = os.path.join(FRONTEND_DIR, "firmas")
    os.makedirs(FIRMAS_DIR, exist_ok=True)

    # =====================================================
    # 🔥 EXTENSIÓN
    # =====================================================
    ext = file.filename.split(".")[-1].lower()

    if ext == "jpeg":
        ext = "jpg"

    if ext not in ["png", "jpg", "jpeg", "svg"]:
        ext = "png"

    # =====================================================
    # 🔥 LIMPIAR ANTERIORES
    # =====================================================
    for e in ["png", "jpg", "jpeg", "svg"]:
        old_file = os.path.join(FIRMAS_DIR, f"firma_{proyecto_id}_{fecha}_{firma_num}.{e}")
        if os.path.exists(old_file):
            os.remove(old_file)

    # =====================================================
    # 🔥 GUARDAR
    # =====================================================
    filename = f"firma_{proyecto_id}_{fecha}_{firma_num}.{ext}"
    path = os.path.join(FIRMAS_DIR, filename)

    content = await file.read()

    with open(path, "wb") as f:
        f.write(content)

    url = f"/static/firmas/{filename}"

    # =====================================================
    # 🔥 NORMALIZAR (CLAVE 🔥)
    # =====================================================
    def limpiar(v):
        if v in ["", "-"]:
            return None
        return v

    cargo = limpiar(cargo)
    nombre = limpiar(nombre)

    # =====================================================
    # 🔥 DB
    # =====================================================
    with engine.begin() as conn:

        conn.execute(text("""
            INSERT INTO firmas (proyecto_id, fecha_corte)
            VALUES (:proyecto_id, :fecha)
            ON CONFLICT (proyecto_id, fecha_corte) DO NOTHING
        """), {
            "proyecto_id": proyecto_id,
            "fecha": fecha
        })

        result = conn.execute(text(f"""
            UPDATE firmas
            SET 
                firma{firma_num} = :url,

                cargo{firma_num} = COALESCE(:cargo, cargo{firma_num}),
                nombre{firma_num} = COALESCE(:nombre, nombre{firma_num})

            WHERE proyecto_id = :proyecto_id
            AND DATE(fecha_corte) = :fecha
        """), {
            "url": url,
            "cargo": cargo,
            "nombre": nombre,
            "proyecto_id": proyecto_id,
            "fecha": fecha
        })

        print("FILAS ACTUALIZADAS:", result.rowcount)

    return {"url": url}

# =====================================================
# 🔥 OBTENER FIRMAS (CARGA AUTOMÁTICA) - FIX 🔥
# =====================================================
@app.get("/api/firmas/{proyecto_id}")
def obtener_firmas(proyecto_id: int, fecha: str):

    from datetime import datetime

    if not fecha:
        raise HTTPException(status_code=400, detail="Falta fecha")

    fecha = datetime.strptime(fecha[:10], "%Y-%m-%d").date()

    with engine.connect() as conn:

        row = conn.execute(text("""
            SELECT *
            FROM firmas
            WHERE proyecto_id = :proyecto_id
            AND fecha_corte = :fecha
        """), {
            "proyecto_id": proyecto_id,
            "fecha": fecha
        }).mappings().fetchone()

    # =====================================================
    # 🔥 FIX URL FIRMAS (CLAVE 🔥)
    # =====================================================
    if not row:
        return {}

    data = dict(row)

    def fix_url(u):
        if not u:
            return None

        # ✔ ya está bien
        if u.startswith("/static/firmas"):
            return u

        # ✔ solo nombre archivo
        if "firma_" in u:
            return f"/static/firmas/{u.split('/')[-1]}"

        # ❌ basura tipo /reportes/D
        return None

    data["firma1"] = fix_url(data.get("firma1"))
    data["firma2"] = fix_url(data.get("firma2"))
    data["firma3"] = fix_url(data.get("firma3"))

    return data

# =====================================================
# RUTA FIRMAS (FIX REAL 🔥)
# =====================================================

FIRMAS_DIR = os.path.join(FRONTEND_DIR, "firmas")

# crear carpeta si no existe
os.makedirs(FIRMAS_DIR, exist_ok=True)

# =====================================================
# PDF REPORTE E (VERSIÓN FINAL PRO)
# =====================================================

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import text
from jinja2 import Environment, FileSystemLoader
import os

router = APIRouter()

# ================= BASE =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

templates_path = os.path.abspath(
    os.path.join(BASE_DIR, "..", "reportes", "templates")
)

templates = Environment(
    loader=FileSystemLoader(templates_path)
)

import pdfkit
import uuid
import os
from fastapi.responses import FileResponse

@router.get("/api/reporteE/pdf")
def generar_pdf(proyecto_id: int, fecha: str):

    try:

        with engine.connect() as conn:

            arc = conn.execute(text("""
                SELECT * FROM proyecto_arc
                WHERE proyecto_id = :id AND fecha_corte = :fecha
            """), {
                "id": proyecto_id,
                "fecha": fecha
            }).mappings().all()

            proyecto_data = conn.execute(text("""
                SELECT *
                FROM proyectos
                WHERE id = :id
                LIMIT 1
            """), {
                "id": proyecto_id
            }).mappings().first()

        template = templates.get_template("reporteE.html")

        html = template.render(
            fecha=fecha,
            proyecto=proyecto_data["nombre"] if proyecto_data else "PROYECTO",
            arc=arc,
            tipologia=proyecto_data.get("tipologia", "") if proyecto_data else "",
            entidad=proyecto_data.get("entidad", "") if proyecto_data else "",
            inicio=proyecto_data.get("inicio_programado", "") if proyecto_data else "",
            estado=proyecto_data.get("estado", "") if proyecto_data else "",
            presupuesto_aprobado=proyecto_data.get("presupuesto", "") if proyecto_data else "",
            fin=proyecto_data.get("fin_programado", "") if proyecto_data else "",
            spi=proyecto_data.get("spi", "") if proyecto_data else "",
            nombre1="",
            cargo1="",
            nombre2="",
            cargo2="",
            nombre3="",
            cargo3=""
        )

        output_path = f"/tmp/reporteE_{proyecto_id}_{uuid.uuid4().hex}.pdf"

        WKHTMLTOPDF_PATH = os.getenv("WKHTMLTOPDF_PATH", "/usr/bin/wkhtmltopdf")
        config = pdfkit.configuration(wkhtmltopdf=WKHTMLTOPDF_PATH)

        options = {
            "enable-local-file-access": ""
        }

        pdfkit.from_string(html, output_path, configuration=config, options=options)

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"reporteE_{proyecto_id}.pdf"
        )

    except Exception as e:
        return {"error": str(e)}

# ================= ROUTER =================
app.include_router(router)

# PUNTOS EN EL CALENDARIO

import json

@app.get("/api/tablero/fechas")
def fechas_tablero():

    with engine.connect() as conn:

        fechas = conn.execute(text("""
            SELECT DISTINCT fecha
            FROM tablero
            WHERE fecha IS NOT NULL
            ORDER BY fecha DESC
        """)).fetchall()

    return [f[0].strftime("%Y-%m-%d") for f in fechas if f[0]]

@app.get("/api/tablero/{fecha}")
def obtener_tablero(
    fecha: str,
    proyecto_id: int = 1,
    tab: str = "principal"
):

    try:
        with engine.connect() as conn:

            result = conn.execute(text("""
                SELECT data
                FROM tablero
                WHERE fecha = CAST(:fecha AS DATE)
                AND proyecto_id = :proyecto_id
                AND tab = :tab
            """), {
                "fecha": fecha,
                "proyecto_id": proyecto_id,
                "tab": tab
            }).fetchone()

            if not result:
                return {"data": None}

            data = result[0]

            if isinstance(data, str):
                data = json.loads(data)

            return {"data": data}

    except Exception as e:
        print("ERROR:", e)
        return {"data": None}

@app.get("/api/tablero/tabs-proyecto/{proyecto_id}")
def listar_tabs(proyecto_id: int):

    with engine.connect() as conn:

        rows = conn.execute(text("""

            SELECT
                id,
                nombre,
                proyecto_id
            FROM tabs
            WHERE proyecto_id = :proyecto_id
            ORDER BY nombre

        """), {
            "proyecto_id": proyecto_id
        }).fetchall()

    return [
        dict(r._mapping)
        for r in rows
    ]

@app.get("/api/tablero/tabs/{fecha}")
def obtener_tabs(fecha: str):

    with engine.connect() as conn:

        rows = conn.execute(text("""

            SELECT DISTINCT tab
            FROM tablero
            WHERE fecha = CAST(:fecha AS DATE)
            ORDER BY tab

        """), {
            "fecha": fecha
        }).fetchall()

        resultado = []

        for r in rows:

            nombre = r.tab

            # 🔥 PRINCIPAL
            if r.tab == "principal":

                nombre = "Principal"

            else:

                tab_nombre = conn.execute(text("""

                    SELECT nombre
                    FROM tabs
                    WHERE id = :id
                    LIMIT 1

                """), {
                    "id": r.tab
                }).fetchone()

                if tab_nombre and tab_nombre[0]:

                    nombre = tab_nombre[0]

            resultado.append({

                "id": r.tab,
                "nombre": nombre

            })

    return resultado

@app.post("/api/tablero/guardar")
def guardar_tablero(payload: dict):

    try:

        print("\n==============================")
        print("🔥 PAYLOAD COMPLETO")
        print(payload)
        print("==============================\n")

        fecha = payload.get("fecha")
        data = payload.get("data")
        proyecto_id = payload.get("proyecto_id", 1)

        # 🔥 TAB
        tab = payload.get("tab", "principal")

        print("📅 FECHA:", fecha)
        print("📁 TAB:", tab)
        print("📦 DATA EXISTS:", data is not None)

        if not fecha or data is None:

            raise HTTPException(
                status_code=400,
                detail="Faltan datos"
            )

        # 🔥 DEBUG JSON
        json_data = json.dumps(data)

        print("📄 JSON SIZE:", len(json_data))

        with engine.begin() as conn:

            # 🔥 VER SI YA EXISTE
            existe = conn.execute(text("""

                SELECT id, fecha, tab

                FROM tablero

                WHERE fecha = CAST(:fecha AS DATE)
                AND proyecto_id = :proyecto_id
                AND tab = :tab

            """), {
                "fecha": fecha,
                "proyecto_id": proyecto_id,
                "tab": tab
            }).fetchone()

            print("🔎 EXISTE:", existe)

            conn.execute(text("""

                INSERT INTO tablero (
                    fecha,
                    data,
                    proyecto_id,
                    tab
                )
                VALUES (
                    CAST(:fecha AS DATE),
                    CAST(:data AS jsonb),
                    :proyecto_id,
                    :tab
                )

                ON CONFLICT (
                    proyecto_id,
                    fecha,
                    tab
                )

                DO UPDATE SET

                    data = EXCLUDED.data,
                    proyecto_id = EXCLUDED.proyecto_id,
                    tab = EXCLUDED.tab

            """), {

                "fecha": fecha,
                "data": json_data,
                "proyecto_id": proyecto_id,
                "tab": tab

            })

            print("✅ INSERT/UPDATE OK")

            # 🔥 VERIFICAR GUARDADO REAL
            verif = conn.execute(text("""

                SELECT
                    id,
                    fecha,
                    proyecto_id,
                    tab

                FROM tablero

                WHERE fecha = CAST(:fecha AS DATE)
                AND proyecto_id = :proyecto_id
                AND tab = :tab

            """), {
                "fecha": fecha,
                "proyecto_id": proyecto_id,
                "tab": tab
            }).fetchall()

            print("📦 REGISTROS EN BD:")
            print(verif)

        return {
            "ok": True
        }

    except Exception as e:

        import traceback

        traceback.print_exc()

        print("🔥 ERROR BACKEND REAL:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/tablero/fechas/{proyecto_id}")
def fechas_tablero_por_proyecto(proyecto_id: int):

    with engine.connect() as conn:

        rows = conn.execute(text("""
            SELECT DISTINCT fecha
            FROM tablero
            WHERE proyecto_id = :proyecto_id
            ORDER BY fecha DESC
        """), {
            "proyecto_id": proyecto_id
        }).fetchall()

    return [r[0].strftime("%Y-%m-%d") for r in rows if r[0]]

@app.get("/api/tablero/ultima")
def ultima_fecha():

    with engine.connect() as conn:

        result = conn.execute(text("""
            SELECT fecha
            FROM tablero
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements(data->'filas') fila,
                     jsonb_array_elements(fila) celda,
                     jsonb_array_elements(celda) nodo
                WHERE nodo->>'texto' IS NOT NULL
                AND nodo->>'texto' != ''
            )
            ORDER BY fecha DESC
            LIMIT 1
        """)).fetchone()

    if not result:
        return {"fecha": None}

    return {"fecha": result[0].strftime("%Y-%m-%d")}

# =====================================================
# TEMAS REPORTEXTEMA
# =====================================================

@app.get("/api/reportextema/temas")
def obtener_temas():

    with engine.connect() as conn:

        rows = conn.execute(text("""

            SELECT

                id,
                nombre

            FROM temas

            ORDER BY nombre

        """)).mappings().fetchall()

        return rows
    
# =====================================================
# GUARDAR REPORTEXTEMA
# =====================================================

@app.post("/api/reportextema/guardar")
def guardar_reportextema(
    data: ReporteTema
):

    with engine.begin() as conn:

        conn.execute(text("""

            INSERT INTO reportes_tema(

                tema_id,

                fecha,

                descripcion,

                encargadas,

                apoyo,

                estado,

                proyectos,

                decisiones

            )

            VALUES(

                :tema_id,

                :fecha,

                :descripcion,

                :encargadas,

                :apoyo,

                :estado,

                :proyectos,

                :decisiones

            )

        """), {

            "tema_id":
                data.tema_id,

            "fecha":
                data.fecha,

            "descripcion":
                data.descripcion,

            "encargadas":
                data.encargadas,

            "apoyo":
                data.apoyo,

            "estado":
                data.estado,

            "proyectos":
                data.proyectos,

            "decisiones":
                data.decisiones
        })

    return {
        "ok": True
    }

# =====================================================
# SUBIR EXCEL reportextema/
# =====================================================

@app.post("/api/reportextema/subir-excel")
async def subir_excel(
    file: UploadFile = File(...)
):

    try:

        # =============================================
        # LEER EXCEL
        # =============================================

        df = pd.read_excel(file.file)

        # =============================================
        # LIMPIAR COLUMNAS
        # =============================================

        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
        )

        print("COLUMNAS:", df.columns)

        print(df)

        # =============================================
        # INSERTAR
        # =============================================

        with engine.begin() as conn:

            for _, row in df.iterrows():

                print("ROW:", row)

                tema_id = int(
                    float(row["tema_id"])
                )

                fecha = str(
                    row["fecha"]
                ).strip()

                descripcion = str(
                    row["descripcion"]
                ).strip()

                encargadas = str(
                    row["encargadas"]
                ).strip()

                apoyo = str(
                    row["apoyo"]
                ).strip()

                estado = str(
                    row["estado"]
                ).strip()

                proyectos = str(
                    row["proyectos"]
                ).strip()

                decisiones = str(
                    row["decisiones"]
                ).strip()

                print(
                    "INSERTANDO:",
                    tema_id,
                    fecha
                )

                conn.execute(text("""

                    INSERT INTO reportes_tema(

                        tema_id,

                        fecha,

                        descripcion,

                        encargadas,

                        apoyo,

                        estado,

                        proyectos,

                        decisiones

                    )

                    VALUES(

                        :tema_id,

                        :fecha,

                        :descripcion,

                        :encargadas,

                        :apoyo,

                        :estado,

                        :proyectos,

                        :decisiones
                    )

                """), {

                    "tema_id":
                        tema_id,

                    "fecha":
                        fecha,

                    "descripcion":
                        descripcion,

                    "encargadas":
                        encargadas,

                    "apoyo":
                        apoyo,

                    "estado":
                        estado,

                    "proyectos":
                        proyectos,

                    "decisiones":
                        decisiones
                })

        return {

            "ok": True,

            "mensaje":
                "Excel cargado correctamente"
        }

    except Exception as e:

        print("ERROR:", e)

        return {

            "ok": False,

            "mensaje":
                str(e)
        }

# =====================================================
# SUBIR EXCEL TEMAS
# =====================================================

@app.post("/api/reportextema/subir-temas")
async def subir_temas(
    file: UploadFile = File(...)
):

    try:

        df = pd.read_excel(file.file)

        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
        )

        with engine.begin() as conn:

            for _, row in df.iterrows():

                nombre = str(
                    row["nombre"]
                ).strip()

                # EVITAR DUPLICADOS
                existe = conn.execute(text("""

                    SELECT id

                    FROM temas

                    WHERE LOWER(nombre)
                    = LOWER(:nombre)

                """), {

                    "nombre": nombre

                }).fetchone()

                if existe:
                    continue

                conn.execute(text("""

                    INSERT INTO temas(
                        nombre
                    )

                    VALUES(
                        :nombre
                    )

                """), {

                    "nombre": nombre
                })

        return {

            "ok": True,
            "mensaje":
                "Temas cargados correctamente"
        }

    except Exception as e:

        print(e)

        return {

            "ok": False,
            "mensaje": str(e)
        }
    
# =====================================================
# OBTENER REPORTE
# =====================================================

@app.get("/api/reportextema/detalle")
def obtener_detalle(
    fecha:str,
    tema_id:int
):

    print("FECHA:", fecha)
    print("TEMA:", tema_id)

    fecha = fecha.strip()

    # convertir 15/05/2026 -> 2026-05-15
    partes = fecha.split("/")

    fecha = (
        f"{partes[2]}-{partes[1]}-{partes[0]}"
    )

    with engine.connect() as conn:

        row = conn.execute(text("""

            SELECT *

            FROM reportes_tema

            WHERE fecha::text = :fecha
            AND tema_id = :tema_id

            ORDER BY id DESC

            LIMIT 1

        """), {

            "fecha": fecha,
            "tema_id": tema_id

        }).mappings().fetchone()

        print("ROW:", row)

        if not row:
            return {}

        return dict(row)
    
# =====================================================
# FECHAS CON DATA
# =====================================================

@app.get("/api/reportextema/fechas")
def obtener_fechas():

    with engine.connect() as conn:

        rows = conn.execute(text("""

            SELECT DISTINCT fecha

            FROM reportes_tema

        """)).fetchall()

        return [

            r[0]

            for r in rows
        ]