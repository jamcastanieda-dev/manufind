# MTCE Manual Search Backend

FastAPI + SQLite backend for the MTCE Manual Search React UI.

## Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
fastapi dev main.py
```

Open the API docs:

```text
http://127.0.0.1:8000/docs
```

The SQLite database is created automatically at `backend/data/mtce_manual_search.db` and seeded with sample machines, manuals, cases, and searchable manual text.

## Main endpoints

- `GET /health`
- `GET /dashboard`
- `GET /machines`
- `POST /machines`
- `PUT /machines/{id}`
- `DELETE /machines/{id}`
- `GET /manuals`
- `POST /manuals/upload`
- `GET /manuals/search?q=E-204`
- `GET /cases`
- `POST /cases`
- `PUT /cases/{id}`
- `DELETE /cases/{id}`
- `GET /search-history`
- `DELETE /search-history`
