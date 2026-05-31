from playwright.sync_api import sync_playwright
import time
import random
import json
import os
from datetime import datetime

KEYWORDS = [
    "Director Digital Transformation",
    "Head of Data Enablement",
    "VP Enterprise Systems",
    "Director Data Engineering",
    "Director Enterprise Applications",
    "Director AI Advisory",
    "Director Supply Chain Analytics",
    "Director IT PMO",
    "Senior Director Analytics"
]

LOCATION = "San%20Diego%2C%20California%2C%20United%20States"
MAX_PER_KEYWORD = 20   # ← subido a 20 por keyword
MAX_SCROLLS = 10       # ← más scrolls para cargar más cards
WAIT_FOR_MORE = 3      # segundos esperando nuevos cards tras scroll

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36",
]

def human_pause(min_s=3, max_s=7):
    time.sleep(random.uniform(min_s, max_s) + random.uniform(0, 0.8))

def human_scroll(page):
    for _ in range(random.randint(2, 4)):
        scroll_amount = random.randint(400, 900)
        page.evaluate(f'''
            var container = document.querySelector(".jobs-search-results-list") || document.querySelector(".scaffold-layout__list");
            if (container) {{
                container.scrollBy(0, {scroll_amount});
            }} else {{
                window.scrollBy(0, {scroll_amount});
            }}
        ''')
        time.sleep(random.uniform(0.5, 1.2))

def build_url(keyword: str) -> str:
    encoded = keyword.replace(" ", "%20")
    return (
        "https://www.linkedin.com/jobs/search/"
        f"?keywords={encoded}"
        f"&location={LOCATION}"
        "&distance=50"
        "&f_TPR=r86400"
        "&sortBy=DD"
    )

def get_cards_count(page) -> int:
    """Cuenta cuántos cards hay actualmente en el DOM."""
    try:
        return len(page.locator(
            'li.jobs-search-results__list-item, '
            'div.base-search-card, '
            'div.job-card-container'
        ).all())
    except:
        return 0

def scroll_until_more_cards(page, current_count: int, max_wait=8) -> int:
    """
    Hace scroll y espera hasta que aparezcan más cards que current_count.
    Retorna el nuevo número de cards.
    """
    # Scroll al final de la lista
    page.evaluate('''
        var container = document.querySelector(".jobs-search-results-list") || document.querySelector(".scaffold-layout__list");
        if (container) {
            container.scrollTo(0, container.scrollHeight);
        } else {
            window.scrollTo(0, document.body.scrollHeight);
        }
    ''')
    time.sleep(1)
    human_scroll(page)

    # Esperar hasta max_wait segundos a que carguen más cards
    waited = 0
    while waited < max_wait:
        new_count = get_cards_count(page)
        if new_count > current_count:
            return new_count
        time.sleep(1)
        waited += 1

    return get_cards_count(page)

def scrape_keyword(page, keyword: str, jobs: list, max_jobs: int):
    print(f"\n🔍 Buscando: '{keyword}'")
    page.goto(build_url(keyword), wait_until="domcontentloaded")
    human_pause(5, 9)

    # Esperar a que carguen los primeros cards
    try:
        page.wait_for_selector(
            'li.jobs-search-results__list-item, div.base-search-card, div.job-card-container',
            timeout=10000
        )
    except:
        print("  ⚠️  No se encontraron cards iniciales")
        return 0

    found_this_keyword = 0
    seen_links = set(j["link"] for j in jobs)  # links ya guardados globalmente
    prev_card_count = 0

    for scroll_num in range(1, MAX_SCROLLS + 1):

        # Esperar a que aparezcan nuevos cards
        current_count = get_cards_count(page)
        if current_count <= prev_card_count and scroll_num > 1:
            print(f"  ⏳ Esperando más cards... ({current_count} en DOM)")
            current_count = scroll_until_more_cards(page, prev_card_count)

            # Si después de intentar hacer scroll no hay nuevos cards, avisamos pero NO detenemos
            # para darle oportunidad a LinkedIn de mostrar las 'recomendadas'
            if current_count <= prev_card_count:
                print("  👀 Buscando ofertas recomendadas...")

        prev_card_count = current_count

        # Procesar todos los cards visibles
        cards = page.locator(
            'li.jobs-search-results__list-item, '
            'div.base-search-card, '
            'div.job-card-container'
        ).all()

        new_in_scroll = 0
        for card in cards:
            try:
                link = card.locator('a').first.get_attribute('href', timeout=2000)
                if not link:
                    continue

                clean_link = link.split('?')[0]
                full_link = (
                    "https://www.linkedin.com" + clean_link
                    if not clean_link.startswith('http') else clean_link
                )

                # Saltar si ya lo tenemos
                if full_link in seen_links:
                    continue

                title    = card.locator('h3').first.inner_text(timeout=2000).strip()
                company  = card.locator('h4, span.job-card-container__company-name').first.inner_text(timeout=2000).strip()
                location = card.locator('span.job-search-card__location, .job-card-container__metadata-item').first.inner_text(timeout=2000).strip()

                seen_links.add(full_link)
                jobs.append({
                    "title":      title,
                    "company":    company,
                    "location":   location,
                    "link":       full_link,
                    "keyword":    keyword,
                    "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                })
                found_this_keyword += 1
                new_in_scroll += 1
                print(f"  ✅ [{found_this_keyword}] {title[:65]}")

            except:
                continue

        print(f"  Scroll {scroll_num}/{MAX_SCROLLS} | Cards en DOM: {current_count} | Nuevos: {new_in_scroll} | Total keyword: {found_this_keyword}")

        if found_this_keyword >= max_jobs:
            print(f"  🎯 Límite de {max_jobs} alcanzado para esta keyword")
            break

        # Scroll para cargar más
        human_scroll(page)
        human_pause(2, 4)

        # Intentar click en "Load more" si existe
        try:
            load_more = page.locator(
                'button:has-text("Load more"), '
                'button:has-text("See more jobs"), '
                'button.infinite-scroller__show-more-button'
            ).first
            if load_more.is_visible(timeout=2000):
                load_more.click()
                print("  🔄 Cargando más resultados...")
                human_pause(2, 4)
        except:
            pass

    return found_this_keyword


def scrape_job_detail(page, job: dict) -> dict:
    try:
        page.goto(job["link"], wait_until="domcontentloaded")
        human_pause(4, 8)

        try:
            see_more = page.locator(
                'button:has-text("Show more"), '
                'button:has-text("Ver más"), '
                'button.show-more-less-html__button'
            ).first
            if see_more.is_visible(timeout=3000):
                see_more.click()
                time.sleep(1.5)
        except:
            pass

        description = ""
        for selector in [
            'div.show-more-less-html__markup',
            'div.description__text',
            'section.description div',
            'div[class*="description"]',
        ]:
            try:
                el = page.locator(selector).first
                if el.is_visible(timeout=2000):
                    description = el.inner_text(timeout=3000).strip()
                    if description:
                        break
            except:
                continue

        criteria = {}
        try:
            items = page.locator(
                'li.description__job-criteria-item, .job-criteria__item'
            ).all()
            for item in items:
                try:
                    label = item.locator('h3, .job-criteria__subheader').first.inner_text(timeout=1500).strip()
                    value = item.locator('span, .job-criteria__text').first.inner_text(timeout=1500).strip()
                    if label and value:
                        criteria[label] = value
                except:
                    continue
        except:
            pass

        salary = ""
        try:
            el = page.locator('div.salary, span[class*="salary"], div[class*="compensation"]').first
            if el.is_visible(timeout=2000):
                salary = el.inner_text(timeout=2000).strip()
        except:
            pass

        applicants = ""
        try:
            el = page.locator('span.num-applicants__caption, span[class*="applicant"]').first
            if el.is_visible(timeout=2000):
                applicants = el.inner_text(timeout=2000).strip()
        except:
            pass

        posted_date = ""
        try:
            el = page.locator('span.posted-time-ago__text, span[class*="posted"], time').first
            if el.is_visible(timeout=2000):
                posted_date = el.inner_text(timeout=2000).strip()
        except:
            pass

        job.update({
            "description": description,
            "criteria":    criteria,
            "salary":      salary,
            "applicants":  applicants,
            "posted_date": posted_date,
        })
        print(f"    📄 OK | {len(description)} chars | {list(criteria.keys())}")

    except Exception as e:
        print(f"    ⚠️  Error: {e}")
        job.update({"description": "", "criteria": {}, "salary": "", "applicants": "", "posted_date": ""})

    return job


def scrape_linkedin():
    all_jobs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": random.randint(1280, 1440), "height": random.randint(800, 900)},
            locale="en-US",
            timezone_id="America/Los_Angeles",
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = context.new_page()

        # FASE 1
        print("=" * 55)
        print("FASE 1: Recolectando listado de ofertas")
        print("=" * 55)
        for i, keyword in enumerate(KEYWORDS):
            scrape_keyword(page, keyword, all_jobs, MAX_PER_KEYWORD)
            if i < len(KEYWORDS) - 1:
                human_pause(10, 18) if i % 2 == 1 else human_pause(5, 10)

        # FASE 2
        print(f"\n{'=' * 55}")
        print(f"FASE 2: Extrayendo detalle de {len(all_jobs)} ofertas")
        print("=" * 55)
        for i, job in enumerate(all_jobs):
            print(f"\n  [{i+1}/{len(all_jobs)}] {job['title'][:50]} @ {job['company']}")
            scrape_job_detail(page, job)
            if i < len(all_jobs) - 1:
                human_pause(4, 9)

        browser.close()

    output_file = "resultados_scraping.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, indent=2, ensure_ascii=False)

    print(f"\n🏁 Terminado. {len(all_jobs)} ofertas → {output_file}")
    return all_jobs


if __name__ == "__main__":
    scrape_linkedin()