from pathlib import Path
import pymupdf


def extract_pages(path: Path) -> list[tuple[int, str]]:
    """Retourne [(numéro_de_page, texte), ...], pages numérotées à partir de 1."""
    with pymupdf.open(path) as doc:
        # \x00 est retiré parce que PostgreSQL refuse ce caractère dans un texte
        return [(i + 1, page.get_text().replace("\x00", "")) for i, page in enumerate(doc)]