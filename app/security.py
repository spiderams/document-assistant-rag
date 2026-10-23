"""Authentification, rôles et limitation des requêtes.

- L'utilisateur se connecte avec Supabase Auth (courriel + mot de passe) dans l'interface.
- Chaque requête envoie son jeton : « Authorization: Bearer <jeton> ».
- Le backend vérifie le jeton auprès de Supabase, puis lit le rôle dans la table profiles.

Codes renvoyés :
  401  pas de jeton, ou jeton invalide / expiré
  403  connecté, mais rôle insuffisant (route réservée aux administrateurs)
  429  trop de questions en peu de temps (les administrateurs ne sont pas limités)
"""
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from app.db import supabase

CACHE_SECONDS = 60  # évite d'interroger Supabase à chaque requête


@dataclass
class User:
    id: str
    email: str
    role: str  # "admin" ou "user"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


_token_cache: dict[str, tuple[float, "User"]] = {}
_cache_lock = threading.Lock()


def _role_for(user_id: str) -> str:
    rows = supabase.table("profiles").select("role").eq("user_id", user_id).limit(1).execute().data
    return rows[0]["role"] if rows else "user"


def get_current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authentification requise.", headers={"WWW-Authenticate": "Bearer"})
    token = authorization.split(" ", 1)[1].strip()

    now = time.time()
    with _cache_lock:
        cached = _token_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]

    try:
        auth_user = supabase.auth.get_user(token).user
    except Exception:
        auth_user = None
    if not auth_user:
        raise HTTPException(401, "Session invalide ou expirée. Reconnectez-vous.",
                            headers={"WWW-Authenticate": "Bearer"})

    user = User(id=auth_user.id, email=auth_user.email or "", role=_role_for(auth_user.id))
    with _cache_lock:
        if len(_token_cache) > 1000:  # simple garde-fou mémoire
            _token_cache.clear()
        _token_cache[token] = (now + CACHE_SECONDS, user)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Action réservée aux administrateurs.")
    return user


class RateLimiter:
    """Limite par utilisateur, en mémoire : N questions par minute et M par jour.

    Suffisant pour une seule instance du serveur. Pour plusieurs instances, il faudrait
    un stockage partagé (Redis, par exemple)."""

    def __init__(self, per_minute: int, per_day: int):
        self.per_minute = per_minute
        self.per_day = per_day
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.time()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - 86400:
                hits.popleft()
            last_minute = sum(1 for t in hits if t > now - 60)
            if last_minute >= self.per_minute:
                oldest = next(t for t in hits if t > now - 60)
                retry = max(1, int(oldest + 60 - now) + 1)
                raise HTTPException(429, f"Trop de questions. Réessayez dans {retry} s.",
                                    headers={"Retry-After": str(retry)})
            if len(hits) >= self.per_day:
                raise HTTPException(429, "Limite quotidienne atteinte. Réessayez demain.",
                                    headers={"Retry-After": "3600"})
            hits.append(now)


question_limiter = RateLimiter(
    per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "10")),
    per_day=int(os.getenv("RATE_LIMIT_PER_DAY", "200")),
)


def rate_limited_user(user: User = Depends(get_current_user)) -> User:
    """Utilisateur connecté, soumis à la limite de questions (sauf administrateurs)."""
    if not user.is_admin:
        question_limiter.check(user.id)
    return user
