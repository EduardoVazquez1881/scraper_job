from datetime import datetime
from pathlib import Path
from urllib.parse import quote
import json
import os
import random
import re
import time

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = ROOT_DIR / "config.json"
CONFIG_EXAMPLE_PATH = ROOT_DIR / "config.example.json"
DATA_DIR = ROOT_DIR / "data"

TIME_FILTER_MAP = {
    "24h": "r86400",
    "1w": "r604800",
    "1m": "r2592000",
    "r86400": "r86400",
    "r604800": "r604800",
    "r2592000": "r2592000",
}

MAX_SCROLLS = 8

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36",
]


def load_config() -> dict:
    target = CONFIG_PATH if CONFIG_PATH.exists() else CONFIG_EXAMPLE_PATH
    if target.exists():
        with open(target, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "keywords": ["Backend Developer Python", "Full Stack Developer"],
        "location": "Tijuana, Baja California, Mexico",
        "time_filter": "1w",
        "max_per_keyword": 10,
        "headless": True,
    }


def human_pause(min_s=2.0, max_s=4.5):
    time.sleep(random.uniform(min_s, max_s) + random.uniform(0, 0.5))


def human_scroll(page):
    for _ in range(random.randint(2, 3)):
        scroll_amount = random.randint(400, 850)
        page.evaluate(
            f"""
            var container = document.querySelector(".jobs-search-results-list") || document.querySelector(".scaffold-layout__list");
            if (container) {{
                container.scrollBy(0, {scroll_amount});
            }} else {{
                window.scrollBy(0, {scroll_amount});
            }}
            """
        )
        time.sleep(random.uniform(0.4, 1.0))


def build_url(keyword: str, location: str, time_filter: str, work_mode: str = "both") -> str:
    encoded_kw = quote(keyword.strip())
    effective_loc = "Mexico" if work_mode == "mexico_remote" else location.strip()
    encoded_loc = quote(effective_loc)
    tpr = TIME_FILTER_MAP.get(time_filter, "r604800")
    remote_param = "&f_WT=2" if work_mode == "mexico_remote" else ""
    return (
        "https://www.linkedin.com/jobs/search/"
        f"?keywords={encoded_kw}"
        f"&location={encoded_loc}"
        "&distance=50"
        f"&f_TPR={tpr}"
        f"{remote_param}"
        "&sortBy=DD"
    )


def get_cards_count(page) -> int:
    try:
        return len(
            page.locator(
                "li.jobs-search-results__list-item, "
                "div.base-search-card, "
                "div.job-card-container"
            ).all()
        )
    except Exception:
        return 0


def scroll_until_more_cards(page, current_count: int, max_wait=6) -> int:
    page.evaluate(
        """
        var container = document.querySelector(".jobs-search-results-list") || document.querySelector(".scaffold-layout__list");
        if (container) {
            container.scrollTo(0, container.scrollHeight);
        } else {
            window.scrollTo(0, document.body.scrollHeight);
        }
        """
    )
    time.sleep(1)
    human_scroll(page)

    waited = 0
    while waited < max_wait:
        new_count = get_cards_count(page)
        if new_count > current_count:
            return new_count
        time.sleep(1)
        waited += 1

    return get_cards_count(page)


def scrape_keyword(
    page, keyword: str, location: str, time_filter: str, jobs: list, max_jobs: int, work_mode: str = "both"
):
    print(f"[INFO] Buscando: '{keyword}' en '{location}' ({time_filter}, modo={work_mode})", flush=True)
    page.goto(build_url(keyword, location, time_filter, work_mode=work_mode), wait_until="domcontentloaded")
    human_pause(3.5, 6.0)

    try:
        page.wait_for_selector(
            "li.jobs-search-results__list-item, div.base-search-card, div.job-card-container",
            timeout=10000,
        )
    except Exception:
        print(f"[WARN] No se encontraron tarjetas iniciales para '{keyword}'", flush=True)
        return 0

    found_this_keyword = 0
    seen_links = set(j["link"] for j in jobs)
    prev_card_count = 0

    for scroll_num in range(1, MAX_SCROLLS + 1):
        current_count = get_cards_count(page)
        if current_count <= prev_card_count and scroll_num > 1:
            current_count = scroll_until_more_cards(page, prev_card_count)

        prev_card_count = current_count
        cards = page.locator(
            "li.jobs-search-results__list-item, "
            "div.base-search-card, "
            "div.job-card-container"
        ).all()

        new_in_scroll = 0
        for card in cards:
            if found_this_keyword >= max_jobs:
                break
            try:
                link = card.locator("a").first.get_attribute("href", timeout=2000)
                if not link:
                    continue

                clean_link = link.split("?")[0]
                full_link = (
                    "https://www.linkedin.com" + clean_link
                    if not clean_link.startswith("http")
                    else clean_link
                )

                if full_link in seen_links:
                    continue

                title = card.locator("h3").first.inner_text(timeout=2000).strip()
                company = (
                    card.locator("h4, span.job-card-container__company-name")
                    .first.inner_text(timeout=2000)
                    .strip()
                )
                job_loc = (
                    card.locator(
                        "span.job-search-card__location, .job-card-container__metadata-item"
                    )
                    .first.inner_text(timeout=2000)
                    .strip()
                )

                seen_links.add(full_link)
                jobs.append(
                    {
                        "id": f"job-{len(jobs) + 1}",
                        "title": title,
                        "company": company,
                        "location": job_loc,
                        "link": full_link,
                        "keyword": keyword,
                        "source": "LinkedIn",
                        "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                        "applied": False,
                    }
                )
                found_this_keyword += 1
                new_in_scroll += 1
                print(
                    f"[OK] [{found_this_keyword}/{max_jobs}] {title[:55]} @ {company}",
                    flush=True,
                )
            except Exception:
                continue

        if found_this_keyword >= max_jobs or new_in_scroll == 0:
            break

        human_scroll(page)
        human_pause(1.5, 3.0)

        try:
            load_more = page.locator(
                'button:has-text("Load more"), '
                'button:has-text("See more jobs"), '
                "button.infinite-scroller__show-more-button"
            ).first
            if load_more.is_visible(timeout=1500):
                load_more.click()
                human_pause(1.5, 3.0)
        except Exception:
            pass

    return found_this_keyword


def scrape_job_detail(page, job: dict) -> dict:
    try:
        page.goto(job["link"], wait_until="domcontentloaded")
        human_pause(2.5, 4.5)

        try:
            see_more = page.locator(
                'button:has-text("Show more"), '
                'button:has-text("Ver más"), '
                "button.show-more-less-html__button"
            ).first
            if see_more.is_visible(timeout=2000):
                see_more.click()
                time.sleep(1.0)
        except Exception:
            pass

        description = ""
        for selector in [
            "div.show-more-less-html__markup",
            "div.description__text",
            "section.description div",
            'div[class*="description"]',
        ]:
            try:
                el = page.locator(selector).first
                if el.is_visible(timeout=2000):
                    description = el.inner_text(timeout=3000).strip()
                    if description:
                        break
            except Exception:
                continue

        salary = ""
        try:
            el = page.locator(
                'div.salary, span[class*="salary"], div[class*="compensation"]'
            ).first
            if el.is_visible(timeout=1500):
                salary = el.inner_text(timeout=1500).strip()
        except Exception:
            pass

        posted_date = ""
        try:
            el = page.locator(
                'span.posted-time-ago__text, span[class*="posted"], time'
            ).first
            if el.is_visible(timeout=1500):
                posted_date = el.inner_text(timeout=1500).strip()
        except Exception:
            pass

        job.update(
            {
                "description": description,
                "salary": salary,
                "postedAt": posted_date or "Reciente",
            }
        )
        print(f"    [OK] Detalle extraído ({len(description)} chars)", flush=True)
    except Exception as exc:
        print(f"    [WARN] Error al extraer detalle: {exc}", flush=True)
        job.update({"description": "", "salary": "", "postedAt": "Reciente"})

    return job


def requires_english(job: dict) -> bool:
    """Devuelve True si la vacante está redactada en inglés o exige inglés."""
    text = f"{job.get('title', '')} {job.get('description', '')}"
    desc = job.get("description", "")
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


def scrape_linkedin():
    cfg = load_config()
    keywords = cfg.get("keywords") or ["Desarrollador Backend", "Desarrollador Full Stack"]
    location = cfg.get("location") or "Tijuana, Baja California, Mexico"
    time_filter = cfg.get("time_filter") or "1w"
    max_per_keyword = int(cfg.get("max_per_keyword") or 10)
    headless = bool(cfg.get("headless", True))
    exclude_english = bool(cfg.get("exclude_english", True))
    work_mode = cfg.get("work_mode") or "both"

    print("=" * 55, flush=True)
    print(f"[INFO] FASE 01: Scraping LinkedIn ({len(keywords)} keywords)", flush=True)
    print(
        f"[INFO] Ubicación: {location} | Antigüedad: {time_filter} | Headless: {headless} | Sin inglés: {exclude_english}",
        flush=True,
    )
    print("=" * 55, flush=True)

    all_jobs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={
                "width": random.randint(1280, 1440),
                "height": random.randint(800, 900),
            },
            locale="es-MX",
            timezone_id="America/Tijuana",
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = context.new_page()

        for i, kw in enumerate(keywords):
            scrape_keyword(page, kw, location, time_filter, all_jobs, max_per_keyword, work_mode=work_mode)
            if i < len(keywords) - 1:
                human_pause(3.0, 6.0)

        print(f"[INFO] Extrayendo detalles de {len(all_jobs)} vacantes...", flush=True)
        filtered_jobs = []
        skipped_en = 0
        for i, job in enumerate(all_jobs):
            print(f"[INFO] [{i + 1}/{len(all_jobs)}] {job['title'][:50]} @ {job['company']}", flush=True)
            scrape_job_detail(page, job)
            if exclude_english and requires_english(job):
                skipped_en += 1
                print(f"    [SKIP] Descartada (en inglés o pide inglés): {job['title'][:50]}", flush=True)
                continue
            filtered_jobs.append(job)

        browser.close()

    if exclude_english:
        print(
            f"[INFO] Filtro de idioma: {skipped_en} vacantes descartadas por inglés, {len(filtered_jobs)} conservadas en español.",
            flush=True,
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    scraped_path = DATA_DIR / "jobs_scraped.json"
    legacy_path = ROOT_DIR / "resultados_scraping.json"

    for out_path in (scraped_path, legacy_path):
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(filtered_jobs, f, indent=2, ensure_ascii=False)

    print(f"[OK] FASE 01 COMPLETADA: {len(filtered_jobs)} vacantes guardadas en {scraped_path.name}", flush=True)
    return filtered_jobs


if __name__ == "__main__":
    scrape_linkedin()
