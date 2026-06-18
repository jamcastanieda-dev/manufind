from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from database import UPLOAD_DIR, get_connection, init_db, row_to_dict, rows_to_dicts
from pdf_service import extract_pdf_pages, make_snippet
from schemas import CaseCreate, CaseUpdate, MachineCreate, MachineUpdate, ManualCreate

app = FastAPI(title="MTCE Manual Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize SQLite when the API process starts. init_db() is idempotent,
# so it is safe to run again if the server reloads during development.
init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "MTCE Manual Search API is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "Connected", "service": "FastAPI", "database": "SQLite"}


def get_machine_or_404(machine_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM machines WHERE id = ?", (machine_id,)).fetchone()
    data = row_to_dict(row)
    if not data:
        raise HTTPException(status_code=404, detail="Machine not found")
    return data


def machine_rows() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                m.id,
                m.name,
                m.model,
                m.department,
                m.status,
                COUNT(DISTINCT manuals.id) AS manualsCount,
                COUNT(DISTINCT CASE WHEN cases.status != 'Resolved' THEN cases.id END) AS openCases
            FROM machines m
            LEFT JOIN manuals ON manuals.machine_id = m.id
            LEFT JOIN cases ON cases.machine_id = m.id
            GROUP BY m.id
            ORDER BY m.name
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/dashboard")
def dashboard() -> dict[str, Any]:
    machines = machine_rows()
    manuals = list_manuals()
    cases = list_cases()
    with get_connection() as conn:
        history = rows_to_dicts(
            conn.execute("SELECT * FROM search_history ORDER BY id DESC LIMIT 5").fetchall()
        )
    return {
        "stats": {
            "machines": len(machines),
            "manuals": len(manuals),
            "indexedPdfs": len([m for m in manuals if m["status"] == "Indexed"]),
            "openCases": len([c for c in cases if c["status"] != "Resolved"]),
            "searches": len(history),
        },
        "machines": machines,
        "manuals": manuals,
        "cases": cases,
        "searchHistory": history,
        "recentActivity": [
            {"id": "a1", "text": "FastAPI backend connected to SQLite", "time": "Now"},
            {"id": "a2", "text": "Manual search endpoint is ready", "time": "Now"},
            {"id": "a3", "text": "Sample machines, manuals, cases, and search pages seeded", "time": "Now"},
        ],
    }


@app.get("/machines")
def list_machines() -> list[dict[str, Any]]:
    return machine_rows()


@app.post("/machines", status_code=201)
def create_machine(machine: MachineCreate) -> dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO machines (name, model, department, status) VALUES (?, ?, ?, ?)",
            (machine.name, machine.model, machine.department, machine.status),
        )
        conn.commit()
        machine_id = cursor.lastrowid
    return get_machine(machine_id)


@app.get("/machines/{machine_id}")
def get_machine(machine_id: int) -> dict[str, Any]:
    return next((m for m in machine_rows() if m["id"] == machine_id), get_machine_or_404(machine_id))


@app.put("/machines/{machine_id}")
def update_machine(machine_id: int, machine: MachineUpdate) -> dict[str, Any]:
    get_machine_or_404(machine_id)
    fields = machine.model_dump(exclude_unset=True)
    if fields:
        assignments = ", ".join(f"{key} = ?" for key in fields.keys())
        values = list(fields.values()) + [machine_id]
        with get_connection() as conn:
            conn.execute(f"UPDATE machines SET {assignments} WHERE id = ?", values)
            conn.commit()
    return get_machine(machine_id)


@app.delete("/machines/{machine_id}")
def delete_machine(machine_id: int) -> dict[str, str]:
    get_machine_or_404(machine_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM machines WHERE id = ?", (machine_id,))
        conn.commit()
    return {"message": "Machine deleted"}


@app.get("/manuals")
def list_manuals() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                manuals.id,
                manuals.title,
                manuals.machine_id AS machineId,
                machines.name AS machineName,
                machines.model,
                manuals.file_name AS fileName,
                manuals.upload_date AS uploadDate,
                manuals.file_type AS fileType,
                manuals.status,
                manuals.pages,
                manuals.description,
                manuals.file_path AS filePath
            FROM manuals
            JOIN machines ON machines.id = manuals.machine_id
            ORDER BY manuals.id DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.post("/manuals", status_code=201)
def create_manual(manual: ManualCreate) -> dict[str, Any]:
    get_machine_or_404(manual.machine_id)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO manuals (title, machine_id, file_name, status, pages, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (manual.title, manual.machine_id, manual.file_name, manual.status, manual.pages, manual.description),
        )
        conn.commit()
        manual_id = cursor.lastrowid
    return get_manual(manual_id)


@app.get("/manuals/search")
def search_manuals(
    q: str = Query(..., min_length=1),
    machine_id: int | None = None,
    manual_id: int | None = None,
) -> dict[str, Any]:
    params: list[Any] = [f"%{q.lower()}%"]
    where = ["LOWER(manual_pages.text) LIKE ?", "manuals.status = 'Indexed'"]

    if machine_id:
        where.append("manuals.machine_id = ?")
        params.append(machine_id)
    if manual_id:
        where.append("manuals.id = ?")
        params.append(manual_id)

    query = f"""
        SELECT
            manual_pages.id,
            manuals.id AS manualId,
            manuals.title AS manualTitle,
            machines.name AS machineName,
            machines.model,
            manual_pages.page_number AS page,
            manual_pages.text AS fullText
        FROM manual_pages
        JOIN manuals ON manuals.id = manual_pages.manual_id
        JOIN machines ON machines.id = manuals.machine_id
        WHERE {' AND '.join(where)}
        ORDER BY manual_pages.page_number ASC
        LIMIT 50
    """
    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute(query, params).fetchall())

    results = []
    for row in rows:
        text = row.pop("fullText")
        lowered = text.lower()
        occurrences = lowered.count(q.lower())
        confidence = min(0.99, 0.70 + occurrences * 0.08)
        results.append(
            {
                **row,
                "snippet": make_snippet(text, q),
                "keyword": q,
                "confidence": round(confidence, 2),
            }
        )

    scope = "All manuals"
    if machine_id:
        scope = get_machine_or_404(machine_id)["name"]
    if manual_id:
        scope = get_manual(manual_id)["title"]

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO search_history (keyword, scope, results_count) VALUES (?, ?, ?)",
            (q, scope, len(results)),
        )
        conn.commit()

    return {"query": q, "results": results, "resultsCount": len(results)}


@app.get("/manuals/{manual_id}")
def get_manual(manual_id: int) -> dict[str, Any]:
    manual = next((m for m in list_manuals() if m["id"] == manual_id), None)
    if not manual:
        raise HTTPException(status_code=404, detail="Manual not found")
    return manual


@app.delete("/manuals/{manual_id}")
def delete_manual(manual_id: int) -> dict[str, str]:
    manual = get_manual(manual_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM manuals WHERE id = ?", (manual_id,))
        conn.commit()
    file_path = manual.get("filePath")
    if file_path:
        path = Path(file_path)
        if path.exists():
            path.unlink()
    return {"message": "Manual deleted"}


@app.post("/manuals/upload", status_code=201)
async def upload_manual(
    machine_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    get_machine_or_404(machine_id)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_name = f"{timestamp}_{Path(file.filename).name.replace(' ', '_')}"
    file_path = UPLOAD_DIR / safe_name

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    status = "Indexed"
    pages: list[dict[str, object]] = []
    try:
        pages = extract_pdf_pages(file_path)
        if len(pages) == 0:
            status = "Failed"
    except Exception:
        status = "Failed"

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO manuals (title, machine_id, file_name, file_path, status, pages, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (title, machine_id, file.filename, str(file_path), status, len(pages), description),
        )
        manual_id = cursor.lastrowid
        for page in pages:
            conn.execute(
                "INSERT INTO manual_pages (manual_id, page_number, text) VALUES (?, ?, ?)",
                (manual_id, page["page_number"], page["text"]),
            )
        conn.commit()

    return get_manual(manual_id)


@app.get("/manuals/{manual_id}/file")
def get_manual_file(manual_id: int):
    manual = get_manual(manual_id)
    file_path = manual.get("filePath")
    if not file_path or not Path(file_path).exists():
        return PlainTextResponse(
            f"Demo manual: {manual['title']}\n\n"
            "This seeded manual has searchable sample text in SQLite, but no original PDF file. "
            "Upload a real PDF from the Upload Manual page to open the actual document here.",
            media_type="text/plain",
        )
    return FileResponse(file_path, media_type="application/pdf", filename=manual["fileName"])




@app.get("/cases")
def list_cases() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                cases.id,
                cases.title,
                cases.machine_id AS machineId,
                machines.name AS machineName,
                cases.priority,
                cases.status,
                cases.created_by AS createdBy,
                cases.created_at AS createdAt,
                cases.description
            FROM cases
            JOIN machines ON machines.id = cases.machine_id
            ORDER BY cases.id DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.post("/cases", status_code=201)
def create_case(case: CaseCreate) -> dict[str, Any]:
    get_machine_or_404(case.machine_id)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO cases (title, machine_id, priority, status, created_by, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (case.title, case.machine_id, case.priority, case.status, case.created_by, case.description),
        )
        conn.commit()
        case_id = cursor.lastrowid
    return get_case(case_id)


@app.get("/cases/{case_id}")
def get_case(case_id: int) -> dict[str, Any]:
    case = next((c for c in list_cases() if c["id"] == case_id), None)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.put("/cases/{case_id}")
def update_case(case_id: int, case: CaseUpdate) -> dict[str, Any]:
    get_case(case_id)
    fields = case.model_dump(exclude_unset=True)
    rename = {"machine_id": "machine_id", "created_by": "created_by"}
    if fields:
        assignments = ", ".join(f"{rename.get(key, key)} = ?" for key in fields.keys())
        values = list(fields.values()) + [case_id]
        with get_connection() as conn:
            conn.execute(f"UPDATE cases SET {assignments} WHERE id = ?", values)
            conn.commit()
    return get_case(case_id)


@app.delete("/cases/{case_id}")
def delete_case(case_id: int) -> dict[str, str]:
    get_case(case_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
        conn.commit()
    return {"message": "Case deleted"}


@app.get("/search-history")
def list_search_history() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, keyword, scope, date, results_count AS resultsCount
            FROM search_history
            ORDER BY id DESC
            LIMIT 50
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.delete("/search-history")
def clear_search_history() -> dict[str, str]:
    with get_connection() as conn:
        conn.execute("DELETE FROM search_history")
        conn.commit()
    return {"message": "Search history cleared"}
