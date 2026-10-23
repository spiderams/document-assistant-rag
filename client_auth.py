"""Connexion des scripts (évaluations, import, tests) à l'API protégée.

Les identifiants viennent du .env :
  RAG_ADMIN_EMAIL / RAG_ADMIN_PASSWORD   compte administrateur
  RAG_USER_EMAIL  / RAG_USER_PASSWORD    compte employé (tests de sécurité)
"""
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def get_token(kind: str = "admin") -> str:
    email = os.environ.get(f"RAG_{kind.upper()}_EMAIL")
    password = os.environ.get(f"RAG_{kind.upper()}_PASSWORD")
    if not email or not password:
        raise SystemExit(f"RAG_{kind.upper()}_EMAIL et RAG_{kind.upper()}_PASSWORD doivent être définis dans .env")
    client = create_client(os.environ["SUPABASE_URL"],
                           os.environ.get("SUPABASE_ANON_KEY") or os.environ["SUPABASE_SERVICE_KEY"])
    session = client.auth.sign_in_with_password({"email": email, "password": password}).session
    return session.access_token


def auth_headers(kind: str = "admin") -> dict:
    return {"Authorization": f"Bearer {get_token(kind)}"}
