from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = Path(os.getenv("MTCE_DB_PATH", DATA_DIR / "mtce_manual_search.db"))


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
        seed_database(conn)


def seed_database(conn: sqlite3.Connection) -> None:
    machine_count = conn.execute("SELECT COUNT(*) FROM machines").fetchone()[0]
    if machine_count > 0:
        return

    machines = [
        ("CNC Lathe Alpha", "HL-460X", "Machining Bay 1", "Running"),
        ("Hydraulic Press B2", "HP-2200", "Press Shop", "Maintenance"),
        ("Injection Molder", "IM-380T", "Molding Line", "Running"),
        ("Conveyor System C", "CV-12M", "Assembly", "Idle"),
        ("Robotic Arm RX-7", "RX-7000", "Assembly", "Running"),
        ("Laser Cutter", "LC-4kW", "Sheet Metal", "Offline"),
        ("Welding Cell W3", "WC-300", "Fabrication", "Running"),
        ("Packaging Line P1", "PL-9X", "Packaging", "Idle"),
    ]
    conn.executemany(
        "INSERT INTO machines (name, model, department, status) VALUES (?, ?, ?, ?)",
        machines,
    )

    manuals = [
        ("CNC Lathe Operation Manual", 1, "HL460X_operation_v3.pdf", "Indexed", 248, "Operation procedures and HMI codes."),
        ("CNC Lathe Maintenance Guide", 1, "HL460X_maintenance.pdf", "Indexed", 132, "Preventive maintenance and lubrication guide."),
        ("Hydraulic Press Safety & Setup", 2, "HP2200_safety.pdf", "Indexed", 96, "Safety, setup, and light curtain checks."),
        ("Injection Molder Service Manual", 3, "IM380T_service.pdf", "Processing", 412, "Service procedures and alarm references."),
        ("Robotic Arm Programming Reference", 5, "RX7000_programming.pdf", "Indexed", 320, "Robot movement commands and calibration."),
        ("Laser Cutter Alarm Codes", 6, "LC4kW_alarms.pdf", "Indexed", 58, "Alarm codes, chiller flow, and reset procedures."),
        ("Welding Cell Quick Reference", 7, "WC300_quickref.pdf", "Indexed", 44, "Quick setup and troubleshooting reference."),
    ]
    conn.executemany(
        """
        INSERT INTO manuals (title, machine_id, file_name, status, pages, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        manuals,
    )

    page_rows = [
        (6, 23, "Alarm E-204 indicates a chiller flow rate below 4 L/min. Verify coolant level and inspect the inline filter for blockage before resetting the alarm."),
        (2, 87, "Spindle lubrication procedure: apply 5ml of ISO VG 32 oil to the front bearing every 500 operating hours. Refer to figure 4-12 for port location."),
        (1, 142, "Error code E-204 on the HMI signals a servo overload on the X-axis. Clear chips from the way cover and verify ball screw alignment."),
        (5, 56, "Use MOVL command for linear interpolation. Set speed parameter between 10-1500 mm/s based on payload calibration."),
        (3, 12, "Light curtain must be tested before each shift. Replace transmitter unit P/N 88421-A if any segment fails self-test."),
        (1, 35, "Before startup, confirm hydraulic pressure, spindle guard lock, coolant level, and emergency stop circuit reset status."),
        (7, 18, "For weld quality concerns, inspect torch alignment, wire feed tension, and shielding gas flow before changing program parameters."),
    ]
    conn.executemany(
        "INSERT INTO manual_pages (manual_id, page_number, text) VALUES (?, ?, ?)",
        page_rows,
    )

    cases = [
        ("Coolant leak under spindle housing", 1, "High", "In Progress", "M. Hassan", "Slow drip from rear of spindle assembly; suspect seal degradation."),
        ("Press cycle aborts mid-stroke", 2, "Critical", "Open", "J. Tanaka", "E-stop triggers intermittently during downstroke. Light curtain self-test passes."),
        ("Alarm E-204 reoccurring", 6, "High", "Open", "L. Park", "Chiller alarm clears but returns after 30 minutes of cutting."),
        ("Robotic arm jitter on joint 4", 5, "Medium", "Resolved", "R. Costa", "Replaced encoder cable, calibration completed."),
        ("Packaging belt tracking off-center", 8, "Low", "Open", "A. Singh", "Belt drifts about 5mm to operator side over a shift."),
    ]
    conn.executemany(
        """
        INSERT INTO cases (title, machine_id, priority, status, created_by, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        cases,
    )

    history = [
        ("E-204", "All manuals", 4),
        ("spindle lubrication", "CNC Lathe Alpha", 2),
        ("light curtain", "Hydraulic Press B2", 3),
        ("MOVL command", "Robotic Arm RX-7", 6),
        ("chiller flow", "All manuals", 5),
    ]
    conn.executemany(
        "INSERT INTO search_history (keyword, scope, results_count) VALUES (?, ?, ?)",
        history,
    )
