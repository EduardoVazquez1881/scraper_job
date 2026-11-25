import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "jobhunter.db"
ANALYZED_JSON_PATH = DATA_DIR / "jobs_analyzed.json"
SCRAPED_JSON_PATH = DATA_DIR / "jobs_scraped.json"


def _compute_url_hash(job: dict) -> str:
    link = (job.get("link") or "").strip().split("?")[0].rstrip("/").lower()
    if link and link != "https://www.linkedin.com/jobs":
        raw = link
    else:
        raw = f"{(job.get('title') or '').strip().lower()}|{(job.get('company') or '').strip().lower()}|{(job.get('location') or '').strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _company_initials(company: str) -> str:
    words = [w for w in (company or "JB").split() if w]
    if not words:
        return "JB"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                url_hash TEXT UNIQUE NOT NULL,
                link TEXT,
                title TEXT,
                company TEXT,
                initials TEXT,
                location TEXT,
                salary TEXT,
                keyword TEXT,
                source TEXT,
                posted_at TEXT,
                scraped_at TEXT,
                description TEXT,
                analyzed INTEGER DEFAULT 0,
                match_score INTEGER DEFAULT 0,
                tags_json TEXT DEFAULT '[]',
                summary TEXT DEFAULT '',
                gaps_json TEXT DEFAULT '[]',
                gap_suggestion TEXT DEFAULT '',
                bullets_json TEXT DEFAULT '[]',
                optimized INTEGER DEFAULT 0,
                analyzed_by TEXT DEFAULT '',
                outreach_message TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                applied INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                alert_sent INTEGER DEFAULT 0,
                updated_at TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(match_score DESC)")
        conn.commit()

    _bootstrap_from_existing_json()


def _bootstrap_from_existing_json():
    """Importa vacantes previas en JSON a SQLite la primera vez para no perder nada."""
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        if count > 0:
            return

    if ANALYZED_JSON_PATH.exists():
        try:
            items = json.loads(ANALYZED_JSON_PATH.read_text(encoding="utf-8"))
            if isinstance(items, list) and items:
                upsert_analyzed_jobs(items)
                return
        except Exception:
            pass

    if SCRAPED_JSON_PATH.exists():
        try:
            items = json.loads(SCRAPED_JSON_PATH.read_text(encoding="utf-8"))
            if isinstance(items, list) and items:
                upsert_scraped_jobs(items)
        except Exception:
            pass


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    desc = (d.get("description") or "").strip()
    preview = (
        (desc[:340] + "...")
        if len(desc) > 340
        else (desc or "Vacante extraída. Ejecuta la Fase 02 (IA) para obtener análisis ATS.")
    )
    analyzed = bool(d.get("analyzed"))
    tags = json.loads(d.get("tags_json") or "[]")
    if not tags:
        tags = [d.get("keyword") or d.get("source") or "Vacante"]
        if not analyzed:
            tags.append("Fase 01")

    bullets = json.loads(d.get("bullets_json") or "[]")
    status = d.get("status") or ("applied" if d.get("applied") else "pending")
    applied = bool(d.get("applied")) or status in ("applied", "interview")

    return {
        "id": d["id"],
        "url_hash": d["url_hash"],
        "initials": d.get("initials") or _company_initials(d.get("company") or ""),
        "title": d.get("title") or "Sin título",
        "company": d.get("company") or "Empresa",
        "location": d.get("location") or "No especificada",
        "salary": d.get("salary") or "",
        "matchScore": int(d.get("match_score") or 0),
        "keyword": d.get("keyword") or "General",
        "source": d.get("source") or "LinkedIn",
        "postedAt": d.get("posted_at") or d.get("scraped_at") or "Reciente",
        "scraped_at": d.get("scraped_at") or "",
        "link": d.get("link") or "https://www.linkedin.com/jobs/",
        "description": desc,
        "analyzed": analyzed,
        "tags": tags,
        "summary": (d.get("summary") or "").strip() or preview,
        "gaps": json.loads(d.get("gaps_json") or "[]"),
        "gapSuggestion": (d.get("gap_suggestion") or "").strip()
        or (
            ""
            if analyzed
            else "Ejecuta la Fase 02 (Análisis ATS) para detectar brechas de palabras clave."
        ),
        "bullets": bullets,
        "optimized": bool(d.get("optimized")) and len(bullets) > 0,
        "analyzedBy": d.get("analyzed_by") or "",
        "outreachMessage": d.get("outreach_message") or "",
        "status": status,
        "applied": applied,
        "notes": d.get("notes") or "",
        "alertSent": bool(d.get("alert_sent")),
    }


def upsert_scraped_jobs(jobs: List[dict]) -> Tuple[List[dict], int, int]:
    """Inserta vacantes nuevas en SQLite sin sobrescribir análisis, notas ni estado de las ya existentes."""
    init_db()
    now = datetime.now().isoformat()
    inserted = 0
    existing = 0

    with get_conn() as conn:
        for job in jobs:
            uhash = _compute_url_hash(job)
            row = conn.execute(
                "SELECT id FROM jobs WHERE url_hash = ?", (uhash,)
            ).fetchone()
            company = job.get("company") or "Empresa"
            if row:
                existing += 1
                # Solo completar descripción o salario si estaban vacíos
                conn.execute(
                    """
                    UPDATE jobs
                    SET description = CASE WHEN (description IS NULL OR description = '') THEN ? ELSE description END,
                        salary = CASE WHEN (salary IS NULL OR salary = '') THEN ? ELSE salary END,
                        posted_at = COALESCE(?, posted_at)
                    WHERE url_hash = ?
                    """,
                    (
                        job.get("description") or "",
                        job.get("salary") or "",
                        job.get("postedAt") or job.get("scraped_at") or "Reciente",
                        uhash,
                    ),
                )
            else:
                inserted += 1
                job_id = f"job-{uhash[:10]}"
                applied = 1 if job.get("applied") else 0
                status = job.get("status") or ("applied" if applied else "pending")
                conn.execute(
                    """
                    INSERT INTO jobs (
                        id, url_hash, link, title, company, initials, location, salary,
                        keyword, source, posted_at, scraped_at, description,
                        status, applied, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        uhash,
                        job.get("link") or "",
                        job.get("title") or "Sin título",
                        company,
                        _company_initials(company),
                        job.get("location") or "",
                        job.get("salary") or "",
                        job.get("keyword") or "",
                        job.get("source") or "LinkedIn",
                        job.get("postedAt") or "Reciente",
                        job.get("scraped_at") or datetime.now().strftime("%Y-%m-%d %H:%M"),
                        job.get("description") or "",
                        status,
                        applied,
                        now,
                    ),
                )
        conn.commit()

    all_saved = get_all_jobs(include_discarded=True)
    sync_json_mirrors(all_saved)
    return all_saved, inserted, existing


def upsert_analyzed_jobs(jobs: List[dict]) -> List[dict]:
    """Actualiza resultados de IA en SQLite preservando notas, estado CRM y mensajes previos."""
    init_db()
    now = datetime.now().isoformat()

    with get_conn() as conn:
        for job in jobs:
            uhash = job.get("url_hash") or _compute_url_hash(job)
            row = conn.execute(
                "SELECT id, bullets_json, optimized, status, applied, notes, outreach_message FROM jobs WHERE url_hash = ?",
                (uhash,),
            ).fetchone()

            new_bullets = job.get("bullets") or []
            company = job.get("company") or "Empresa"

            if row:
                prev_bullets = json.loads(row["bullets_json"] or "[]")
                final_bullets = new_bullets if new_bullets else prev_bullets
                final_optimized = 1 if (job.get("optimized") or len(final_bullets) > 0) else int(row["optimized"] or 0)
                conn.execute(
                    """
                    UPDATE jobs
                    SET analyzed = 1,
                        match_score = ?,
                        tags_json = ?,
                        summary = ?,
                        gaps_json = ?,
                        gap_suggestion = ?,
                        bullets_json = ?,
                        optimized = ?,
                        analyzed_by = ?,
                        updated_at = ?
                    WHERE url_hash = ?
                    """,
                    (
                        int(job.get("matchScore") or 0),
                        json.dumps(job.get("tags") or [], ensure_ascii=False),
                        job.get("summary") or "",
                        json.dumps(job.get("gaps") or [], ensure_ascii=False),
                        job.get("gapSuggestion") or "",
                        json.dumps(final_bullets, ensure_ascii=False),
                        final_optimized,
                        job.get("analyzedBy") or "",
                        now,
                        uhash,
                    ),
                )
            else:
                job_id = str(job.get("id") or f"job-{uhash[:10]}")
                applied = 1 if job.get("applied") else 0
                status = job.get("status") or ("applied" if applied else "pending")
                conn.execute(
                    """
                    INSERT INTO jobs (
                        id, url_hash, link, title, company, initials, location, salary,
                        keyword, source, posted_at, scraped_at, description,
                        analyzed, match_score, tags_json, summary, gaps_json, gap_suggestion,
                        bullets_json, optimized, analyzed_by, status, applied, notes, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        uhash,
                        job.get("link") or "",
                        job.get("title") or "Sin título",
                        company,
                        job.get("initials") or _company_initials(company),
                        job.get("location") or "",
                        job.get("salary") or "",
                        job.get("keyword") or "",
                        job.get("source") or "LinkedIn",
                        job.get("postedAt") or "Reciente",
                        job.get("scraped_at") or datetime.now().strftime("%Y-%m-%d %H:%M"),
                        job.get("description") or "",
                        int(job.get("matchScore") or 0),
                        json.dumps(job.get("tags") or [], ensure_ascii=False),
                        job.get("summary") or "",
                        json.dumps(job.get("gaps") or [], ensure_ascii=False),
                        job.get("gapSuggestion") or "",
                        json.dumps(new_bullets, ensure_ascii=False),
                        1 if new_bullets else 0,
                        job.get("analyzedBy") or "",
                        status,
                        applied,
                        job.get("notes") or "",
                        now,
                    ),
                )
        conn.commit()

    all_saved = get_all_jobs(include_discarded=True)
    sync_json_mirrors(all_saved)
    return all_saved


def get_all_jobs(include_discarded: bool = True) -> List[dict]:
    init_db()
    with get_conn() as conn:
        if include_discarded:
            rows = conn.execute(
                "SELECT * FROM jobs ORDER BY match_score DESC, updated_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM jobs WHERE status != 'discarded' ORDER BY match_score DESC, updated_at DESC"
            ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_job_by_id(job_id: str) -> Optional[dict]:
    init_db()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (str(job_id),)).fetchone()
    return _row_to_dict(row) if row else None


def update_job_crm(
    job_id: str,
    applied: Optional[bool] = None,
    status: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[dict]:
    init_db()
    current = get_job_by_id(job_id)
    if not current:
        return None

    new_status = status if status is not None else current["status"]
    if applied is not None and status is None:
        new_status = "applied" if applied else "pending"

    new_applied = 1 if (applied is True or new_status in ("applied", "interview")) else 0
    if applied is False and status is None:
        new_applied = 0

    new_notes = notes if notes is not None else current.get("notes", "")

    with get_conn() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = ?, applied = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_status, new_applied, new_notes, datetime.now().isoformat(), str(job_id)),
        )
        conn.commit()

    updated = get_job_by_id(job_id)
    sync_json_mirrors(get_all_jobs(include_discarded=True))
    return updated


def save_job_bullets(job_id: str, bullets: List[str]) -> Optional[dict]:
    init_db()
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET bullets_json = ?, optimized = 1, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(bullets, ensure_ascii=False), datetime.now().isoformat(), str(job_id)),
        )
        conn.commit()
    updated = get_job_by_id(job_id)
    sync_json_mirrors(get_all_jobs(include_discarded=True))
    return updated


def save_job_outreach(job_id: str, message: str) -> Optional[dict]:
    init_db()
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET outreach_message = ?, updated_at = ?
            WHERE id = ?
            """,
            (message, datetime.now().isoformat(), str(job_id)),
        )
        conn.commit()
    return get_job_by_id(job_id)


def get_pending_alert_jobs(min_score: int = 85) -> List[dict]:
    init_db()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM jobs
            WHERE analyzed = 1 AND alert_sent = 0 AND status != 'discarded' AND match_score >= ?
            ORDER BY match_score DESC
            """,
            (int(min_score),),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def mark_alerts_sent(job_ids: List[str]):
    if not job_ids:
        return
    init_db()
    with get_conn() as conn:
        placeholders = ",".join("?" for _ in job_ids)
        conn.execute(
            f"UPDATE jobs SET alert_sent = 1 WHERE id IN ({placeholders})",
            [str(jid) for jid in job_ids],
        )
        conn.commit()


def sync_json_mirrors(all_jobs: Optional[List[dict]] = None):
    """Mantiene sincronizados los archivos JSON por compatibilidad total con el flujo existente."""
    if all_jobs is None:
        all_jobs = get_all_jobs(include_discarded=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SCRAPED_JSON_PATH.write_text(
        json.dumps(all_jobs, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    analyzed_only = [j for j in all_jobs if j.get("analyzed")]
    if analyzed_only:
        ANALYZED_JSON_PATH.write_text(
            json.dumps(analyzed_only, indent=2, ensure_ascii=False), encoding="utf-8"
        )
