import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import List

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent


def _get_alert_creds():
    load_dotenv(ROOT_DIR / ".env", override=True)
    discord_url = (os.getenv("DISCORD_WEBHOOK_URL") or "").strip()
    tg_token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    tg_chat_id = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    return discord_url, tg_token, tg_chat_id


def send_discord_message(webhook_url: str, content: str) -> tuple[bool, str]:
    body = json.dumps({"content": content[:1950]}).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "JobHunterAI/2.4"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 204):
                return True, "Alerta enviada a Discord."
            return False, f"Discord respondió HTTP {resp.status}."
    except urllib.error.HTTPError as err:
        return False, f"Error Discord HTTP {err.code}."
    except Exception as exc:
        return False, f"Error conectando a Discord: {exc}"


def send_telegram_message(bot_token: str, chat_id: str, text: str) -> tuple[bool, str]:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    body = json.dumps(
        {
            "chat_id": chat_id,
            "text": text[:3900],
            "disable_web_page_preview": True,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return True, "Alerta enviada a Telegram."
            return False, f"Telegram respondió HTTP {resp.status}."
    except urllib.error.HTTPError as err:
        return False, f"Error Telegram HTTP {err.code}."
    except Exception as exc:
        return False, f"Error conectando a Telegram: {exc}"


def dispatch_high_match_alerts(jobs: List[dict], min_score: int = 85) -> dict:
    """Envía resumen de vacantes nuevas con alto Match a Discord y/o Telegram."""
    discord_url, tg_token, tg_chat_id = _get_alert_creds()
    if not discord_url and not (tg_token and tg_chat_id):
        return {"sent": False, "reason": "no_channels_configured", "count": 0}

    qualifying = [j for j in jobs if int(j.get("matchScore") or 0) >= int(min_score)]
    if not qualifying:
        return {"sent": False, "reason": "no_qualifying_jobs", "count": 0}

    lines = [
        f"JobHunter AI — {len(qualifying)} nueva(s) vacante(s) con Match >= {min_score}%:"
    ]
    for j in qualifying[:8]:
        sal = f" | {j['salary']}" if j.get("salary") else ""
        lines.append(
            f"- [{j['matchScore']}%] {j['title']} @ {j['company']} ({j['location']}{sal})\n  {j.get('link', '')}"
        )
    message = "\n".join(lines)

    sent_any = False
    details = []
    if discord_url:
        ok, msg = send_discord_message(discord_url, message)
        sent_any = sent_any or ok
        details.append(msg)
    if tg_token and tg_chat_id:
        ok, msg = send_telegram_message(tg_token, tg_chat_id, message)
        sent_any = sent_any or ok
        details.append(msg)

    return {"sent": sent_any, "count": len(qualifying), "details": details}


def send_test_alert(
    discord_webhook: str = "",
    telegram_token: str = "",
    telegram_chat_id: str = "",
) -> dict:
    env_discord, env_tg_token, env_tg_chat = _get_alert_creds()
    d_url = discord_webhook.strip() or env_discord
    t_tok = telegram_token.strip() or env_tg_token
    t_chat = telegram_chat_id.strip() or env_tg_chat

    if not d_url and not (t_tok and t_chat):
        return {
            "ok": False,
            "message": "Configura un Webhook de Discord o Bot Token + Chat ID de Telegram primero.",
        }

    sample = (
        "JobHunter AI — Prueba de alerta exitosa.\n"
        "Recibirás notificaciones aquí cuando aparezcan vacantes nuevas que superen tu umbral de Match ATS."
    )
    results = []
    ok_any = False
    if d_url:
        ok, msg = send_discord_message(d_url, sample)
        ok_any = ok_any or ok
        results.append(msg)
    if t_tok and t_chat:
        ok, msg = send_telegram_message(t_tok, t_chat, sample)
        ok_any = ok_any or ok
        results.append(msg)

    return {"ok": ok_any, "message": " | ".join(results)}
