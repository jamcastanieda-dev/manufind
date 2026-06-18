from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
MACHINE_IMAGE_DIR = UPLOAD_DIR / "machines"
DB_PATH = Path(os.getenv("MTCE_DB_PATH", DATA_DIR / "mtce_manual_search.db"))


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    MACHINE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return None if row is None else dict(row)


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    ensure_dirs()
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS machines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                model TEXT NOT NULL,
                department TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Running',
                image_path TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS manuals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                machine_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT,
                file_type TEXT NOT NULL DEFAULT 'PDF',
                upload_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status TEXT NOT NULL DEFAULT 'Indexed',
                pages INTEGER NOT NULL DEFAULT 0,
                description TEXT DEFAULT '',
                FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS manual_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manual_id INTEGER NOT NULL,
                page_number INTEGER NOT NULL,
                text TEXT NOT NULL,
                FOREIGN KEY(manual_id) REFERENCES manuals(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                machine_id INTEGER NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                status TEXT NOT NULL DEFAULT 'Open',
                created_by TEXT NOT NULL DEFAULT 'Technician',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                description TEXT NOT NULL DEFAULT '',
                FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL,
                scope TEXT NOT NULL,
                date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                results_count INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        ensure_column(conn, "machines", "image_path", "TEXT")
        remove_seed_data(conn)


def remove_seed_data(conn: sqlite3.Connection) -> None:
    seed_machine_names = (
        "CNC Lathe Alpha",
        "Hydraulic Press B2",
        "Injection Molder",
        "Conveyor System C",
        "Robotic Arm RX-7",
        "Laser Cutter",
        "Welding Cell W3",
        "Packaging Line P1",
    )
    seed_manual_titles = (
        "CNC Lathe Operation Manual",
        "CNC Lathe Maintenance Guide",
        "Hydraulic Press Safety & Setup",
        "Injection Molder Service Manual",
        "Robotic Arm Programming Reference",
        "Laser Cutter Alarm Codes",
        "Welding Cell Quick Reference",
    )
    seed_case_titles = (
        "Coolant leak under spindle housing",
        "Press cycle aborts mid-stroke",
        "Alarm E-204 reoccurring",
        "Robotic arm jitter on joint 4",
        "Packaging belt tracking off-center",
    )
    seed_history = (
        ("E-204", "All manuals"),
        ("spindle lubrication", "CNC Lathe Alpha"),
        ("light curtain", "Hydraulic Press B2"),
        ("MOVL command", "Robotic Arm RX-7"),
        ("chiller flow", "All manuals"),
    )

    conn.executemany("DELETE FROM manuals WHERE title = ?", [(title,) for title in seed_manual_titles])
    conn.executemany("DELETE FROM cases WHERE title = ?", [(title,) for title in seed_case_titles])
    conn.executemany("DELETE FROM machines WHERE name = ?", [(name,) for name in seed_machine_names])
    conn.executemany(
        "DELETE FROM search_history WHERE keyword = ? AND scope = ?",
        seed_history,
    )
