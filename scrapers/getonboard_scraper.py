from datetime import datetime
import json
import urllib.parse
import urllib.request

from scrapers.utils import strip_html


FOREIGN_CITY_TOKENS = (
    "santiago",
    "chile",
    "valparaiso",
    "concepcion",
    "bogota",
    "medellin",
    "colombia",
    "lima",
    "peru",
    "buenos-aires",
    "argentina",
    "cordoba",
    "montevideo",
    "uruguay",
    "quito",
    "guayaquil",
    "ecuador",
    "madrid",
    "barcelona",
    "espana",
    "spain",
)


def _is_eligible_for_location(attrs: dict, public_url: str, target_location: str, work_mode: str = "both") -> bool:
    """Conserva solo vacantes realmente elegibles para Tijuana / México Remoto."""
    countries = [str(c).lower() for c in (attrs.get("countries") or [])]
    country = str(attrs.get("country") or "").lower()
    remote = bool(attrs.get("remote"))
    modality = str(attrs.get("remote_modality") or "").lower()
    url_lower = (public_url or "").lower()

    in_mexico = any("mex" in c for c in countries) or "mex" in country or "-mexico" in url_lower or "-tijuana" in url_lower
    in_tijuana = "tijuana" in url_lower or "tijuana" in str(attrs.get("city") or "").lower()
    has_foreign_city = any(f"-{tok}" in url_lower for tok in FOREIGN_CITY_TOKENS)
    is_fully_remote = modality == "fully_remote" or (remote and modality not in ("hybrid", "remote_local", "no_remote") and not has_foreign_city)

    city_part = (target_location or "").split(",")[0].strip().lower()
    in_target_city = bool(city_part) and (
        city_part in url_lower or city_part in str(attrs.get("city") or "").lower()
    )

    if work_mode in ("local", "tijuana_local"):
        return in_target_city or in_tijuana

    if work_mode == "mexico_remote":
        if has_foreign_city and not is_fully_remote:
            return False
        if countries and not in_mexico and not is_fully_remote:
            return False
        return is_fully_remote or (remote and in_mexico)

    # work_mode == "both" (Local + Remoto)
    if in_target_city or in_tijuana:
        return True
    if has_foreign_city and modality != "fully_remote":
        return False
    if modality in ("no_remote", "hybrid", "remote_local") and not in_mexico:
        return False
    if countries and not in_mexico and modality != "fully_remote":
        return False
    return in_mexico or is_fully_remote


def scrape_getonboard(
    keywords: list,
    location: str = "Mexico",
    max_per_keyword: int = 10,
    work_mode: str = "both",
) -> list:
    """Extrae vacantes tech en LATAM/México usando la API pública oficial de Get on Board."""
    print(f"[INFO] [Get on Board API] Consultando {len(keywords)} keywords (modo: {work_mode})...", flush=True)
    jobs = []
    seen_links = set()
    skipped_location = 0

    for kw in keywords:
        encoded = urllib.parse.quote(kw.strip())
        url = f"https://www.getonbrd.com/api/v0/search/jobs?query={encoded}&per_page={min(max_per_keyword * 2, 30)}&page=1"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "JobHunterAI/2.4"},
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"[WARN] [Get on Board] Error consultando '{kw}': {exc}", flush=True)
            continue

        items = payload.get("data") or []
        added = 0
        for item in items:
            if added >= max_per_keyword:
                break
            attrs = item.get("attributes") or {}
            links = item.get("links") or {}
            public_url = links.get("public_url") or f"https://www.getonbrd.com/jobs/{item.get('id', '')}"
            if not _is_eligible_for_location(attrs, public_url, location, work_mode=work_mode):
                skipped_location += 1
                continue
            if public_url in seen_links:
                continue
            seen_links.add(public_url)

            title = (attrs.get("title") or "").strip()
            company_data = (item.get("relationships") or {}).get("company", {}).get("data") or {}
            company = company_data.get("id") or "Empresa Tech"
            company = str(company).replace("-", " ").title()

            min_sal = attrs.get("min_salary")
            max_sal = attrs.get("max_salary")
            salary = ""
            if min_sal and max_sal:
                salary = f"${min_sal:,} - ${max_sal:,} USD / mes"
            elif min_sal:
                salary = f"Desde ${min_sal:,} USD / mes"

            countries = attrs.get("countries") or []
            remote = attrs.get("remote")
            loc_parts = []
            if remote:
                loc_parts.append("Remoto")
            if countries:
                loc_parts.append(", ".join(countries[:3]))
            location = " · ".join(loc_parts) or "LATAM / Remoto"

            desc = strip_html(
                " ".join(
                    filter(
                        None,
                        [
                            attrs.get("description") or "",
                            attrs.get("functions") or "",
                            attrs.get("benefits") or "",
                        ],
                    )
                )
            )

            jobs.append(
                {
                    "title": title,
                    "company": company,
                    "location": location,
                    "salary": salary,
                    "link": public_url,
                    "keyword": kw,
                    "source": "Get on Board",
                    "description": desc,
                    "postedAt": "Reciente",
                    "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "applied": False,
                }
            )
            added += 1
            print(f"  [OK] [Get on Board] {title[:55]} @ {company}", flush=True)

    print(
        f"[OK] [Get on Board] {len(jobs)} vacantes obtenidas vía API "
        f"({skipped_location} descartadas por ubicación fuera de México).",
        flush=True,
    )
    return jobs
