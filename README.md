# Internal Document Assistant (RAG) — with verified citations

A bilingual question-answering assistant for company documents. Employees ask a question in French or English; the assistant answers **only from the company's PDFs**, cites the **file, page and exact sentence** it relied on, and says so when the answer is not in the documents.

> Demo project. All documents (Boréal Solutions inc.) are fictional and were written to test the system.

![Chat screen](docs/screenshots/01-chat-answer.png)

## The problem

Policies, onboarding guides and procedures are spread across dozens of PDFs. Employees either search manually, ask HR the same questions again, or trust a generic chatbot that may invent an answer. For internal policies, a wrong but confident answer is worse than no answer.

## What it does

- **Answers grounded in documents only** — no general knowledge, no guessing.
- **Verifiable citations** — every answer links to the file and page, and quotes the exact sentence. The backend checks that the quote really exists word for word in the document (`verified: true`) and fixes the reference if the model points to the wrong passage.
- **Refuses when the information is missing** — "I can't find this information in the documents."
- **Bilingual** — answers in the language of the question (French or English), even when the source document is in the other language. Quotes stay in the original language so they can be verified.
- **Handles cross-document questions** — e.g. vacation entitlement is in the HR policy, but the onboarding guide says vacation can't be taken during probation.
- **Document management** — drag-and-drop PDF upload, automatic indexing, re-index and delete.
- **Automated evaluation** — 55 test questions score every change.

## Architecture

```
PDF upload ──► PyMuPDF (text per page) ──► chunking per page (≈1000 chars, 200 overlap)
                                                  │
                                                  ▼
                                   OpenAI embeddings (text-embedding-3-small)
                                                  │
                                                  ▼
                              Supabase PostgreSQL + pgvector (HNSW, cosine)

Question ──► embedding ──► top-5 passages (similarity ≥ 0.25)
                                  │
                       none ──────┴────── found
                        │                   │
                 "not found"        Claude (JSON: answer + citations + exact quotes)
                                            │
                                  quote verification against the passage
                                            │
                                            ▼
                         answer + sources (file, page, quote, verified)
```

| Layer | Technology |
|---|---|
| API | Python, FastAPI (Swagger at `/docs`) |
| PDF extraction | PyMuPDF |
| Database & vector search | Supabase PostgreSQL + pgvector |
| Embeddings | OpenAI `text-embedding-3-small` (multilingual) |
| Answer generation | Anthropic Claude API |
| Frontend | React + TypeScript + Vite, FR/EN switch (`frontend/`) |

**Design choices**
- Text is split **page by page**, so every passage keeps an exact page number for citations.
- Retrieved passages are treated as data, not instructions (basic prompt-injection guard).
- A similarity threshold stops off-topic questions before the model is even called.
- Claude returns structured JSON; the parser reads the first complete JSON object and ignores trailing text.

## Evaluation

`eval.py` sends every question of a test file to `/ask` and checks four things:

| Check | Meaning |
|---|---|
| `found_ok` | Answers when it should, refuses off-topic questions |
| `source_ok` | Cites the expected file and page |
| `content_ok` | The answer contains the expected facts (e.g. "0.62") |
| `verified_ok` | Every quote exists word for word in the cited passage |

The test sets include direct questions, **trick questions** (rules split across two documents, false premises, the same word with different meanings, a gift card under the dollar limit but forbidden anyway) and **off-topic questions** that must be refused. The index holds 12 documents: 6 in French and their 6 English versions.

| Test set | Direct | Trick | Off-topic | Total |
|---|---|---|---|---|
| French (27 questions) | 15/15 | 8/8 | 4/4 | **27/27** |
| English (28 questions) | 16/16 | 8/8 | 4/4 | **28/28** |

The first French runs scored 25/27, then 26/27. The failures led to two fixes: re-matching a quote to the right passage when the model used the wrong reference number, and tolerating text after the JSON. LLM output varies slightly between runs, so the evaluation should be run several times after each change.

```powershell
python eval.py questions_test.json      # French  -> eval_test.csv
python eval.py questions_test_en.json   # English -> eval_test_en.csv
```

## Run it locally

**Requirements:** Python 3.11+, Node.js 18+, a Supabase project, OpenAI and Anthropic API keys.

**1. Database** — in Supabase > SQL Editor, run `supabase/schema.sql`.

**2. Backend**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then fill in the keys
python -m uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

**3. Load the sample documents**
```powershell
python import_docs.py docs_test
python import_docs.py docs_test_en
```
After changing the chunking, re-index everything with `python import_docs.py docs_test --reindex` (same for `docs_test_en`).

**4. Frontend** (in `frontend/`)
```powershell
npm install
npm run dev
```
Open http://localhost:5173

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/documents` | Upload a PDF, extract its pages |
| GET | `/documents` | List documents and status |
| GET | `/documents/{id}/file` | Serve the PDF (used for "open at page N") |
| DELETE | `/documents/{id}` | Delete a document, its pages and its vectors |
| POST | `/documents/{id}/index` | Chunk, embed and store vectors |
| GET | `/search?q=` | Debug: raw nearest passages |
| POST | `/ask` | Question → answer with verified citations |

## Project structure

```
app/
  main.py         FastAPI routes
  db.py           Supabase client
  pdf.py          page extraction
  chunking.py     page-level chunking with overlap
  embeddings.py   OpenAI embeddings (batched)
  answer.py       prompt, language handling, JSON parsing, quote verification
supabase/schema.sql
frontend/         React interface (see frontend/README.md)
docs_test/        fictional company documents (French)
docs_test_en/     the same documents in English
questions_test.json / questions_test_en.json
eval.py           automated evaluation
import_docs.py    bulk upload + indexing
```

## Next steps

- Public read-only demo (rate limiting, upload disabled)
- Role-based access (e.g. HR documents visible to HR only)
- Section-aware chunking (split on headings such as `HR-03`)
- OCR for scanned PDFs
- Automatic ingestion from Google Drive or SharePoint with n8n
- Conversation history (follow-up questions)

## Screenshots

| | |
|---|---|
| ![Answer with verified citation](docs/screenshots/01-chat-answer.png) | ![Trick question across two documents](docs/screenshots/02-trick-question.png) |
| ![Documents](docs/screenshots/03-documents.png) | ![Evaluation](docs/screenshots/04-eval.png) |
