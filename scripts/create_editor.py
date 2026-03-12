from database import engine
from sqlalchemy import text
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

nombre = "Analista PMO"
email = "analista@panel.com"
password_plano = "Analista2026!"
rol = "editor"

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
            "rol": rol
        }
    )
    connection.commit()

print("Usuario editor creado correctamente")