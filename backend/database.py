import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# =========================================
# CONEXIÓN A BASE DE DATOS
# =========================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://panel_user:Panel2026!@localhost/panel_gestion"
)

# Motor de SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

# Sesión de base de datos
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# =========================================
# DEPENDENCIA FASTAPI
# =========================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()