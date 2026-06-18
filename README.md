# MTCE Manual Search System

React + FastAPI project based on the Lovable UI reference.

## What is included

- `frontend/` — React/TanStack UI from Lovable, now wired to FastAPI endpoints
- `backend/` — FastAPI + SQLite API for machines, manuals, PDF upload, manual text search, cases, and search history

## Run the backend

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

Backend URL:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

The database is created automatically in `backend/data/mtce_manual_search.db` and seeded with sample data.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:8080
```

The frontend expects the backend at:

```text
http://127.0.0.1:8000
```

To change it, copy `.env.example` to `.env` inside `frontend/` and edit `VITE_API_URL`.

## Current features

- Dashboard connected to FastAPI
- Machine CRUD
- Manual list and delete
- PDF upload and text indexing
- Manual search endpoint with snippets and page numbers
- Case create/update/delete
- Search history and clear history
- API live/off badge in the header

## Good next steps

1. Add real authentication and user roles.
2. Add a real PDF viewer page instead of opening the raw PDF file.
3. Improve search with SQLite FTS5 or a vector database.
4. Add users/permissions for Admin, Technician, and Operator.
