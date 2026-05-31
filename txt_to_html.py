import os
import re

def txt_to_html(input_file, output_file):
    if not os.path.exists(input_file):
        print(f"Error: No se encontró el archivo {input_file}")
        return

    html_header = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { background-color: #f9f9f9; padding: 20px; font-family: Cambria, serif; }
  .job-container { background-color: #fff; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 800px; margin-left: auto; margin-right: auto; }
  h2 { font-family: Cambria, serif; font-size: 14pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 0; }
  p.bullet { 
    font-family: Cambria, serif; 
    font-size: 10.5pt;
    line-height: 15.9pt; 
    mso-line-height-rule: exactly; 
    margin-left: 0.25in;
    text-indent: -0.25in;
    margin-top: 0in;
    margin-bottom: 0in;
  }
  p.normal {
    font-family: Cambria, serif; 
    font-size: 10.5pt;
    line-height: 15.9pt;
    mso-line-height-rule: exactly;
    margin-top: 0in;
    margin-bottom: 0in;
  }
</style>
</head>
<body>
<h1 style="text-align: center; font-family: Cambria;">RESULTADOS DE OPTIMIZACIÓN</h1>
<div class='job-container'>
"""
    
    # Regex para buscar números con formato (ej: 40%, 50+, 9,000+, 3x, 10)
    number_pattern = re.compile(r'\b(\d+(?:,\d+)*(?:\.\d+)?(?:%|\+|x)?)\b')

    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    with open(output_file, "w", encoding="utf-8") as out_f:
        out_f.write(html_header)
        
        in_bullets = False
        
        for line in lines:
            cleaned_line = line.strip()
            
            # Detectar separación de Lotes o Trabajos
            if "================================================================================" in cleaned_line:
                out_f.write("</div>\n<div class='job-container'>\n")
                continue
            if cleaned_line.startswith("LOTE "):
                out_f.write(f"<h2>{cleaned_line}</h2>\n")
                continue
            if "------------------------------------------------" in cleaned_line:
                out_f.write("<hr>\n")
                continue
                
            if cleaned_line.startswith("LINK:"):
                url = cleaned_line.replace("LINK:", "").strip()
                out_f.write(f"<p class='normal'><b>LINK ORIGINAL:</b> <a href='{url}' target='_blank' style='color: #0066cc; text-decoration: none;'>Ver Oferta en LinkedIn</a></p>\n")
                continue
                
            if not cleaned_line:
                if not in_bullets:
                    out_f.write("<br>\n")
                continue
                
            # Máquina de estados para saber si estamos en las viñetas
            if "REWRITTEN BULLETS" in cleaned_line.upper():
                in_bullets = True
                out_f.write(f"<p class='normal'>{cleaned_line}</p>\n")
                continue
            elif "RECOMMENDATION" in cleaned_line.upper() or "MATCH SCORE" in cleaned_line.upper() or "EXECUTIVE TITLE" in cleaned_line.upper() or "TOP GAPS" in cleaned_line.upper() or "KEYWORDS LINE" in cleaned_line.upper():
                in_bullets = False
                # En Match Score a veces hay números que también queremos resaltar
                if "MATCH SCORE" in cleaned_line.upper() or "ATS MATCH" in cleaned_line.upper():
                    cleaned_line = number_pattern.sub(r'<b>\1</b>', cleaned_line)
                out_f.write(f"<p class='normal'>{cleaned_line}</p>\n")
                continue

            # Escribir la línea dependiendo de si es viñeta o no
            if in_bullets:
                # Quitar asteriscos o guiones si la IA los puso antes por error
                if cleaned_line.startswith("*") or cleaned_line.startswith("-"):
                    cleaned_line = cleaned_line[1:].strip()
                
                # Como tu archivo .txt anterior no tenía la orden de las negritas (<b>), 
                # usamos Python para resaltar los números automáticamente
                cleaned_line = number_pattern.sub(r'<b>\1</b>', cleaned_line)
                
                out_f.write(f"<p class='bullet'>{cleaned_line}</p>\n")
            else:
                out_f.write(f"<p class='normal'>{cleaned_line}</p>\n")

        out_f.write("</div>\n</body>\n</html>")
        
    print(f"¡Éxito! Tu archivo {input_file} ha sido convertido a HTML y guardado como {output_file}.")

if __name__ == "__main__":
    txt_to_html("resultados_optimizados.txt", "resultados_convertidos.html")
