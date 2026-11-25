import json

from linkedin_scraper import scrape_linkedin
from scrapers.computrabajo_scraper import scrape_computrabajo
from scrapers.getonboard_scraper import scrape_getonboard
from scrapers.indeed_scraper import scrape_indeed
from scrapers.utils import DATA_DIR, ROOT_DIR, load_config, matches_search_keyword, requires_english


def run_multi_scrape():
    cfg = load_config()
    keywords = cfg.get("keywords") or ["Desarrollador Backend", "Desarrollador Full Stack"]
    location = cfg.get("location") or "Tijuana, Baja California, Mexico"
    max_per_keyword = int(cfg.get("max_per_keyword") or 10)
    headless = bool(cfg.get("headless", True))
    exclude_english = bool(cfg.get("exclude_english", True))
    work_mode = cfg.get("work_mode") or "both"
    sources = cfg.get("sources") or ["linkedin", "computrabajo", "getonboard"]

    print("=" * 60, flush=True)
    print(f"[INFO] FASE 01 MULTI-FUENTE | Fuentes activas: {', '.join(sources)}", flush=True)
    print(f"[INFO] Modo: {work_mode} | Ubicación: {location} | Sin inglés: {exclude_english}", flush=True)
    print("=" * 60, flush=True)

    combined = []

    if "getonboard" in sources:
        combined.extend(
            scrape_getonboard(
                keywords,
                location=location,
                max_per_keyword=max_per_keyword,
                work_mode=work_mode,
            )
        )

    if "computrabajo" in sources:
        combined.extend(
            scrape_computrabajo(
                keywords,
                location=location,
                max_per_keyword=max_per_keyword,
                headless=headless,
            )
        )

    if "indeed" in sources:
        combined.extend(
            scrape_indeed(
                keywords,
                location=location,
                max_per_keyword=max_per_keyword,
                headless=headless,
            )
        )

    if "linkedin" in sources:
        # linkedin_scraper ya aplica filtro de idioma internamente
        combined.extend(scrape_linkedin())

    # Deduplicar por enlace y aplicar filtros de idioma y relevancia por keyword
    deduped = []
    seen_links = set()
    skipped_en = 0
    skipped_irrelevant = 0

    for job in combined:
        link = (job.get("link") or "").strip()
        if link and link in seen_links:
            continue
        if exclude_english and requires_english(job):
            skipped_en += 1
            continue
        kw = (job.get("keyword") or "").strip()
        if kw and not matches_search_keyword(job, kw):
            skipped_irrelevant += 1
            continue
        if link:
            seen_links.add(link)
        job["id"] = f"job-{len(deduped) + 1}"
        deduped.append(job)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    scraped_path = DATA_DIR / "jobs_scraped.json"
    legacy_path = ROOT_DIR / "resultados_scraping.json"

    # Persistir en SQLite con deduplicación histórica (sin perder estado ni análisis previos)
    try:
        from backend.db import upsert_scraped_jobs

        all_saved, newly_inserted, already_known = upsert_scraped_jobs(deduped)
        print(
            f"[INFO] SQLite histórico: {newly_inserted} vacantes nuevas insertadas, "
            f"{already_known} ya registradas previamente (total en BD: {len(all_saved)}).",
            flush=True,
        )
    except Exception as exc:
        print(f"[WARN] No se pudo sincronizar con SQLite ({exc}), guardando en JSON directo.", flush=True)
        for out_path in (scraped_path, legacy_path):
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(deduped, f, indent=2, ensure_ascii=False)
    else:
        with open(legacy_path, "w", encoding="utf-8") as f:
            json.dump(deduped, f, indent=2, ensure_ascii=False)

    print("=" * 60, flush=True)
    print(
        f"[OK] FASE 01 COMPLETADA: {len(deduped)} vacantes procesadas en esta corrida "
        f"({skipped_en} descartadas por inglés, {skipped_irrelevant} por irrelevantes).",
        flush=True,
    )
    print("=" * 60, flush=True)
    return deduped


if __name__ == "__main__":
    run_multi_scrape()
