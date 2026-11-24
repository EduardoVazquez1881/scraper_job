import argparse
import os
import subprocess
import sys


def run_script(script_name, extra_args=None):
    print(f"\n{'='*60}", flush=True)
    print(f"[INFO] EJECUTANDO FASE: {script_name}", flush=True)
    print(f"{'='*60}\n", flush=True)

    if not os.path.exists(script_name):
        print(f"[ERROR] No se encontró el script '{script_name}'.", flush=True)
        sys.exit(1)

    cmd = [sys.executable, "-u", script_name] + (extra_args or [])
    try:
        subprocess.run(cmd, check=True)
        print(f"\n[OK] FASE '{script_name}' COMPLETADA CON ÉXITO.", flush=True)
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] El script '{script_name}' falló (código {e.returncode}).", flush=True)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="JobHunter AI Pipeline")
    parser.add_argument("--skip-scrape", action="store_true", help="Omitir Fase 01 (scraping)")
    parser.add_argument("--optimize", action="store_true", help="Activar optimización de bullets en Fase 02")
    args = parser.parse_args()

    print("[INFO] INICIANDO PIPELINE JOBHUNTER AI", flush=True)

    if not args.skip_scrape:
        run_script("multi_scraper.py")

    opt_args = ["--optimize"] if args.optimize else []
    run_script("ai_optimizer.py", extra_args=opt_args)

    print("\n[OK] PIPELINE FINALIZADO. Resultados listos en el dashboard.", flush=True)


if __name__ == "__main__":
    main()
