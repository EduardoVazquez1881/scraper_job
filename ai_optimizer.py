import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import List

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
    env_var = "DEEPSEEK_API_KEY" if provider == "deepseek" else "GEMINI_API_KEY"
    try:
        from backend.crypto_vault import get_decrypted_env

        return get_decrypted_env(env_var)
    except Exception:
        load_dotenv(ROOT_DIR / ".env", override=True)
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
        with urllib.request.urlopen(req, timeout=60) as resp:
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
        with urllib.request.urlopen(req, timeout=75) as resp:
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


def _format_analyzed_item(job: dict, result: dict, provider: str, model: str, optimize_bullets: bool) -> dict:
    score = max(0, min(100, int(result.get("matchScore", 0))))
    bullets = result.get("bullets") if optimize_bullets else (job.get("bullets") or [])
    if not isinstance(bullets, list):
        bullets = []
    # Limpiar placeholder de Fase 01 si no fue optimizado
    if len(bullets) == 1 and "lista para análisis semántico" in bullets[0]:
        bullets = []

    return {
        "id": str(job.get("id") or "job-1"),
        "url_hash": job.get("url_hash"),
        "initials": _company_initials(job.get("company") or ""),
        "title": job.get("title") or "Sin título",
        "company": job.get("company") or "Empresa",
        "location": job.get("location") or "No especificada",
        "salary": job.get("salary") or "",
        "matchScore": score,
        "keyword": job.get("keyword") or "General",
        "source": job.get("source") or "LinkedIn",
        "postedAt": job.get("postedAt") or job.get("scraped_at") or "Reciente",
        "scraped_at": job.get("scraped_at") or "",
        "link": job.get("link") or "https://www.linkedin.com/jobs/",
        "applied": bool(job.get("applied", False)),
        "status": job.get("status") or ("applied" if job.get("applied") else "pending"),
        "notes": job.get("notes") or "",
        "description": job.get("description") or "",
        "analyzed": True,
        "tags": (result.get("tags") or [job.get("keyword") or "Tech"])[:6],
        "summary": result.get("summary") or "Análisis completado.",
        "gaps": (result.get("gaps") or [])[:5],
        "gapSuggestion": result.get("gapSuggestion") or "",
        "bullets": bullets,
        "optimized": bool(len(bullets) > 0),
        "analyzedBy": f"{provider.capitalize()} ({model})",
        "outreachMessage": job.get("outreachMessage") or "",
    }


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
    return _format_analyzed_item(job, result, provider, model, optimize_bullets)


def analyze_jobs_batch(
    batch: List[dict], cv_text: str, cfg: dict, optimize_bullets: bool = False
) -> List[dict]:
    """Analiza un lote de hasta 4 vacantes en una sola llamada para ahorrar ~70% de tokens del CV."""
    if len(batch) == 1:
        return [analyze_job(batch[0], cv_text, cfg, optimize_bullets=optimize_bullets)]

    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    temperature = float(cfg.get("temperature", 0.2))
    api_key = _get_api_key(provider)
    if not api_key:
        raise RuntimeError(
            f"Falta configurar la API key de {provider.capitalize()} en Búsqueda & Config o en .env."
        )

    jobs_payload = [
        {
            "job_index": idx,
            "title": j.get("title", ""),
            "company": j.get("company", ""),
            "location": j.get("location", ""),
            "source": j.get("source", ""),
            "description": (j.get("description") or "")[:2400],
        }
        for idx, j in enumerate(batch)
    ]

    bullets_desc = (
        '["3 bullets optimizados en español usando **negritas** en tecnologías y métricas reales del CV"]'
        if optimize_bullets
        else "[]"
    )

    prompt = f"""Analiza este lote de {len(batch)} vacantes contra el CV del candidato y responde ÚNICAMENTE con un objeto JSON válido en español.

REGLA CRÍTICA DE UBICACIÓN Y ELEGIBILIDAD:
- El candidato reside en Tijuana, Baja California, México.
- Si una vacante es presencial, híbrida o exige residencia en OTRO país distinto a México (Chile, Santiago, Colombia, Argentina, Perú, España, Uruguay), asigna un matchScore máximo de 25 y adviértelo al inicio del summary.
- Solo otorga puntajes altos (>75) si la vacante es en Tijuana/México o 100% remota abierta a México/LATAM.

CV DEL CANDIDATO:
{cv_text[:5000]}

LOTE DE VACANTES (JSON):
{json.dumps(jobs_payload, ensure_ascii=False)}

DEVUELVE EXACTAMENTE ESTE OBJETO JSON CON UN ARREGLO "results" DEL MISMO TAMAÑO ({len(batch)} elementos):
{{
  "results": [
    {{
      "job_index": 0,
      "matchScore": 0,
      "tags": ["3 a 5 tecnologías clave"],
      "summary": "Resumen breve (2-3 líneas) sobre compatibilidad real.",
      "gaps": ["2 a 4 palabras clave faltantes"],
      "gapSuggestion": "Sugerencia práctica de 1 línea.",
      "bullets": {bullets_desc}
    }}
  ]
}}
"""
    raw = _call_llm_json(provider, model, api_key, prompt, temperature=temperature)
    results_list = raw.get("results") if isinstance(raw, dict) else (raw if isinstance(raw, list) else None)
    if not isinstance(results_list, list) or len(results_list) != len(batch):
        raise ValueError("Respuesta batch incompleta, usando fallback individual")

    by_idx = {int(r.get("job_index", i)): r for i, r in enumerate(results_list)}
    formatted = []
    for i, job in enumerate(batch):
        res_item = by_idx.get(i, results_list[i])
        formatted.append(_format_analyzed_item(job, res_item, provider, model, optimize_bullets))
    return formatted


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


def generate_outreach_for_job(job: dict, cfg: dict) -> str:
    """Genera un mensaje corto y directo (3-4 líneas) para contactar al reclutador por LinkedIn o correo."""
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    api_key = _get_api_key(provider)
    if not api_key:
        raise RuntimeError(
            f"Falta configurar la API key de {provider.capitalize()} en Búsqueda & Config o en .env."
        )

    cv_text = _load_cv()
    prompt = f"""Redacta un mensaje breve, humano y directo en español (máximo 4 líneas, sin emojis ni lenguaje robótico) para enviar por LinkedIn o correo al reclutador de esta vacante.

REGLAS:
- Menciona el puesto exacto y la empresa.
- Conecta con 1 o 2 experiencias/proyectos reales del CV que mejor encajen con la vacante.
- Cierra incluyendo de forma natural el enlace a su portafolio o GitHub (únicamente si aparece en el CV) y disposición para conversar.
- NO inventes años de experiencia ni tecnologías que no estén en el CV.

CV DEL CANDIDATO:
{cv_text[:4500]}

VACANTE:
Título: {job.get('title', '')}
Empresa: {job.get('company', '')}
Ubicación: {job.get('location', '')}
Resumen / Descripción:
{(job.get('description') or job.get('summary') or '')[:2500]}

Devuelve ÚNICAMENTE este JSON válido:
{{
  "message": "Hola, vi la vacante de..."
}}
"""
    result = _call_llm_json(provider, model, api_key, prompt, temperature=0.35)
    return str(result.get("message") or "").strip()


def suggest_keywords_from_cv(cfg: dict, api_key_override: str = "") -> dict:
    """Analiza el CV actual y genera keywords de búsqueda en español adaptadas al perfil y nivel."""
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    api_key = (api_key_override or "").strip() or _get_api_key(provider)
    if not api_key:
        raise RuntimeError(
            f"Falta configurar la API key de {provider.capitalize()} en Búsqueda & Config o en .env."
        )

    cv_text = _load_cv()
    if not cv_text.strip():
        raise RuntimeError("El CV está vacío. Sube o redacta tu CV en Mi Perfil & CV primero.")

    prompt = f"""Analiza el siguiente CV y deduce con precisión:
1. El nivel profesional real del candidato (ej. "Practicante / Becario", "Junior", "Mid-Level", "Senior", o "Recién egresado").
2. Su área o especialidad principal.
3. Entre 5 y 7 keywords cortas de búsqueda de empleo en español (de 1 a 3 palabras cada una) ideales para buscar en LinkedIn, Computrabajo MX e Indeed MX, adaptadas exactamente a su experiencia, stack/profesión y nivel actual.

REGLAS PARA LAS KEYWORDS:
- Deben ser términos reales que usan las empresas en títulos de vacantes en México (ej. "Desarrollador Backend Junior", "Programador Python", "Psicólogo Clínico", "Terapeuta Físico").
- NO incluyas keywords en inglés puro si existen equivalentes comunes en español, salvo tecnologías propias (Python, React, FastAPI, SQL).
- NO sugieras puestos Senior si el perfil es Junior o Practicante, ni viceversa.
- Devuelve términos concisos (sin ciudad ni palabras como "tiempo completo").

CV DEL CANDIDATO:
{cv_text[:5000]}

Devuelve ÚNICAMENTE este JSON válido:
{{
  "detected_level": "Nivel detectado",
  "detected_area": "Área principal",
  "keywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4", "Keyword 5"]
}}
"""
    result = _call_llm_json(provider, model, api_key, prompt, temperature=0.25)
    raw_kws = result.get("keywords") or []
    cleaned_kws = []
    seen = set()
    for kw in raw_kws:
        s = str(kw).strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            cleaned_kws.append(s)

    return {
        "ok": True,
        "detected_level": str(result.get("detected_level") or "No especificado").strip(),
        "detected_area": str(result.get("detected_area") or "General").strip(),
        "keywords": cleaned_kws[:8],
    }


def run_phase2(optimize_bullets: bool = False, force_reanalyze: bool = False):
    cfg = load_config()
    provider = (cfg.get("ai_provider") or "gemini").lower()
    model = cfg.get("ai_model") or ("deepseek-chat" if provider == "deepseek" else "gemini-2.5-flash")
    batch_size = max(1, min(6, int(cfg.get("batch_size") or 4)))

    # Cargar desde SQLite si está disponible, con fallback transparente a JSON
    use_sqlite = False
    all_jobs = []
    try:
        from backend.db import get_all_jobs

        all_jobs = get_all_jobs(include_discarded=True)
        if all_jobs:
            use_sqlite = True
    except Exception:
        use_sqlite = False

    if not all_jobs:
        if not SCRAPED_PATH.exists():
            print("[ERROR] No existe data/jobs_scraped.json. Ejecuta primero la Fase 01.", flush=True)
            sys.exit(1)
        all_jobs = json.loads(SCRAPED_PATH.read_text(encoding="utf-8"))

    if not all_jobs:
        print("[WARN] No hay vacantes disponibles para analizar.", flush=True)
        return []

    to_analyze = [
        j
        for j in all_jobs
        if j.get("status") != "discarded"
        and (force_reanalyze or not j.get("analyzed") or (optimize_bullets and not j.get("optimized")))
    ]
    cached_count = len(all_jobs) - len(to_analyze)

    cv_text = _load_cv()
    mode_label = (
        "Análisis ATS + Optimización de Bullets"
        if optimize_bullets
        else "Solo Análisis ATS (sin optimizar bullets)"
    )

    print("=" * 60, flush=True)
    print(f"[INFO] FASE 02: {mode_label}", flush=True)
    print(
        f"[INFO] Proveedor: {provider.capitalize()} | Modelo: {model} | Lote (batch): {batch_size}",
        flush=True,
    )
    print(
        f"[INFO] Pendientes de análisis: {len(to_analyze)} | En caché SQLite (ahorro de tokens): {cached_count}",
        flush=True,
    )
    print("=" * 60, flush=True)

    newly_analyzed = []
    for start in range(0, len(to_analyze), batch_size):
        chunk = to_analyze[start : start + batch_size]
        end_idx = start + len(chunk)
        print(
            f"[INFO] Procesando lote [{start + 1}-{end_idx}/{len(to_analyze)}] ({len(chunk)} vacantes en 1 request)...",
            flush=True,
        )
        try:
            batch_results = analyze_jobs_batch(
                chunk, cv_text, cfg, optimize_bullets=optimize_bullets
            )
            newly_analyzed.extend(batch_results)
            for item in batch_results:
                print(
                    f"    [OK] {item['title'][:45]} @ {item['company']} -> Match: {item['matchScore']}%",
                    flush=True,
                )
        except urllib.error.HTTPError as err:
            print(f"    [ERROR] Error HTTP {err.code} con {provider}: {err.reason}", flush=True)
            if err.code in (401, 403):
                print("[ERROR] API key inválida o sin permisos. Deteniendo Fase 02.", flush=True)
                sys.exit(1)
        except Exception as batch_exc:
            print(f"    [WARN] Lote falló ({batch_exc}), reintentando individualmente...", flush=True)
            for job in chunk:
                try:
                    item = analyze_job(job, cv_text, cfg, optimize_bullets=optimize_bullets)
                    newly_analyzed.append(item)
                    print(
                        f"    [OK] {item['title'][:45]} -> Match: {item['matchScore']}%",
                        flush=True,
                    )
                except Exception as single_exc:
                    print(f"    [WARN] Omitida '{job.get('title', '')[:40]}': {single_exc}", flush=True)

    if use_sqlite and newly_analyzed:
        from backend.db import get_pending_alert_jobs, mark_alerts_sent, upsert_analyzed_jobs

        final_jobs = upsert_analyzed_jobs(newly_analyzed)

        # Disparar alertas automáticas Discord/Telegram si están configuradas
        alert_min = int(cfg.get("alert_min_score") or 85)
        pending_alerts = get_pending_alert_jobs(min_score=alert_min)
        if pending_alerts:
            try:
                from backend.notifier import dispatch_high_match_alerts

                alert_res = dispatch_high_match_alerts(pending_alerts, min_score=alert_min)
                if alert_res.get("sent"):
                    mark_alerts_sent([j["id"] for j in pending_alerts])
                    print(
                        f"[OK] Alerta enviada ({alert_res.get('count')} vacantes >= {alert_min}% Match).",
                        flush=True,
                    )
            except Exception as alert_exc:
                print(f"[WARN] No se pudo enviar alerta webhook: {alert_exc}", flush=True)
    elif newly_analyzed:
        newly_analyzed.sort(key=lambda x: x.get("matchScore", 0), reverse=True)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        ANALYZED_PATH.write_text(
            json.dumps(newly_analyzed, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        final_jobs = newly_analyzed
    else:
        final_jobs = all_jobs

    print("=" * 60, flush=True)
    print(
        f"[OK] FASE 02 COMPLETADA: {len(newly_analyzed)} vacantes analizadas en esta corrida "
        f"({cached_count} recuperadas desde caché sin gastar tokens).",
        flush=True,
    )
    print("=" * 60, flush=True)
    return final_jobs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fase 02 — Análisis ATS con Gemini o DeepSeek")
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Generar también bullets optimizados durante el análisis masivo",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-analizar incluso vacantes ya almacenadas en caché SQLite",
    )
    args = parser.parse_args()
    run_phase2(optimize_bullets=args.optimize, force_reanalyze=args.force)
