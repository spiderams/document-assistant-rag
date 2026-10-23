"""Tests de sécurité de l'API (le serveur doit tourner).

Vérifie, pour chaque route :
  - sans jeton            -> 401
  - jeton invalide        -> 401
  - compte employé        -> accès aux routes de lecture, 403 sur les routes d'administration
  - compte administrateur -> accès aux routes d'administration
et teste la limite de questions (sans appeler l'IA).

Aucune requête de ce script ne supprime ni n'importe de document, et aucune ne coûte d'appel à l'IA :
les suppressions visent un identifiant qui n'existe pas.
"""
import uuid

import httpx
from fastapi import HTTPException

from app.security import RateLimiter
from client_auth import auth_headers

API = "http://127.0.0.1:8000"
FAKE_ID = str(uuid.uuid4())  # document inexistant : un admin reçoit 404, jamais une vraie suppression

# (méthode, route, code attendu pour un employé, code attendu pour un admin)
ROUTES = [
    ("GET", "/me", 200, 200),
    ("GET", "/documents", 200, 200),
    ("GET", f"/documents/{FAKE_ID}/file", 404, 404),
    ("POST", "/documents", 403, 422),            # admin : 422 car aucun fichier n'est envoyé
    ("DELETE", f"/documents/{FAKE_ID}", 403, 404),
    ("POST", f"/documents/{FAKE_ID}/index", 403, 404),
    ("GET", "/agent/runs", 403, 200),
    ("POST", "/ask", None, None),                 # seulement 401 testé ici (pas d'appel à l'IA)
    ("POST", "/agent", None, None),
    ("GET", "/search?q=test", None, None),
]

results = []


def check(label: str, got: int, expected: int) -> None:
    ok = got == expected
    results.append(ok)
    print(f'{"OK " if ok else "XX "} {label:<45} attendu {expected}, reçu {got}')


def call(client: httpx.Client, method: str, path: str, headers: dict | None = None) -> int:
    return client.request(method, API + path, headers=headers or {}).status_code


def main():
    user = auth_headers("user")
    admin = auth_headers("admin")
    bad = {"Authorization": "Bearer jeton-invalide"}

    with httpx.Client(timeout=30) as c:
        print("--- Sans jeton / jeton invalide : 401 ---")
        for method, path, _, _ in ROUTES:
            check(f"{method} {path.split('?')[0]} sans jeton", call(c, method, path), 401)
        check("GET /documents jeton invalide", call(c, "GET", "/documents", bad), 401)

        print("\n--- Compte employé ---")
        for method, path, exp_user, _ in ROUTES:
            if exp_user is not None:
                check(f"{method} {path} (employé)", call(c, method, path, user), exp_user)

        print("\n--- Compte administrateur ---")
        for method, path, _, exp_admin in ROUTES:
            if exp_admin is not None:
                check(f"{method} {path} (admin)", call(c, method, path, admin), exp_admin)

    print("\n--- Limite de questions (test local, sans serveur) ---")
    limiter = RateLimiter(per_minute=3, per_day=100)
    codes = []
    for _ in range(4):
        try:
            limiter.check("employe-test")
            codes.append(200)
        except HTTPException as e:
            codes.append(e.status_code)
    check("4e question en moins d'une minute", codes[-1], 429)
    check("3 premières questions acceptées", 200 if codes[:3] == [200, 200, 200] else codes[0], 200)

    print("\n===== RESULTS =====")
    print(f"Security checks : {sum(results)}/{len(results)}")


if __name__ == "__main__":
    main()
