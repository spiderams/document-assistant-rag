import re

# Fin de phrase : . ! ? (éventuellement suivi de » ou ") puis une espace.
_SENTENCE_END = re.compile(r'[.!?]["»”)]?\s')


def _sentence_starts(text: str, lo: int, hi: int) -> list[int]:
    """Positions où commence une phrase, entre lo et hi."""
    return [m.end() for m in _SENTENCE_END.finditer(text, max(lo - 3, 0), hi) if lo <= m.end() <= hi]


def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    """Découpe en passages d'environ `size` caractères, avec un chevauchement d'au moins `overlap`.

    Les passages commencent et se terminent sur une fin de phrase quand c'est possible,
    pour qu'une règle ne soit jamais coupée en deux (ex. « …es 24 heures »).
    """
    text = " ".join(text.split())
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            # Fin du passage : dernière fin de phrase dans la 2e moitié, sinon dernière espace.
            ends = _sentence_starts(text, start + size // 2, end)
            if ends:
                end = ends[-1]
            else:
                cut = text.rfind(" ", start + size // 2, end)
                if cut != -1:
                    end = cut
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break

        # Début du passage suivant : un début de phrase qui donne au moins `overlap` caractères
        # de chevauchement ; sinon le premier début de phrase dans la zone ; sinon un début de mot.
        before = _sentence_starts(text, start + 1, end - overlap)
        inside = _sentence_starts(text, end - overlap, end - 1)
        if before:
            nxt = before[-1]
        elif inside:
            nxt = inside[0]
        else:
            space = text.find(" ", end - overlap, end)
            nxt = space + 1 if space != -1 else end - overlap
        start = max(nxt, start + 1)
    return chunks
