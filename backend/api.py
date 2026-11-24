import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from threading import Thread
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import io
from pydantic import BaseModel

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "config.json"
CONFIG_EXAMPLE_PATH = ROOT_DIR / "config.example.json"
CV_PATH = ROOT_DIR / "profile" / "cv.md"
CV_EXAMPLE_PATH = ROOT_DIR / "profile" / "cv.example.md"
PROMPT_PATH = ROOT_DIR / "prompts" / "ats_optimizer.txt"
JOBS_DATA_PATH = ROOT_DIR / "data" / "jobs_analyzed.json"
JOBS_SCRAPED_PATH = ROOT_DIR / "data" / "jobs_scraped.json"

app = FastAPI(title="JobHunter AI API", version="2.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline_state = {
    "status": "idle",
    "phase": "ready",
    "started_at": None,
    "finished_at": None,
    "logs": [
        "[INFO] FastAPI + Gemini 2.5 engine listo.",
        "[INFO] Configura tus keywords o ejecuta el pipeline para extraer nuevas vacantes."
    ],
}


class ConfigModel(BaseModel):
    keywords: List[str]
    location: str
    time_filter: str = "r604800"
    max_per_keyword: int = 15
    headless: bool = True
    exclude_english: bool = True
    work_mode: str = "both"
    sources: List[str] = ["linkedin", "computrabajo", "getonboard"]
    ai_provider: str = "gemini"
    ai_model: str = "gemini-2.5-flash"
    min_match_score: int = 75
    temperature: float = 0.2
    api_keys: Optional[dict] = None


class TestConnectionPayload(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = ""


class TextPayload(BaseModel):
    content: str


class JobStatusPayload(BaseModel):
    applied: bool


def read_json_safe(path: Path, fallback_path: Optional[Path] = None):
    target = path if path.exists() else fallback_path
    if target and target.exists():
        return json.loads(target.read_text(encoding="utf-8"))
    return {}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "2.4.0",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "deepseek_configured": bool(os.getenv("DEEPSEEK_API_KEY")),
        "pipeline_status": pipeline_state["status"],
    }


@app.post("/api/ai/test")
def test_ai_connection(payload: TestConnectionPayload):
    provider = payload.provider.lower().strip()
    key = (payload.api_key or "").strip()
    if not key:
        env_var = "GEMINI_API_KEY" if provider == "gemini" else "DEEPSEEK_API_KEY"
        key = (os.getenv(env_var) or "").strip()

    if not key:
        return {
            "ok": False,
            "provider": provider,
            "message": f"Falta ingresar la API key de {provider.capitalize()}.",
        }

    start = time.perf_counter()
    try:
        if provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            req = urllib.request.Request(url, method="GET")
        elif provider == "deepseek":
            url = "https://api.deepseek.com/models"
            req = urllib.request.Request(
                url,
                method="GET",
                headers={"Authorization": f"Bearer {key}"},
            )
        else:
            return {"ok": False, "provider": provider, "message": "Proveedor no soportado."}

        with urllib.request.urlopen(req, timeout=8) as resp:
            latency_ms = int((time.perf_counter() - start) * 1000)
            if resp.status == 200:
                return {
                    "ok": True,
                    "provider": provider,
                    "model": payload.model,
                    "latency_ms": latency_ms,
                    "message": f"Conexión exitosa con {provider.capitalize()} ({latency_ms} ms).",
                }
            return {
                "ok": False,
                "provider": provider,
                "message": f"Respuesta inesperada (HTTP {resp.status}).",
            }
    except urllib.error.HTTPError as err:
        return {
            "ok": False,
            "provider": provider,
            "message": f"API key inválida o sin permisos (HTTP {err.code}).",
        }
    except Exception as exc:
        return {
            "ok": False,
            "provider": provider,
            "message": f"No se pudo conectar: {exc}",
        }


@app.get("/api/config")
def get_config():
    return read_json_safe(CONFIG_PATH, CONFIG_EXAMPLE_PATH)


def _save_env_key(env_var: str, value: str):
    env_path = ROOT_DIR / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    updated = False
    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{env_var}="):
            new_lines.append(f"{env_var}={value}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"{env_var}={value}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    os.environ[env_var] = value


@app.put("/api/config")
def update_config(payload: ConfigModel):
    data = payload.model_dump()
    api_keys = data.pop("api_keys", None) or {}
    if isinstance(api_keys, dict):
        if (api_keys.get("gemini") or "").strip():
            _save_env_key("GEMINI_API_KEY", api_keys["gemini"].strip())
        if (api_keys.get("deepseek") or "").strip():
            _save_env_key("DEEPSEEK_API_KEY", api_keys["deepseek"].strip())

    CONFIG_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"saved": True, "config": data}


@app.get("/api/cv")
def get_cv():
    target = CV_PATH if CV_PATH.exists() else CV_EXAMPLE_PATH
    content = target.read_text(encoding="utf-8") if target.exists() else ""
    return {"content": content, "path": str(target.relative_to(ROOT_DIR))}


@app.put("/api/cv")
def update_cv(payload: TextPayload):
    CV_PATH.parent.mkdir(parents=True, exist_ok=True)
    CV_PATH.write_text(payload.content, encoding="utf-8")
    return {"saved": True, "chars": len(payload.content)}


@app.post("/api/cv/upload-pdf")
async def upload_cv_pdf(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Por favor sube un archivo con extensión .pdf")
    try:
        from pypdf import PdfReader

        raw_bytes = await file.read()
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages_text = []
        for page in reader.pages:
            txt = (page.extract_text() or "").strip()
            if txt:
                pages_text.append(txt)

        extracted = "\n\n".join(pages_text).strip()
        if not extracted:
            raise HTTPException(
                status_code=400,
                detail="No se pudo extraer texto del PDF (verifica que no sea una imagen escaneada).",
            )

        CV_PATH.parent.mkdir(parents=True, exist_ok=True)
        CV_PATH.write_text(extracted, encoding="utf-8")
        return {
            "saved": True,
            "filename": file.filename,
            "pages": len(reader.pages),
            "chars": len(extracted),
            "content": extracted,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando PDF: {exc}")


@app.get("/api/prompt")
def get_prompt():
    content = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""
    return {"content": content}


@app.put("/api/prompt")
def update_prompt(payload: TextPayload):
    PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROMPT_PATH.write_text(payload.content, encoding="utf-8")
    return {"saved": True, "chars": len(payload.content)}


def _normalize_scraped_job(job: dict, idx: int) -> dict:
    company = job.get("company") or "Empresa"
    words = [w for w in company.split() if w]
    initials = (words[0][0] + (words[1][0] if len(words) > 1 else words[0][1:2])).upper() if words else "JB"
    desc = (job.get("description") or "").strip()
    preview = (desc[:340] + "...") if len(desc) > 340 else (desc or "Vacante extraída desde LinkedIn. Ejecuta la Fase 02 (IA) para generar el análisis ATS y bullets personalizados.")
    return {
        "id": str(job.get("id") or f"job-{idx + 1}"),
        "initials": initials[:2],
        "title": job.get("title") or "Sin título",
        "company": company,
        "location": job.get("location") or "No especificada",
        "salary": job.get("salary") or "",
        "matchScore": int(job.get("matchScore") or 0),
        "keyword": job.get("keyword") or "General",
        "source": job.get("source") or "LinkedIn",
        "postedAt": job.get("postedAt") or job.get("scraped_at") or "Reciente",
        "link": job.get("link") or "https://www.linkedin.com/jobs/",
        "applied": bool(job.get("applied", False)),
        "tags": job.get("tags") or [job.get("keyword") or "LinkedIn", "Fase 01"],
        "summary": job.get("summary") or preview,
        "gaps": job.get("gaps") or [],
        "gapSuggestion": job.get("gapSuggestion") or "Ejecuta la Fase 02 (Análisis ATS con Gemini/DeepSeek) para detectar palabras clave faltantes.",
        "bullets": job.get("bullets") or [
            "Vacante lista para análisis semántico contra tu CV (profile/cv.md).",
        ],
    }


def _requires_english(job: dict) -> bool:
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


FOREIGN_ONLY_TOKENS = (
    "santiago",
    "chile",
    "bogota",
    "bogotá",
    "medellin",
    "medellín",
    "colombia",
    "lima",
    "peru",
    "perú",
    "buenos aires",
    "buenos-aires",
    "argentina",
    "montevideo",
    "uruguay",
    "quito",
    "ecuador",
    "madrid",
    "barcelona",
    "españa",
)


def _is_foreign_ineligible(job: dict) -> bool:
    loc = (job.get("location") or "").lower()
    link = (job.get("link") or "").lower()
    combined = f"{loc} {link}"
    in_mexico = any(k in combined for k in ("tijuana", "mexico", "méxico", "baja california", "mx"))
    if in_mexico:
        return False
    has_foreign = any(tok in combined for tok in FOREIGN_ONLY_TOKENS)
    if has_foreign:
        return True
    return False


@app.get("/api/jobs")
def get_jobs():
    cfg = read_json_safe(CONFIG_PATH, CONFIG_EXAMPLE_PATH)
    exclude_english = bool(cfg.get("exclude_english", True))

    if JOBS_DATA_PATH.exists():
        raw = json.loads(JOBS_DATA_PATH.read_text(encoding="utf-8"))
        return [
            j
            for j in raw
            if not (exclude_english and _requires_english(j))
            and not _is_foreign_ineligible(j)
        ]
    if JOBS_SCRAPED_PATH.exists():
        raw = json.loads(JOBS_SCRAPED_PATH.read_text(encoding="utf-8"))
        filtered = [
            j
            for j in raw
            if not (exclude_english and _requires_english(j))
            and not _is_foreign_ineligible(j)
        ]
        return [_normalize_scraped_job(j, idx) for idx, j in enumerate(filtered)]
    return []


@app.patch("/api/jobs/{job_id}/status")
def toggle_job_status(job_id: str, payload: JobStatusPayload):
    target_path = JOBS_DATA_PATH if JOBS_DATA_PATH.exists() else JOBS_SCRAPED_PATH
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="No hay vacantes guardadas aún")
    jobs = json.loads(target_path.read_text(encoding="utf-8"))
    updated = False
    for job in jobs:
        if str(job.get("id")) == str(job_id):
            job["applied"] = payload.applied
            updated = True
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")
    target_path.write_text(
        json.dumps(jobs, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return {"updated": True, "id": job_id, "applied": payload.applied}


@app.post("/api/jobs/{job_id}/optimize")
def optimize_single_job(job_id: str):
    target_path = JOBS_DATA_PATH if JOBS_DATA_PATH.exists() else JOBS_SCRAPED_PATH
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="No hay vacantes guardadas aún")

    jobs = json.loads(target_path.read_text(encoding="utf-8"))
    target_job = None
    for job in jobs:
        if str(job.get("id")) == str(job_id):
            target_job = job
            break
    if not target_job:
        raise HTTPException(status_code=404, detail="Vacante no encontrada")

    cfg = read_json_safe(CONFIG_PATH, CONFIG_EXAMPLE_PATH)
    try:
        from ai_optimizer import optimize_bullets_for_job
        bullets = optimize_bullets_for_job(target_job, cfg)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    target_job["bullets"] = bullets
    target_job["optimized"] = True
    target_path.write_text(
        json.dumps(jobs, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return {"optimized": True, "id": job_id, "bullets": bullets}


def _run_pipeline_worker(phase: str, optimize_bullets: bool = False, include_phase1: bool = False):
    pipeline_state["status"] = "running"
    pipeline_state["phase"] = phase
    pipeline_state["started_at"] = datetime.now().isoformat()
    pipeline_state["logs"] = [f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando fase: {phase}"]

    extra_args = []
    if phase == "all" or (phase == "optimize" and include_phase1):
        script = ROOT_DIR / "run_pipeline.py"
        if optimize_bullets:
            extra_args.append("--optimize")
    elif phase == "scrape":
        script = ROOT_DIR / "multi_scraper.py"
    elif phase == "optimize":
        script = ROOT_DIR / "ai_optimizer.py"
        if optimize_bullets:
            extra_args.append("--optimize")
    else:
        script = ROOT_DIR / "txt_to_html.py"

    if not script.exists():
        pipeline_state["logs"].append(f"[ERROR] No se encontró el script {script.name}")
        pipeline_state["status"] = "error"
        pipeline_state["finished_at"] = datetime.now().isoformat()
        return

    try:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        proc = subprocess.Popen(
            [sys.executable, "-u", str(script)] + extra_args,
            cwd=str(ROOT_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            pipeline_state["logs"].append(line.rstrip())
        proc.wait()
        pipeline_state["status"] = "completed" if proc.returncode == 0 else "error"
    except Exception as exc:
        pipeline_state["logs"].append(f"[ERROR] {exc}")
        pipeline_state["status"] = "error"
    finally:
        pipeline_state["finished_at"] = datetime.now().isoformat()


@app.post("/api/pipeline/run")
def run_pipeline(
    phase: str = "all",
    optimize_bullets: bool = False,
    include_phase1: bool = False,
):
    if pipeline_state["status"] == "running":
        raise HTTPException(status_code=409, detail="El pipeline ya está en ejecución")
    Thread(
        target=_run_pipeline_worker,
        args=(phase, optimize_bullets, include_phase1),
        daemon=True,
    ).start()
    return {
        "started": True,
        "phase": phase,
        "optimize_bullets": optimize_bullets,
        "include_phase1": include_phase1,
    }


@app.get("/api/pipeline/status")
def get_pipeline_status():
    return pipeline_state
