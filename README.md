# Job-Hunter AI Pipeline

Este proyecto es un sistema de automatización avanzado (Pipeline) de extremo a extremo diseñado para extraer ofertas de empleo de LinkedIn y utilizar Inteligencia Artificial Generativa (Google Gemini) para analizar, calificar y optimizar un currículum para cada vacante específica de forma automática.

## Arquitectura y Flujo de Trabajo

El flujo de trabajo se divide en 3 fases modulares conectadas de forma secuencial. Todo el proceso puede ser orquestado ejecutando un solo comando:

```bash
python run_pipeline.py
```

### 1. Extracción de Datos (Scraping)
*   **Script:** `linkedin_scraper.py`
*   **Función:** Utiliza *Playwright* en modo invitado (Guest Mode) para buscar vacantes en LinkedIn por palabra clave. Realiza pausas humanas y "scrolls" para evadir detección de bots. Extrae el título, empresa, descripción completa, salario y enlace.
*   **Salida (Output):** Genera el archivo `resultados_scraping.json`, el cual es una base de datos en crudo que siempre se sobrescribe en cada ejecución.

### 2. Optimización ATS con IA (El "Cerebro")
*   **Script:** `gemini_optimizer.py` *(Excluido del repositorio por seguridad, ver sección de Privacidad)*.
*   **Función:** Lee el archivo `resultados_scraping.json`. Empaqueta los empleos en lotes y los envía a la API de Google Gemini (Flash 2.5) junto con un Mega-Prompt estricto y el currículum base del candidato.
*   **Evaluación:** Gemini evalúa el nivel de compatibilidad (ATS Match Score), extrae palabras clave y reescribe las viñetas del currículum enfocándose en métricas, liderazgo e impacto. Además, el script inyecta el enlace original de la oferta en el resultado.
*   **Salida (Output):** Genera el archivo `resultados_optimizados.txt` (texto plano).

### 3. Ensamblaje Visual (Motor de Renderizado)
*   **Script:** `txt_to_html.py`
*   **Función:** Lee el texto plano (`resultados_optimizados.txt`) y lo convierte en un formato elegante (`.html`) utilizando Expresiones Regulares (Regex) para resaltar métricas y números en **negrita**. También convierte los enlaces de texto en botones web y aplica un estilo CSS estricto que emula los estilos de Word (Cambria, 10.5pt, sangrías francesas).
*   **Salida (Output):** Genera el archivo `resultados_convertidos.html`. Al abrir este archivo en el navegador, los resultados pueden ser copiados y pegados directamente en Microsoft Word (`Ctrl+V`) preservando todo el diseño sin requerir edición manual.

---

## 🔒 Notas sobre Privacidad y Seguridad

### ¿Por qué falta el archivo `gemini_optimizer.py`?
El archivo `gemini_optimizer.py` **ha sido excluido intencionalmente** de este repositorio público mediante el archivo `.gitignore`. 

Esto se debe a que dicho archivo actúa como el "Mega-Prompt" del sistema e incluye directamente (Hardcoded):
1. **Credenciales Privadas:** La API Key privada de Google Gemini.
2. **Información Personal:** El currículum completo del candidato (datos de contacto, teléfono, historial laboral, etc.) incrustado en la instrucción del sistema para alimentar a la IA.

Si deseas replicar este sistema, deberás crear tu propio `gemini_optimizer.py` que reciba el JSON, se conecte a un LLM de tu preferencia, y escupa el archivo de texto final con el formato esperado por `txt_to_html.py`.

### Ignorando los Archivos de Datos
Para mantener el repositorio limpio y evitar la fuga de datos masivos y resultados personales, también se han ignorado en `.gitignore` todos los archivos dinámicos generados por los scripts (`*.json`, `*.txt`, `*.html` y `*.csv`).
