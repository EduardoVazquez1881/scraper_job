import subprocess
import sys
import os

def run_script(script_name):
    print(f"\n{'='*60}")
    print(f"🚀 EJECUTANDO FASE: {script_name}")
    print(f"{'='*60}\n")
    
    # Verificamos que el archivo exista antes de intentar correrlo
    if not os.path.exists(script_name):
        print(f"❌ Error: No se encontró el script '{script_name}'.")
        sys.exit(1)

    try:
        # sys.executable garantiza que usemos el Python de tu entorno virtual (.venv)
        subprocess.run([sys.executable, script_name], check=True)
        print(f"\n✅ FASE '{script_name}' COMPLETADA CON ÉXITO.")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ FATAL: El script '{script_name}' falló y detuvo el proceso.")
        print(f"Código de error: {e.returncode}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  Proceso cancelado manualmente por el usuario.")
        sys.exit(1)

def main():
    print("🌟 INICIANDO SISTEMA AUTOMATIZADO DE BÚSQUEDA DE EMPLEO 🌟")
    print("Este proceso correrá el scraper, optimizará con IA y generará el HTML final.\n")
    
    # Fase 1: Extracción de datos (Scraping)
    run_script("linkedin_scraper.py")
    
    # Fase 2: Análisis y Optimización ATS (Gemini AI)
    run_script("gemini_optimizer.py")
    
    # Fase 3: Formateo y Ensamblaje Visual (HTML)
    run_script("txt_to_html.py")
    
    print("\n🎉 ¡PIPELINE TOTALMENTE FINALIZADO! 🎉")
    print("Todo listo. Abre el archivo 'resultados_convertidos.html' para ver tus resultados finales.")

if __name__ == "__main__":
    main()
