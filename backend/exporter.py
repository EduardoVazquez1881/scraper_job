import io
import re
from typing import List


def _clean_latin1(text: str) -> str:
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
        "\u00b7": "|",
        "\u2026": "...",
        "\u00a0": " ",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("latin-1", errors="ignore").decode("latin-1")


def _strip_md_bold(text: str) -> str:
    return re.sub(r"\*\*(.*?)\*\*", r"\1", text).replace("*", "")


def _add_bold_runs_docx(paragraph, text: str):
    parts = re.split(r"(\*\*.*?\*\*)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        else:
            paragraph.add_run(part.replace("*", ""))


def build_adapted_docx(cv_markdown: str, job: dict) -> bytes:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor

    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.65)
        section.right_margin = Inches(0.65)

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)

    lines = cv_markdown.splitlines()
    bullets: List[str] = [
        b for b in (job.get("bullets") or []) if "lista para análisis semántico" not in b
    ]
    injected = False

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("# "):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(_strip_md_bold(line[2:]))
            run.bold = True
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(17, 24, 39)
            continue

        if line.startswith("## "):
            # Inyectar bloque adaptado justo antes de Experiencia o Perfil si hay bullets optimizados
            if bullets and not injected and any(
                k in line.lower() for k in ("experiencia", "experience")
            ):
                h_adapt = doc.add_paragraph()
                h_adapt.paragraph_format.space_before = Pt(10)
                h_adapt.paragraph_format.space_after = Pt(3)
                r_adapt = h_adapt.add_run(
                    f"IMPACTO RELEVANTE — {job.get('title', '').upper()} ({job.get('company', '').upper()})"
                )
                r_adapt.bold = True
                r_adapt.font.size = Pt(11)
                r_adapt.font.color.rgb = RGBColor(15, 118, 110)
                for b in bullets:
                    bp = doc.add_paragraph(style="List Bullet")
                    bp.paragraph_format.space_after = Pt(2)
                    _add_bold_runs_docx(bp, b)
                injected = True

            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(_strip_md_bold(line[3:]).upper())
            run.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(17, 24, 39)
            continue

        if line.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(1)
            run = p.add_run(_strip_md_bold(line[4:]))
            run.bold = True
            run.font.size = Pt(10.5)
            continue

        if line.startswith("- ") or line.startswith("* "):
            bp = doc.add_paragraph(style="List Bullet")
            bp.paragraph_format.space_after = Pt(2)
            _add_bold_runs_docx(bp, line[2:])
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        _add_bold_runs_docx(p, line)

    # Si el CV vino de un PDF plano sin encabezados '## Experiencia', añadir al inicio/final
    if bullets and not injected:
        h_adapt = doc.add_paragraph()
        h_adapt.paragraph_format.space_before = Pt(10)
        r_adapt = h_adapt.add_run(
            f"PUNTOS CLAVE PARA {job.get('title', '').upper()} — {job.get('company', '').upper()}"
        )
        r_adapt.bold = True
        r_adapt.font.size = Pt(11)
        for b in bullets:
            bp = doc.add_paragraph(style="List Bullet")
            bp.paragraph_format.space_after = Pt(2)
            _add_bold_runs_docx(bp, b)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def build_adapted_pdf(cv_markdown: str, job: dict) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(format="letter")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(16, 15, 16)
    pdf.add_page()

    bullets: List[str] = [
        b for b in (job.get("bullets") or []) if "lista para análisis semántico" not in b
    ]
    injected = False

    def write_line(height: float, raw_txt: str):
        cleaned = _clean_latin1(raw_txt).strip()
        if not cleaned:
            return
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(
            pdf.epw,
            height,
            cleaned,
            new_x="LMARGIN",
            new_y="NEXT",
        )

    def write_bullet_block():
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(15, 118, 110)
        header_txt = f"IMPACTO RELEVANTE - {job.get('title', '').upper()} ({job.get('company', '').upper()})"
        write_line(5.5, header_txt)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(16, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(1.5)
        pdf.set_font("Helvetica", "", 9.8)
        pdf.set_text_color(30, 30, 30)
        for b in bullets:
            write_line(5, "- " + _strip_md_bold(b))
            pdf.ln(0.5)

    for raw_line in cv_markdown.splitlines():
        line = raw_line.strip()
        if not line:
            pdf.ln(1.5)
            continue

        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.set_text_color(17, 24, 39)
            write_line(7, _strip_md_bold(line[2:]))
            continue

        if line.startswith("## "):
            if bullets and not injected and any(
                k in line.lower() for k in ("experiencia", "experience")
            ):
                write_bullet_block()
                injected = True

            pdf.ln(2.5)
            pdf.set_font("Helvetica", "B", 10.5)
            pdf.set_text_color(17, 24, 39)
            write_line(5.5, _strip_md_bold(line[3:]).upper())
            pdf.set_draw_color(210, 210, 210)
            pdf.line(16, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(1.5)
            continue

        if line.startswith("### "):
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(25, 25, 25)
            write_line(5, _strip_md_bold(line[4:]))
            continue

        if line.startswith("- ") or line.startswith("* "):
            pdf.set_font("Helvetica", "", 9.8)
            pdf.set_text_color(35, 35, 35)
            write_line(4.8, "- " + _strip_md_bold(line[2:]))
            continue

        pdf.set_font("Helvetica", "", 9.8)
        pdf.set_text_color(55, 55, 55)
        write_line(4.8, _strip_md_bold(line))

    if bullets and not injected:
        write_bullet_block()

    return bytes(pdf.output())
