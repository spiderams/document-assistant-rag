"""Importe et indexe tous les PDF d'un dossier en appelant l'API (le serveur doit tourner).

Utilisation :  python import_docs.py docs_test
               python import_docs.py docs_test --reindex   (refait l'indexation, ex. après un changement du découpage)
"""
import sys
from pathlib import Path

import httpx

from client_auth import auth_headers

API = "http://127.0.0.1:8000"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    reindex = "--reindex" in sys.argv
    folder = Path(args[0] if args else "docs_test")
    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        print(f"Aucun PDF trouvé dans {folder.resolve()}")
        return

    with httpx.Client(headers=auth_headers("admin"), timeout=120) as client:
        try:
            r = client.get(f"{API}/documents")
        except httpx.ConnectError:
            print(f"Serveur injoignable sur {API}. Lance d'abord : python -m uvicorn app.main:app --reload")
            return
        if r.status_code != 200:
            print(f"Le serveur a répondu {r.status_code} : {r.text[:300]}")
            print("Regarde l'erreur complète dans la fenêtre où tourne uvicorn (souvent une clé du .env invalide).")
            return
        existing = {d["filename"]: d for d in r.json()}

        for pdf in pdfs:
            doc = existing.get(pdf.name)

            if doc is None:
                with pdf.open("rb") as f:
                    r = client.post(f"{API}/documents", files={"file": (pdf.name, f, "application/pdf")})
                if r.status_code != 201:
                    print(f"XX {pdf.name} : import échoué ({r.status_code}) {r.text[:200]}")
                    continue
                doc = r.json()
                print(f"   {pdf.name} : importé ({doc['page_count']} pages)")
            elif doc["status"] == "indexed" and not reindex:
                print(f"OK {pdf.name} : déjà importé et indexé")
                continue

            r = client.post(f"{API}/documents/{doc['id']}/index")
            if r.status_code == 200:
                print(f"OK {pdf.name} : indexé ({r.json()['chunks']} passages)")
            else:
                print(f"XX {pdf.name} : indexation échouée ({r.status_code}) {r.text[:200]}")


if __name__ == "__main__":
    main()