from datetime import datetime
import random
import time
import urllib.parse

from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def scrape_indeed(
    keywords: list,
    location: str,
    max_per_keyword: int = 10,
    headless: bool = True,
) -> list:
    """Extrae vacantes públicas de Indeed México; si aparece verificación anti-bot, omite limpiamente."""
    print(f"[INFO] [Indeed MX] Buscando {len(keywords)} keywords en '{location}'...", flush=True)
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
                q = urllib.parse.quote(kw.strip())
                loc = urllib.parse.quote(location.strip())
                url = f"https://mx.indeed.com/jobs?q={q}&l={loc}&sort=date"
                print(f"[INFO] [Indeed MX] Consultando: '{kw}'", flush=True)
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    time.sleep(random.uniform(2.0, 3.5))
                except Exception as exc:
                    print(f"[WARN] [Indeed MX] Error cargando '{kw}': {exc}", flush=True)
                    continue

                page_title = (page.title() or "").lower()
                body_text = (page.locator("body").inner_text(timeout=3000) or "").lower()
                if (
                    "just a moment" in page_title
                    or "security check" in page_title
                    or "verify you are human" in body_text
                    or "cloudflare" in body_text
                ):
                    print(
                        "[WARN] [Indeed MX] Indeed solicitó verificación humana (Cloudflare). Omitiendo fuente y continuando con las demás.",
                        flush=True,
                    )
                    break

                cards = page.locator("div.job_seen_beacon, td.resultContent").all()
                if not cards:
                    print(f"[WARN] [Indeed MX] No se detectaron tarjetas visibles para '{kw}'.", flush=True)
                    continue

                added = 0
                for card in cards:
                    if added >= max_per_keyword:
                        break
                    try:
                        link_el = card.locator("a.jcs-JobTitle, h2.jobTitle a").first
                        title = link_el.inner_text(timeout=1500).strip()
                        href = link_el.get_attribute("href", timeout=1500) or ""
                        if not href:
                            continue
                        full_link = f"https://mx.indeed.com{href}" if href.startswith("/") else href
                        clean_link = full_link.split("&")[0]
                        if clean_link in seen_links:
                            continue
                        seen_links.add(clean_link)

                        company = "Empresa en Indeed"
                        try:
                            company = card.locator('[data-testid="company-name"], span.companyName').first.inner_text(timeout=1000).strip()
                        except Exception:
                            pass

                        loc_text = location
                        try:
                            loc_text = card.locator('[data-testid="text-location"], div.companyLocation').first.inner_text(timeout=1000).strip()
                        except Exception:
                            pass

                        salary = ""
                        try:
                            sal_el = card.locator('[data-testid="attribute_snippet_testid"], div.salary-snippet-container').first
                            if sal_el.is_visible(timeout=500):
                                salary = sal_el.inner_text(timeout=500).strip()
                        except Exception:
                            pass

                        snippet = ""
                        try:
                            snippet = card.locator("div.job-snippet, ul.heading6").first.inner_text(timeout=800).strip()
                        except Exception:
                            pass

                        jobs.append(
                            {
                                "title": title,
                                "company": company,
                                "location": loc_text,
                                "salary": salary,
                                "link": clean_link,
                                "keyword": kw,
                                "source": "Indeed",
                                "description": snippet or f"{title} en {company} ({loc_text}).",
                                "postedAt": "Reciente",
                                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                                "applied": False,
                            }
                        )
                        added += 1
                        print(f"  [OK] [Indeed] {title[:55]} @ {company}", flush=True)
                    except Exception:
                        continue

            browser.close()
    except Exception as exc:
        print(f"[WARN] [Indeed MX] Error general: {exc}", flush=True)

    print(f"[OK] [Indeed MX] {len(jobs)} vacantes obtenidas.", flush=True)
    return jobs
