import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.agent import run_agent
from app.answer import answer_question, not_found_message
from app.chunking import chunk_text
from app.db import supabase
from app.embeddings import embed_texts
from app.pdf import extract_pages
from app.retrieval import retrieve
from app.security import User, get_current_user, rate_limited_user, require_admin

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_SIZE = 20 * 1024 * 1024  # 20 Mo

app = FastAPI(title="RAG Docs", description="Assistant documentaire")


@app.get("/me")
def me(user: User = Depends(get_current_user)):
    """Utilisateur connecté et son rôle (l'interface s'en sert pour afficher les actions d'administration)."""
    return {"id": user.id, "email": user.email, "role": user.role}


# ---------- Module 1 : documents ----------

@app.post("/documents", status_code=201)
def upload_document(file: UploadFile = File(...), _: User = Depends(require_admin)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Seuls les fichiers PDF sont acceptés.")

    content = file.file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "Fichier trop gros (max 20 Mo).")
    if not content.startswith(b"%PDF"):
        raise HTTPException(400, "Ce fichier n'est pas un vrai PDF.")

    existing = supabase.table("documents").select("id").eq("filename", file.filename).execute()
    if existing.data:
        raise HTTPException(409, "Un document avec ce nom existe déjà.")

    doc_id = str(uuid.uuid4())
    path = UPLOAD_DIR / f"{doc_id}.pdf"
    path.write_bytes(content)

    try:
        pages = extract_pages(path)
    except Exception as e:
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"PDF illisible : {e}")

    with_text = [(n, t) for n, t in pages if t.strip()]
    status = "uploaded" if with_text else "error"
    error = None if with_text else "Aucun texte détecté (PDF scanné ?)"

    supabase.table("documents").insert({
        "id": doc_id,
        "filename": file.filename,
        "page_count": len(pages),
        "status": status,
        "error": error,
    }).execute()

    rows = [{"document_id": doc_id, "page_number": n, "text": t} for n, t in with_text]
    for i in range(0, len(rows), 100):
        supabase.table("pages").insert(rows[i:i + 100]).execute()

    return {"id": doc_id, "filename": file.filename, "page_count": len(pages),
            "pages_with_text": len(with_text), "status": status, "error": error}


@app.get("/documents")
def list_documents(_: User = Depends(get_current_user)):
    res = (supabase.table("documents")
           .select("id, filename, page_count, status, error, created_at")
           .order("created_at", desc=True)
           .execute())
    return res.data


@app.get("/documents/{doc_id}/file")
def get_document_file(doc_id: str, _: User = Depends(get_current_user)):
    """Renvoie le PDF pour l'afficher dans le navigateur (l'interface ajoute #page=N)."""
    try:
        uuid.UUID(doc_id)  # empêche un chemin du type ../../
    except ValueError:
        raise HTTPException(400, "Identifiant invalide.")
    path = UPLOAD_DIR / f"{doc_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "Fichier introuvable.")
    return FileResponse(path, media_type="application/pdf")


@app.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, _: User = Depends(require_admin)):
    res = supabase.table("documents").select("id").eq("id", doc_id).execute()
    if not res.data:
        raise HTTPException(404, "Document introuvable.")

    supabase.table("documents").delete().eq("id", doc_id).execute()
    (UPLOAD_DIR / f"{doc_id}.pdf").unlink(missing_ok=True)


# ---------- Module 2 : indexation et recherche ----------

@app.post("/documents/{doc_id}/index")
def index_document(doc_id: str, _: User = Depends(require_admin)):
    doc = supabase.table("documents").select("id, filename").eq("id", doc_id).execute()
    if not doc.data:
        raise HTTPException(404, "Document introuvable.")

    pages = (supabase.table("pages")
             .select("page_number, text")
             .eq("document_id", doc_id)
             .order("page_number")
             .execute()).data
    if not pages:
        raise HTTPException(400, "Ce document n'a aucune page avec du texte.")

    items = []
    for p in pages:
        for i, content in enumerate(chunk_text(p["text"])):
            items.append({"document_id": doc_id, "page_number": p["page_number"],
                          "chunk_index": i, "content": content})

    try:
        vectors = embed_texts([it["content"] for it in items])
    except Exception as e:
        supabase.table("documents").update({"status": "error", "error": f"Embeddings : {e}"}).eq("id", doc_id).execute()
        raise HTTPException(502, f"Erreur OpenAI : {e}")

    for it, v in zip(items, vectors):
        it["embedding"] = v

    supabase.table("chunks").delete().eq("document_id", doc_id).execute()
    for i in range(0, len(items), 100):
        supabase.table("chunks").insert(items[i:i + 100]).execute()

    supabase.table("documents").update({"status": "indexed", "error": None}).eq("id", doc_id).execute()
    return {"id": doc_id, "filename": doc.data[0]["filename"], "pages": len(pages), "chunks": len(items)}


@app.get("/search")
def search(q: str, k: int = 5, _: User = Depends(rate_limited_user)):
    """Route de test : renvoie les k passages les plus proches de la question."""
    query_vector = embed_texts([q])[0]
    res = supabase.rpc("match_chunks", {"query_embedding": query_vector, "match_count": k}).execute()
    return res.data


# ---------- Module 3 : questions et réponses ----------

class AskRequest(BaseModel):
    question: str
    k: int = 5


@app.post("/ask")
def ask(req: AskRequest, _: User = Depends(rate_limited_user)):
    question = req.question.strip()
    if not question:
        raise HTTPException(400, "La question est vide.")

    passages = retrieve(question, k=req.k)

    if not passages:
        return {"question": question, "answer": not_found_message(question), "found": False, "sources": []}

    try:
        result = answer_question(question, passages)
    except Exception as e:
        raise HTTPException(502, f"Erreur Claude : {e}")

    return {"question": question, **result}


# ---------- Version 2 : agent avec outils (lecture seule) ----------

class AgentRequest(BaseModel):
    question: str


@app.post("/agent")
def agent(req: AgentRequest, _: User = Depends(rate_limited_user)):
    question = req.question.strip()
    if not question:
        raise HTTPException(400, "La question est vide.")
    try:
        return run_agent(question)
    except Exception as e:
        raise HTTPException(502, f"Erreur de l'agent : {e}")


@app.get("/agent/runs")
def agent_runs(limit: int = 20, _: User = Depends(require_admin)):
    """Journal : les dernières exécutions de l'agent (outils appelés, durée, résultat)."""
    res = (supabase.table("agent_runs")
           .select("*")
           .order("created_at", desc=True)
           .limit(min(limit, 100))
           .execute())
    return res.data
