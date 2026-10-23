from app.db import supabase
from app.embeddings import embed_texts

MIN_SIMILARITY = 0.25  # en dessous, on considère que le passage n'est pas pertinent


def retrieve(query: str, k: int = 5) -> list[dict]:
    """Renvoie les k passages les plus proches de la requête, au-dessus du seuil de similarité."""
    query_vector = embed_texts([query])[0]
    res = supabase.rpc("match_chunks", {"query_embedding": query_vector, "match_count": k}).execute()
    return [p for p in res.data if p["similarity"] >= MIN_SIMILARITY]
