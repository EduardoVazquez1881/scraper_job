import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

from scrapers.utils import DATA_DIR, ROOT_DIR, load_config

load_dotenv(ROOT_DIR / ".env")

CV_PATH = ROOT_DIR / "profile" / "cv.md"
CV_EXAMPLE_PATH = ROOT_DIR / "profile" / "cv.example.md"
PROMPT_PATH = ROOT_DIR / "prompts" / "ats_optimizer.txt"
SCRAPED_PATH = DATA_DIR / "jobs_scraped.json"
ANALYZED_PATH = DATA_DIR / "jobs_analyzed.json"


def _load_cv() -> str:
    target = CV_PATH if CV_PATH.exists() else CV_EXAMPLE_PATH
    if target.exists():
        return target.read_text(encoding="utf-8")
    return ""


def _get_api_key(provider: str) -> str:
    load_dotenv(ROOT_DIR / ".env", override=True)
    env_var = "DEEPSEEK_API_KEY" if provider == "deepseek" else "GEMINI_API_KEY"
    return (os.getenv(env_var) or "").strip()


def _extract_json(raw_text: str):
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    return json.loads(cleaned)


def _call_llm_json(provider: str, model: str, api_key: str, prompt: str, temperature: float = 0.2):
    provider = provider.lower().strip()
    if provider == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _extract_json(text)

    if provider == "deepseek":
        url = "https://api.deepseek.com/chat/completions"
        body = {
            "model": model or "deepseek-chat",
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un evaluador ATS técnico. Responde estrictamente con JSON válido en español.",
                },
                {"role": "user", "content": prompt},
            ],
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["choices"][0]["message"]["content"]
        return _extract_json(text)

    raise ValueError(f"Proveedor de IA no soportado: {provider}")


def _company_initials(company: str) -> str:
    words = [w for w in (company or "JB").split() if w]
    if not words:
        return "JB"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def analyze_job(job: dict, cv_text: str, cfg: dict, optimize_bullets: bool = False) -> dict:
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    temperature = float(cfg.get("temperature", 0.2))
    api_key = _get_api_key(provider)
    if not api_key:
        raise RuntimeError(
            f"Falta configurar la API key de {provider.capitalize()} en Búsqueda & Config o en .env."
        )

    bullets_instruction = (
        '"bullets": ["3 bullets optimizados en español usando **negritas** en tecnologías y métricas reales del CV"]'
        if optimize_bullets
        else '"bullets": []'
    )

    prompt = f"""Analiza la siguiente vacante contra el CV del candidato y responde ÚNICAMENTE con un objeto JSON válido en español.

REGLA CRÍTICA DE UBICACIÓN Y ELEGIBILIDAD:
- El candidato reside en Tijuana, Baja California, México.
- Si la vacante es presencial, híbrida o exige residencia en OTRO país distinto a México (por ejemplo: Chile, Santiago, Colombia, Argentina, Perú, España, Uruguay), el candidato NO es elegible: asigna un matchScore máximo de 25 y adviértelo al inicio del summary.
- Solo otorga puntajes altos (>75) si la vacante es en Tijuana/México o 100% remota abierta a México/LATAM.

CV DEL CANDIDATO:
{cv_text[:5000]}

VACANTE:
Título: {job.get('title', '')}
Empresa: {job.get('company', '')}
Ubicación: {job.get('location', '')}
Fuente: {job.get('source', 'LinkedIn')}
Descripción:
{(job.get('description') or '')[:4000]}

DEVUELVE EXACTAMENTE ESTE JSON:
{{
  "matchScore": 0,
  "tags": ["3 a 5 tecnologías clave de la vacante"],
  "summary": "Resumen breve (2-3 líneas) explicando la compatibilidad real y recomendación concreta.",
  "gaps": ["2 a 4 palabras clave o requisitos faltantes en el CV"],
  "gapSuggestion": "Sugerencia práctica de 1 línea para mejorar el perfil frente a esta vacante.",
  {bullets_instruction}
}}
"""
    result = _call_llm_json(provider, model, api_key, prompt, temperature=temperature)
    score = max(0, min(100, int(result.get("matchScore", 0))))
    bullets = result.get("bullets") if optimize_bullets else []
    if not isinstance(bullets, list):
        bullets = []

    return {
        "id": str(job.get("id") or "job-1"),
        "initials": _company_initials(job.get("company") or ""),
        "title": job.get("title") or "Sin título",
        "company": job.get("company") or "Empresa",
        "location": job.get("location") or "No especificada",
        "salary": job.get("salary") or "",
        "matchScore": score,
        "keyword": job.get("keyword") or "General",
        "source": job.get("source") or "LinkedIn",
        "postedAt": job.get("postedAt") or job.get("scraped_at") or "Reciente",
        "link": job.get("link") or "https://www.linkedin.com/jobs/",
        "applied": bool(job.get("applied", False)),
        "description": job.get("description") or "",
        "tags": (result.get("tags") or [job.get("keyword") or "Tech"])[:6],
        "summary": result.get("summary") or "Análisis completado.",
        "gaps": (result.get("gaps") or [])[:5],
        "gapSuggestion": result.get("gapSuggestion") or "",
        "bullets": bullets,
        "optimized": bool(optimize_bullets and len(bullets) > 0),
        "analyzedBy": f"{provider.capitalize()} ({model})",
    }


def optimize_bullets_for_job(job: dict, cfg: dict) -> list:
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    temperature = float(cfg.get("temperature", 0.2))
    api_key = _get_api_key(provider)
    if not api_key:
        raise RuntimeError(
            f"Falta configurar la API key de {provider.capitalize()} en Búsqueda & Config o en .env."
        )

    cv_text = _load_cv()
    custom_prompt = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""

    prompt = f"""{custom_prompt}

CV DEL CANDIDATO:
{cv_text[:5000]}

VACANTE OBJETIVO:
Título: {job.get('title', '')}
Empresa: {job.get('company', '')}
Descripción / Resumen:
{(job.get('description') or job.get('summary') or '')[:3500]}

Devuelve ÚNICAMENTE un JSON válido con 3 bullets optimizados para el CV del candidato (sin inventar experiencia falsa, usando **negritas** en tecnologías y métricas):
{{
  "bullets": [
    "Bullet 1...",
    "Bullet 2...",
    "Bullet 3..."
  ]
}}
"""
    result = _call_llm_json(provider, model, api_key, prompt, temperature=temperature)
    bullets = result.get("bullets") or []
    return [str(b) for b in bullets][:4]


def run_phase2(optimize_bullets: bool = False):
    cfg = load_config()
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")

    if not SCRAPED_PATH.exists():
        print("[ERROR] No existe data/jobs_scraped.json. Ejecuta primero la Fase 01.", flush=True)
        sys.exit(1)

    scraped_jobs = json.loads(SCRAPED_PATH.read_text(encoding="utf-8"))
    if not scraped_jobs:
        print("[WARN] No hay vacantes en data/jobs_scraped.json para analizar.", flush=True)
        return []

    cv_text = _load_cv()
    mode_label = "Análisis ATS + Optimización de Bullets" if optimize_bullets else "Solo Análisis ATS (sin optimizar bullets)"

    print("=" * 60, flush=True)
    print(f"[INFO] FASE 02: {mode_label}", flush=True)
    print(f"[INFO] Proveedor: {provider.capitalize()} | Modelo: {model} | Vacantes: {len(scraped_jobs)}", flush=True)
    print("=" * 60, flush=True)

    analyzed = []
    for idx, job in enumerate(scraped_jobs, 1):
        title = (job.get("title") or "Sin título")[:52]
        company = job.get("company") or "Empresa"
        print(f"[INFO] [{idx}/{len(scraped_jobs)}] Analizando: {title} @ {company}...", flush=True)
        try:
            item = analyze_job(job, cv_text, cfg, optimize_bullets=optimize_bullets)
            analyzed.append(item)
            print(f"    [OK] Match ATS: {item['matchScore']}% | Brechas: {len(item['gaps'])}", flush=True)
        except urllib.error.HTTPError as err:
            print(f"    [ERROR] Error HTTP {err.code} con {provider}: {err.reason}", flush=True)
            if err.code in (401, 403):
                print("[ERROR] API key inválida o sin permisos. Deteniendo Fase 02.", flush=True)
                sys.exit(1)
        except Exception as exc:
            print(f"    [WARN] No se pudo analizar esta vacante: {exc}", flush=True)

    analyzed.sort(key=lambda x: x.get("matchScore", 0), reverse=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ANALYZED_PATH.write_text(
        json.dumps(analyzed, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print("=" * 60, flush=True)
    print(f"[OK] FASE 02 COMPLETADA: {len(analyzed)} vacantes analizadas y guardadas en jobs_analyzed.json.", flush=True)
    print("=" * 60, flush=True)
    return analyzed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fase 02 — Análisis ATS con Gemini o DeepSeek")
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Generar también bullets optimizados durante el análisis masivo",
    )
    args = parser.parse_args()
    run_phase2(optimize_bullets=args.optimize)
