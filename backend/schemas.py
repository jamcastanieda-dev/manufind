from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MachineStatus = Literal["Running", "Idle", "Maintenance", "Offline"]
ManualStatus = Literal["Indexed", "Processing", "Failed"]
CasePriority = Literal["Low", "Medium", "High", "Critical"]
CaseStatus = Literal["Open", "In Progress", "Resolved"]


class MachineCreate(BaseModel):
    name: str = Field(min_length=2)
    model: str = Field(min_length=1)
    department: str = Field(min_length=1)
    status: MachineStatus = "Running"
    image_path: str | None = None


class MachineUpdate(BaseModel):
    name: str | None = None
    model: str | None = None
    department: str | None = None
    status: MachineStatus | None = None
    image_path: str | None = None


class CaseCreate(BaseModel):
    title: str = Field(min_length=2)
    machine_id: int
    priority: CasePriority = "Medium"
    status: CaseStatus = "Open"
    created_by: str = "Technician"
    description: str = ""


class CaseUpdate(BaseModel):
    title: str | None = None
    machine_id: int | None = None
    priority: CasePriority | None = None
    status: CaseStatus | None = None
    created_by: str | None = None
    description: str | None = None


class ManualCreate(BaseModel):
    title: str = Field(min_length=2)
    machine_id: int
    file_name: str = "manual.pdf"
    status: ManualStatus = "Indexed"
    pages: int = 0
    description: str = ""
