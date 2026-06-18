export type MachineStatus = "Running" | "Idle" | "Maintenance" | "Offline";
export type CasePriority = "Low" | "Medium" | "High" | "Critical";
export type CaseStatus = "Open" | "In Progress" | "Resolved";
export type ManualIndexStatus = "Indexed" | "Processing" | "Failed";

export interface Machine {
  id: string;
  name: string;
  model: string;
  department: string;
  status: MachineStatus;
  manualsCount: number;
  openCases: number;
}

export interface Manual {
  id: string;
  title: string;
  machineId: string;
  machineName: string;
  model: string;
  fileName: string;
  uploadDate: string;
  fileType: "PDF";
  status: ManualIndexStatus;
  pages: number;
}

export interface SearchResult {
  id: string;
  manualId: string;
  manualTitle: string;
  machineName: string;
  model: string;
  page: number;
  snippet: string;
  keyword: string;
  confidence: number;
}

export interface Case {
  id: string;
  title: string;
  machineId: string;
  machineName: string;
  priority: CasePriority;
  status: CaseStatus;
  createdBy: string;
  createdAt: string;
  description: string;
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  scope: string;
  date: string;
  resultsCount: number;
}

export const machines: Machine[] = [
  { id: "m1", name: "CNC Lathe Alpha", model: "HL-460X", department: "Machining Bay 1", status: "Running", manualsCount: 3, openCases: 1 },
  { id: "m2", name: "Hydraulic Press B2", model: "HP-2200", department: "Press Shop", status: "Maintenance", manualsCount: 2, openCases: 3 },
  { id: "m3", name: "Injection Molder", model: "IM-380T", department: "Molding Line", status: "Running", manualsCount: 4, openCases: 0 },
  { id: "m4", name: "Conveyor System C", model: "CV-12M", department: "Assembly", status: "Idle", manualsCount: 1, openCases: 0 },
  { id: "m5", name: "Robotic Arm RX-7", model: "RX-7000", department: "Assembly", status: "Running", manualsCount: 5, openCases: 2 },
  { id: "m6", name: "Laser Cutter", model: "LC-4kW", department: "Sheet Metal", status: "Offline", manualsCount: 2, openCases: 4 },
  { id: "m7", name: "Welding Cell W3", model: "WC-300", department: "Fabrication", status: "Running", manualsCount: 2, openCases: 0 },
  { id: "m8", name: "Packaging Line P1", model: "PL-9X", department: "Packaging", status: "Idle", manualsCount: 1, openCases: 1 },
];

export const manuals: Manual[] = [
  { id: "ma1", title: "CNC Lathe Operation Manual", machineId: "m1", machineName: "CNC Lathe Alpha", model: "HL-460X", fileName: "HL460X_operation_v3.pdf", uploadDate: "2025-03-12", fileType: "PDF", status: "Indexed", pages: 248 },
  { id: "ma2", title: "CNC Lathe Maintenance Guide", machineId: "m1", machineName: "CNC Lathe Alpha", model: "HL-460X", fileName: "HL460X_maintenance.pdf", uploadDate: "2025-03-12", fileType: "PDF", status: "Indexed", pages: 132 },
  { id: "ma3", title: "Hydraulic Press Safety & Setup", machineId: "m2", machineName: "Hydraulic Press B2", model: "HP-2200", fileName: "HP2200_safety.pdf", uploadDate: "2025-04-02", fileType: "PDF", status: "Indexed", pages: 96 },
  { id: "ma4", title: "Injection Molder Service Manual", machineId: "m3", machineName: "Injection Molder", model: "IM-380T", fileName: "IM380T_service.pdf", uploadDate: "2025-05-21", fileType: "PDF", status: "Processing", pages: 412 },
  { id: "ma5", title: "Robotic Arm Programming Reference", machineId: "m5", machineName: "Robotic Arm RX-7", model: "RX-7000", fileName: "RX7000_programming.pdf", uploadDate: "2025-06-01", fileType: "PDF", status: "Indexed", pages: 320 },
  { id: "ma6", title: "Laser Cutter Alarm Codes", machineId: "m6", machineName: "Laser Cutter", model: "LC-4kW", fileName: "LC4kW_alarms.pdf", uploadDate: "2024-11-18", fileType: "PDF", status: "Failed", pages: 58 },
  { id: "ma7", title: "Welding Cell Quick Reference", machineId: "m7", machineName: "Welding Cell W3", model: "WC-300", fileName: "WC300_quickref.pdf", uploadDate: "2025-01-09", fileType: "PDF", status: "Indexed", pages: 44 },
];

export const searchResults: SearchResult[] = [
  { id: "sr1", manualId: "ma6", manualTitle: "Laser Cutter Alarm Codes", machineName: "Laser Cutter", model: "LC-4kW", page: 23, snippet: "Alarm E-204 indicates a chiller flow rate below 4 L/min. Verify coolant level and inspect the inline filter for blockage before resetting the alarm.", keyword: "E-204", confidence: 0.96 },
  { id: "sr2", manualId: "ma2", manualTitle: "CNC Lathe Maintenance Guide", machineName: "CNC Lathe Alpha", model: "HL-460X", page: 87, snippet: "Spindle lubrication procedure: apply 5ml of ISO VG 32 oil to the front bearing every 500 operating hours. Refer to figure 4-12 for port location.", keyword: "spindle lubrication", confidence: 0.92 },
  { id: "sr3", manualId: "ma1", manualTitle: "CNC Lathe Operation Manual", machineName: "CNC Lathe Alpha", model: "HL-460X", page: 142, snippet: "Error code E-204 on the HMI signals a servo overload on the X-axis. Clear chips from the way cover and verify ball screw alignment.", keyword: "E-204", confidence: 0.88 },
  { id: "sr4", manualId: "ma5", manualTitle: "Robotic Arm Programming Reference", machineName: "Robotic Arm RX-7", model: "RX-7000", page: 56, snippet: "Use MOVL command for linear interpolation. Set speed parameter between 10-1500 mm/s based on payload calibration.", keyword: "MOVL", confidence: 0.81 },
  { id: "sr5", manualId: "ma3", manualTitle: "Hydraulic Press Safety & Setup", machineName: "Hydraulic Press B2", model: "HP-2200", page: 12, snippet: "Light curtain must be tested before each shift. Replace transmitter unit P/N 88421-A if any segment fails self-test.", keyword: "light curtain", confidence: 0.78 },
];

export const cases: Case[] = [
  { id: "c1", title: "Coolant leak under spindle housing", machineId: "m1", machineName: "CNC Lathe Alpha", priority: "High", status: "In Progress", createdBy: "M. Hassan", createdAt: "2025-06-14", description: "Slow drip from rear of spindle assembly; suspect seal degradation." },
  { id: "c2", title: "Press cycle aborts mid-stroke", machineId: "m2", machineName: "Hydraulic Press B2", priority: "Critical", status: "Open", createdBy: "J. Tanaka", createdAt: "2025-06-15", description: "E-stop triggers intermittently during downstroke. Light curtain self-test passes." },
  { id: "c3", title: "Alarm E-204 reoccurring", machineId: "m6", machineName: "Laser Cutter", priority: "High", status: "Open", createdBy: "L. Park", createdAt: "2025-06-16", description: "Chiller alarm clears but returns after 30 minutes of cutting." },
  { id: "c4", title: "Robotic arm jitter on joint 4", machineId: "m5", machineName: "Robotic Arm RX-7", priority: "Medium", status: "Resolved", createdBy: "R. Costa", createdAt: "2025-06-10", description: "Replaced encoder cable, calibration completed." },
  { id: "c5", title: "Packaging belt tracking off-center", machineId: "m8", machineName: "Packaging Line P1", priority: "Low", status: "Open", createdBy: "A. Singh", createdAt: "2025-06-13", description: "Belt drifts ~5mm to operator side over a shift." },
];

export const searchHistory: SearchHistoryItem[] = [
  { id: "h1", keyword: "E-204", scope: "All manuals", date: "2025-06-17 09:14", resultsCount: 4 },
  { id: "h2", keyword: "spindle lubrication", scope: "CNC Lathe Alpha", date: "2025-06-16 16:42", resultsCount: 2 },
  { id: "h3", keyword: "light curtain", scope: "Hydraulic Press B2", date: "2025-06-16 11:08", resultsCount: 3 },
  { id: "h4", keyword: "MOVL command", scope: "Robotic Arm RX-7", date: "2025-06-15 14:30", resultsCount: 6 },
  { id: "h5", keyword: "chiller flow", scope: "All manuals", date: "2025-06-14 08:55", resultsCount: 5 },
];

export const recentActivity = [
  { id: "a1", text: "M. Hassan opened case 'Coolant leak under spindle housing'", time: "2h ago" },
  { id: "a2", text: "Manual 'Injection Molder Service Manual' is being indexed", time: "5h ago" },
  { id: "a3", text: "R. Costa resolved case 'Robotic arm jitter on joint 4'", time: "Yesterday" },
  { id: "a4", text: "New manual uploaded for Welding Cell W3", time: "2d ago" },
  { id: "a5", text: "L. Park searched 'E-204' across all manuals", time: "2d ago" },
];
