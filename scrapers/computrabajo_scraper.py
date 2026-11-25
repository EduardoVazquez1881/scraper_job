from datetime import datetime
import random
import time

from playwright.sync_api import sync_playwright

from scrapers.utils import matches_search_keyword, slugify

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _build_computrabajo_url(keyword: str, location: str) -> str:
    kw_slug = slugify(keyword)
    loc_lower = location.lower()
    if "tijuana" in loc_lower:
        return f"https://mx.computrabajo.com/trabajo-de-{kw_slug}-en-tijuana"
    if "baja california" in loc_lower:
        return f"https://mx.computrabajo.com/trabajo-de-{kw_slug}-en-baja-california"
    return f"https://mx.computrabajo.com/trabajo-de-{kw_slug}"


def scrape_computrabajo(
    keywords: list,
    location: str,
    max_per_keyword: int = 10,
    headless: bool = True,
) -> list:
    """Extrae vacantes públicas de Computrabajo México respetando verificaciones anti-bot."""
    print(f"[INFO] [Computrabajo MX] Buscando {len(keywords)} keywords en '{location}'...", flush=True)
    jobs = []
    seen_links = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1366, "height": 850},
                locale="es-MX",
            )
            page = context.new_page()

            for kw in keywords:
                url = _build_computrabajo_url(kw, location)
                print(f"[INFO] [Computrabajo MX] Abriendo: {url}", flush=True)
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    time.sleep(random.uniform(2.0, 3.5))
                except Exception as exc:
                    print(f"[WARN] [Computrabajo MX] Error cargando '{kw}': {exc}", flush=True)
                    continue

                body_text = (page.locator("body").inner_text(timeout=3000) or "").lower()
                if "verify you are human" in body_text or "cloudflare" in body_text or "captcha" in body_text:
                    print("[WARN] [Computrabajo MX] Se detectó verificación anti-bot; omitiendo fuente.", flush=True)
                    break
                if (
                    "no hemos encontrado ofertas" in body_text
                    or "no se encontraron ofertas" in body_text
                    or "te mostramos otras ofertas" in body_text
                ):
                    print(f"[WARN] [Computrabajo MX] Sin coincidencias exactas para '{kw}' (solo sugerencias genéricas). Omitiendo.", flush=True)
                    continue

                cards = page.locator("article.box_offer").all()
                if not cards:
                    print(f"[WARN] [Computrabajo MX] Sin resultados visibles para '{kw}'.", flush=True)
                    continue

                added = 0
                skipped_irrelevant = 0
                for card in cards:
                    if added >= max_per_keyword:
                        break
                    try:
                        link_el = card.locator("a.js-o-link").first
                        title = link_el.inner_text(timeout=1500).strip()
                        href = link_el.get_attribute("href", timeout=1500) or ""
                        if not href:
                            continue
                        full_link = (
                            f"https://mx.computrabajo.com{href}"
                            if href.startswith("/")
                            else href
                        )
                        if full_link in seen_links:
                            continue

                        company = "Empresa confidencial"
                        try:
                            company = card.locator("p.dIB a, p.fs16 a").first.inner_text(timeout=1000).strip()
                        except Exception:
                            pass

                        loc_text = location
                        try:
                            loc_text = card.locator("p.fs16.fc_base.mt5").first.inner_text(timeout=1000).strip()
                        except Exception:
                            pass

                        salary = ""
                        try:
                            sal_el = card.locator("span.dIB.mr10").first
                            if sal_el.is_visible(timeout=500):
                                txt = sal_el.inner_text(timeout=500).strip()
                                if "$" in txt or "MXN" in txt:
                                    salary = txt
                        except Exception:
                            pass

                        snippet = ""
                        try:
                            snippet = card.locator("p.fs13, div.fs13").first.inner_text(timeout=800).strip()
                        except Exception:
                            pass

                        candidate = {
                            "title": title,
                            "company": company,
                            "location": loc_text,
                            "salary": salary,
                            "link": full_link,
                            "keyword": kw,
                            "source": "Computrabajo",
                            "description": snippet or f"{title} en {company} ({loc_text}).",
                            "postedAt": "Reciente",
                            "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                            "applied": False,
                        }

                        if not matches_search_keyword(candidate, kw):
                            skipped_irrelevant += 1
                            continue

                        seen_links.add(full_link)
                        jobs.append(candidate)
                        added += 1
                        print(f"  [OK] [Computrabajo] {title[:55]} @ {company}", flush=True)
                    except Exception:
                        continue

                if skipped_irrelevant:
                    print(
                        f"  [INFO] [Computrabajo MX] {skipped_irrelevant} vacantes de relleno descartadas por no coincidir con '{kw}'.",
                        flush=True,
                    )

            browser.close()
    except Exception as exc:
        print(f"[WARN] [Computrabajo MX] Error general: {exc}", flush=True)

    print(f"[OK] [Computrabajo MX] {len(jobs)} vacantes obtenidas.", flush=True)
    return jobs
