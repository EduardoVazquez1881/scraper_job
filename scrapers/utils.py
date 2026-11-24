import json
import re
import unicodedata
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "config.json"
CONFIG_EXAMPLE_PATH = ROOT_DIR / "config.example.json"
DATA_DIR = ROOT_DIR / "data"


def load_config() -> dict:
    target = CONFIG_PATH if CONFIG_PATH.exists() else CONFIG_EXAMPLE_PATH
    if target.exists():
        with open(target, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "keywords": ["Desarrollador Backend", "Desarrollador Full Stack"],
        "location": "Tijuana, Baja California, Mexico",
        "time_filter": "1w",
        "max_per_keyword": 10,
        "headless": True,
        "exclude_english": True,
        "sources": ["linkedin", "computrabajo", "getonboard"],
    }


def slugify(text: str) -> str:
    norm = unicodedata.normalize("NFD", text.lower().strip())
    no_accents = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", no_accents).strip("-")


def strip_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def requires_english(job: dict) -> bool:
    """Devuelve True si la vacante está redactada en inglés o exige inglés."""
    desc = job.get("description") or job.get("summary") or ""
    text = f"{job.get('title', '')} {desc}"
    if desc:
        es_words = len(
            re.findall(
                r"\b(para|con|los|las|que|una|del|por|como|experiencia|requisitos|buscamos|conocimientos|desarrollo)\b",
                desc,
                re.I,
            )
        )
        en_words = len(
            re.findall(
                r"\b(the|and|with|for|you|our|will|experience|requirements|skills|team|responsibilities)\b",
                desc,
                re.I,
            )
        )
        if en_words > es_words and en_words >= 6:
            return True

    english_req_pattern = re.compile(
        r"(ingl[eé]s\s*(avanzado|intermedio|conversacional|fluido|b2|c1|t[eé]cnico\s*avanzado|indispensable|requerido|obligatorio|80%|90%|100%)"
        r"|nivel\s+de\s+ingl[eé]s"
        r"|dominio\s+del\s+ingl[eé]s"
        r"|biling[uü]e|bilingual|fluent\s+english|english\s+required)",
        re.I,
    )
    return bool(english_req_pattern.search(text))
