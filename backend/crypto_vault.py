import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from dotenv import dotenv_values

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
VAULT_KEY_PATH = ROOT_DIR / ".vault.key"

SECRET_ENV_VARS = (
    "GEMINI_API_KEY",
    "DEEPSEEK_API_KEY",
    "DISCORD_WEBHOOK_URL",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
)

PLACEHOLDERS = {
    "tu_api_key_de_gemini_aqui",
    "tu_api_key_de_deepseek_aqui",
}


def _get_fernet() -> Fernet:
    if VAULT_KEY_PATH.exists():
        key = VAULT_KEY_PATH.read_bytes().strip()
    else:
        key = Fernet.generate_key()
        VAULT_KEY_PATH.write_bytes(key)
    return Fernet(key)


def encrypt_value(plain: str) -> str:
    val = (plain or "").strip()
    if not val:
        return ""
    if val.startswith("enc:"):
        return val
    token = _get_fernet().encrypt(val.encode("utf-8")).decode("utf-8")
    return f"enc:{token}"


def decrypt_value(stored: str) -> str:
    val = (stored or "").strip()
    if not val or val in PLACEHOLDERS:
        return ""
    if val.startswith("enc:"):
        token = val[4:].strip()
        try:
            return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
        except (InvalidToken, Exception):
            return ""
    return val


def mask_secret(plain: str) -> str:
    val = (plain or "").strip()
    if not val:
        return ""
    if len(val) <= 8:
        return "•" * len(val)
    return f"{val[:4]}••••••••{val[-4:]}"


def get_decrypted_env(env_var: str) -> str:
    if ENV_PATH.exists():
        values = dotenv_values(ENV_PATH)
        raw = values.get(env_var)
        if raw is not None:
            return decrypt_value(raw)
    return decrypt_value(os.getenv(env_var) or "")


def save_encrypted_env(env_var: str, plain_value: str) -> None:
    clean = (plain_value or "").strip()
    if not clean or clean in PLACEHOLDERS:
        return
    encrypted = encrypt_value(clean)
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []
    updated = False
    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{env_var}="):
            new_lines.append(f"{env_var}={encrypted}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"{env_var}={encrypted}")
    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    os.environ[env_var] = encrypted


def migrate_plaintext_env() -> int:
    """Encripta automáticamente cualquier credencial en texto plano existente en .env."""
    if not ENV_PATH.exists():
        return 0
    values = dotenv_values(ENV_PATH)
    migrated = 0
    for var in SECRET_ENV_VARS:
        raw = (values.get(var) or "").strip()
        if raw and raw not in PLACEHOLDERS and not raw.startswith("enc:"):
            save_encrypted_env(var, raw)
            migrated += 1
    return migrated
