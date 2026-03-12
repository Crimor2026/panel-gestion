from sqlalchemy import text
from database import engine
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Datos del administrador
nombre = "Administrador"
email = "admin@panel.com"
password_plano = "Admin2026!"

password_hash = pwd_context.hash(password_plano)

with engine.connect() as connection:
    connection.execute(
        text("""
            INSERT INTO usuarios (nombre, email, password_hash, rol)
            VALUES (:nombre, :email, :password_hash, :rol)
        """),
        {
            "nombre": nombre,
            "email": email,
            "password_hash": password_hash,
            "rol": "admin"
        }
    )
    connection.commit()

print("Usuario administrador creado correctamente")