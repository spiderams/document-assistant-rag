"""Évaluation du RAG : pose chaque question de questions_test.json à /ask et calcule un score."""
import csv
import json
import sys
import time

import httpx

from client_auth import auth_headers

API_URL = "http://127.0.0.1:8000/ask"


def norm(s: str) -> str:
    for a, b in (("’", "'"), ("\u00a0", " "), ("\u202f", " ")):
        s = s.replace(a, b)
    return " ".join(s.split()).lower()


def evaluate(q: dict, res: dict) -> dict:
    found_ok = res["found"] == q["expected_found"]

    if not q["expected_found"]:
        # Question hors sujet : il suffit que le RAG refuse de répondre
        return {"found_ok": found_ok, "source_ok": found_ok, "content_ok": found_ok, "verified_ok": found_ok}

    got = {(s["filename"], s["page"]) for s in res["sources"]}
    expected = {(s["filename"], s["page"]) for s in q["expected_sources"]}
    source_ok = bool(got & expected)  # au moins une source attendue est citée
    content_ok = all(norm(m) in norm(res["answer"]) for m in q["must_contain"])
    verified_ok = bool(res["sources"]) and all(s["verified"] for s in res["sources"])
    return {"found_ok": found_ok, "source_ok": source_ok, "content_ok": content_ok, "verified_ok": verified_ok}


def main():
    qfile = sys.argv[1] if len(sys.argv) > 1 else "questions_test.json"
    with open(qfile, encoding="utf-8") as f:
        questions = json.load(f)
    if not questions:
        print(f"Aucune question dans {qfile}")
        return
    out_csv = qfile.replace("questions_", "eval_").replace(".json", ".csv")
    rows = []

    with httpx.Client(headers=auth_headers("admin"), timeout=60) as client:
        for q in questions:
            t0 = time.time()
            try:
                r = client.post(API_URL, json={"question": q["question"]})
            except httpx.ConnectError:
                print(f"Serveur injoignable sur {API_URL}. Lance d'abord : python -m uvicorn app.main:app --reload")
                return
            if r.status_code == 200:
                res = r.json()
            else:
                res = {"answer": f"ERREUR {r.status_code} : {r.text[:300]}", "found": None, "sources": []}
                print(f"   -> {res['answer']}")
            score = evaluate(q, res)
            ok = all(score.values())
            rows.append({
                "id": q["id"], "type": q["type"], "ok": ok, **score,
                "secondes": round(time.time() - t0, 1),
                "question": q["question"], "reponse": res["answer"],
                "sources": "; ".join(f'{s["filename"]} p.{s["page"]}' for s in res["sources"]),
            })
            print(f'{"OK " if ok else "XX "} {q["id"]} [{q["type"]}] {q["question"]}')

    print("\n===== RESULTS =====")
    total = len(rows)
    print(f"Total score : {sum(r['ok'] for r in rows)}/{total}")
    for t in dict.fromkeys(r["type"] for r in rows):
        sub = [r for r in rows if r["type"] == t]
        if sub:
            print(f"  {t:<11}: {sum(r['ok'] for r in sub)}/{len(sub)}")
    for k in ("found_ok", "source_ok", "content_ok", "verified_ok"):
        print(f"  {k:<11}: {sum(r[k] for r in rows)}/{total}")

    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f"\nDetails saved to {out_csv}")


if __name__ == "__main__":
    main()