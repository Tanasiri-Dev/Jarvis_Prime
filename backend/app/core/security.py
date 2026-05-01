from typing import cast

from passlib.context import CryptContext

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return cast(str, password_context.hash(password))


def verify_password(password: str, password_hash: str) -> bool:
    return cast(bool, password_context.verify(password, password_hash))
