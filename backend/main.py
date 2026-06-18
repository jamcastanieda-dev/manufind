from __future__ import annotations

import mimetypes
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from database import MACHINE_IMAGE_DIR, UPLOAD_DIR, get_connection, init_db, row_to_dict, rows_to_dicts
from pdf_service import extract_page_highlight_boxes, extract_pdf_pages, make_snippet
from schemas import CaseCreate, CaseUpdate, MachineCreate, MachineUpdate, ManualCreate

app = FastAPI(title="MTCE Manual Search API", version="1.0.0")

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://172.31.12.37:3000",
    "http://172.31.12.37:5173",
    "http://172.31.12.37:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
                m.image_path AS imagePath,
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


def save_machine_image(image: UploadFile) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_name = f"{timestamp}_{Path(image.filename or 'machine-image').name.replace(' ', '_')}"
    image_path = MACHINE_IMAGE_DIR / safe_name
    with image_path.open("wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    return str(image_path)


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
        "recentActivity": [],
    }


@app.get("/machines")
def list_machines() -> list[dict[str, Any]]:
    return machine_rows()


@app.post("/machines", status_code=201)
def create_machine(machine: MachineCreate) -> dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO machines (name, model, department, status, image_path) VALUES (?, ?, ?, ?, ?)",
            (machine.name, machine.model, machine.department, machine.status, machine.image_path),
        )
        conn.commit()
        machine_id = cursor.lastrowid
    return get_machine(machine_id)


@app.post("/machines/form", status_code=201)
async def create_machine_form(
    name: str = Form(...),
    model: str = Form(...),
    department: str = Form(...),
    status: str = Form("Running"),
    image: UploadFile | None = File(None),
) -> dict[str, Any]:
    image_path = save_machine_image(image) if image and image.filename else None
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO machines (name, model, department, status, image_path) VALUES (?, ?, ?, ?, ?)",
            (name, model, department, status, image_path),
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


@app.put("/machines/{machine_id}/form")
async def update_machine_form(
    machine_id: int,
    name: str = Form(...),
    model: str = Form(...),
    department: str = Form(...),
    status: str = Form("Running"),
    image: UploadFile | None = File(None),
) -> dict[str, Any]:
    machine = get_machine_or_404(machine_id)
    image_path = machine.get("image_path") or machine.get("imagePath")
    if image and image.filename:
        if image_path and Path(image_path).exists():
            Path(image_path).unlink()
        image_path = save_machine_image(image)

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE machines
            SET name = ?, model = ?, department = ?, status = ?, image_path = ?
            WHERE id = ?
            """,
            (name, model, department, status, image_path, machine_id),
        )
        conn.commit()
    return get_machine(machine_id)


@app.get("/machines/{machine_id}/image")
def get_machine_image(machine_id: int):
    machine = get_machine(machine_id)
    image_path = machine.get("imagePath")
    if not image_path or not Path(image_path).exists():
        raise HTTPException(status_code=404, detail="Machine image not found")

    media_type, _ = mimetypes.guess_type(image_path)
    return FileResponse(
        image_path,
        media_type=media_type or "application/octet-stream",
        headers={"Content-Disposition": "inline"},
    )


@app.delete("/machines/{machine_id}")
def delete_machine(machine_id: int) -> dict[str, str]:
    machine = get_machine_or_404(machine_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM machines WHERE id = ?", (machine_id,))
        conn.commit()
    image_path = machine.get("image_path") or machine.get("imagePath")
    if image_path and Path(image_path).exists():
        Path(image_path).unlink()
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


def find_manual_or_404(manual_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
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
            WHERE manuals.id = ?
            """,
            (manual_id,),
        ).fetchone()

    manual = row_to_dict(row)
    if not manual:
        raise HTTPException(status_code=404, detail="Manual not found")
    return manual


@app.get("/manuals/{manual_id}")
def get_manual(manual_id: int) -> dict[str, Any]:
    return find_manual_or_404(manual_id)


def index_manual_file(manual_id: int, file_path: Path) -> dict[str, Any]:
    """Extract searchable text from a PDF and save it into manual_pages."""
    pages = extract_pdf_pages(file_path)

    searchable_pages: list[dict[str, Any]] = []
    extracted_characters = 0

    for page in pages:
        text = str(page.get("text") or "").strip()
        extracted_characters += len(text)

        if text:
            searchable_pages.append(
                {
                    "page_number": int(page["page_number"]),
                    "text": text,
                }
            )

    status = "Indexed" if extracted_characters > 0 else "Failed"

    with get_connection() as conn:
        conn.execute("DELETE FROM manual_pages WHERE manual_id = ?", (manual_id,))

        for page in searchable_pages:
            conn.execute(
                "INSERT INTO manual_pages (manual_id, page_number, text) VALUES (?, ?, ?)",
                (manual_id, page["page_number"], page["text"]),
            )

        conn.execute(
            "UPDATE manuals SET status = ?, pages = ? WHERE id = ?",
            (status, len(pages), manual_id),
        )
        conn.commit()

    return {
        "manual": find_manual_or_404(manual_id),
        "indexedPages": len(searchable_pages),
        "extractedCharacters": extracted_characters,
        "status": status,
    }


@app.post("/manuals/{manual_id}/reindex")
def reindex_manual(manual_id: int) -> dict[str, Any]:
    manual = find_manual_or_404(manual_id)

    file_path = manual.get("filePath")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Original PDF file was not found on the backend server",
        )

    try:
        return index_manual_file(manual_id, Path(file_path))
    except Exception as exc:
        with get_connection() as conn:
            conn.execute("UPDATE manuals SET status = ? WHERE id = ?", ("Failed", manual_id))
            conn.commit()

        raise HTTPException(
            status_code=500,
            detail=f"PDF re-indexing failed: {exc}",
        ) from exc


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

    # Create manual record first.
    # We mark it Processing while OCR/text extraction runs.
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO manuals (
                title,
                machine_id,
                file_name,
                file_path,
                status,
                pages,
                description
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                title,
                machine_id,
                file.filename,
                str(file_path),
                "Processing",
                0,
                description,
            ),
        )

        conn.commit()
        manual_id = cursor.lastrowid

    try:
        # This uses the shared indexing function.
        # If pdf_service.py supports OCR, scanned PDFs will be readable.
        index_result = index_manual_file(manual_id, file_path)
        return index_result["manual"]

    except Exception as exc:
        with get_connection() as conn:
            conn.execute(
                "UPDATE manuals SET status = ? WHERE id = ?",
                (
                    "Failed",
                    manual_id,
                ),
            )
            conn.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Upload saved, but PDF indexing failed: {exc}",
        ) from exc


@app.get("/manuals/{manual_id}/file")
def get_manual_file(manual_id: int):
    manual = get_manual(manual_id)
    file_path = manual.get("filePath")
    if not file_path or not Path(file_path).exists():
        return PlainTextResponse(
            f"Manual: {manual['title']}\n\n"
            "This manual record is searchable, but the original PDF file is not available on the backend. "
            "Upload the source PDF from the Upload Manual page to open the document here.",
            media_type="text/plain",
        )
    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{manual["fileName"]}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/manuals/{manual_id}/highlights")
def get_manual_highlights(
    manual_id: int,
    page: int = Query(..., ge=1),
    q: str = Query(..., min_length=1),
) -> dict[str, Any]:
    manual = get_manual(manual_id)
    file_path = manual.get("filePath")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Original PDF file was not found on the backend server",
        )

    try:
        return extract_page_highlight_boxes(Path(file_path), page, q)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc




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
