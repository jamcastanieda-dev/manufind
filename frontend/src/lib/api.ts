const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) {
    return `http://${browserHost}:8000`;
  }

  try {
    const url = new URL(configured);
    if (!url.port) {
      url.port = "8000";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return `http://${browserHost}:8000`;
  }
}

export const API_URL = resolveApiUrl();

export type MachineStatus = "Running" | "Idle" | "Maintenance" | "Offline";
export type CasePriority = "Low" | "Medium" | "High" | "Critical";
export type CaseStatus = "Open" | "In Progress" | "Resolved";
export type ManualIndexStatus = "Indexed" | "Processing" | "Failed";

export interface Machine {
  id: number;
  name: string;
  model: string;
  department: string;
  status: MachineStatus;
  imagePath?: string | null;
  manualsCount: number;
  openCases: number;
}

export interface Manual {
  id: number;
  title: string;
  machineId: number;
  machineName: string;
  model: string;
  fileName: string;
  uploadDate: string;
  fileType: "PDF";
  status: ManualIndexStatus;
  pages: number;
  description?: string;
  filePath?: string | null;
}

export interface SearchResult {
  id: number;
  manualId: number;
  manualTitle: string;
  machineName: string;
  model: string;
  page: number;
  snippet: string;
  keyword: string;
  confidence: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  resultsCount: number;
}

export interface MaintenanceCase {
  id: number;
  title: string;
  machineId: number;
  machineName: string;
  priority: CasePriority;
  status: CaseStatus;
  createdBy: string;
  createdAt: string;
  description: string;
}

export interface SearchHistoryItem {
  id: number;
  keyword: string;
  scope: string;
  date: string;
  resultsCount: number;
}

export interface ManualHighlightBox {
  text: string;
  leftRatio: number;
  topRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export interface ManualHighlightResponse {
  page: number;
  boxes: ManualHighlightBox[];
}

export interface DashboardData {
  stats: {
    machines: number;
    manuals: number;
    indexedPdfs: number;
    openCases: number;
    searches: number;
  };
  machines: Machine[];
  manuals: Manual[];
  cases: MaintenanceCase[];
  searchHistory: SearchHistoryItem[];
  recentActivity: Array<{ id: string; text: string; time: string }>;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<{ status: string; service: string; database: string }>("/health"),
  dashboard: () => apiFetch<DashboardData>("/dashboard"),

  machines: () => apiFetch<Machine[]>("/machines"),
  machineImageUrl: (id: number) => `${API_URL}/machines/${id}/image`,
  createMachine: (payload: Omit<Machine, "id" | "manualsCount" | "openCases">) =>
    apiFetch<Machine>("/machines", { method: "POST", body: JSON.stringify(payload) }),
  createMachineForm: (formData: FormData) =>
    apiFetch<Machine>("/machines/form", { method: "POST", body: formData }),
  updateMachine: (id: number, payload: Partial<Omit<Machine, "id" | "manualsCount" | "openCases">>) =>
    apiFetch<Machine>(`/machines/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateMachineForm: (id: number, formData: FormData) =>
    apiFetch<Machine>(`/machines/${id}/form`, { method: "PUT", body: formData }),
  deleteMachine: (id: number) => apiFetch<{ message: string }>(`/machines/${id}`, { method: "DELETE" }),

  manuals: () => apiFetch<Manual[]>("/manuals"),
  manual: (id: number) => apiFetch<Manual>(`/manuals/${id}`),
  deleteManual: (id: number) => apiFetch<{ message: string }>(`/manuals/${id}`, { method: "DELETE" }),
  manualFileUrl: (id: number) => `${API_URL}/manuals/${id}/file`,
  manualViewerUrl: (id: number, page?: number, q?: string) => {
    const search = new URLSearchParams();
    if (page && page > 0) search.set("page", String(page));
    if (q?.trim()) search.set("q", q.trim());
    const suffix = search.toString();
    return suffix ? `/manuals/${id}?${suffix}` : `/manuals/${id}`;
  },
  manualHighlights: (id: number, page: number, q: string) =>
    apiFetch<ManualHighlightResponse>(`/manuals/${id}/highlights?page=${page}&q=${encodeURIComponent(q)}`),
  uploadManual: (formData: FormData) =>
    apiFetch<Manual>("/manuals/upload", { method: "POST", body: formData }),

  searchManuals: (params: { q: string; machineId?: string; manualId?: string }) => {
    const search = new URLSearchParams({ q: params.q });
    if (params.machineId && params.machineId !== "all") search.set("machine_id", params.machineId);
    if (params.manualId && params.manualId !== "all") search.set("manual_id", params.manualId);
    return apiFetch<SearchResponse>(`/manuals/search?${search.toString()}`);
  },

  cases: () => apiFetch<MaintenanceCase[]>("/cases"),
  createCase: (payload: {
    title: string;
    machine_id: number;
    priority: CasePriority;
    status: CaseStatus;
    created_by: string;
    description: string;
  }) => apiFetch<MaintenanceCase>("/cases", { method: "POST", body: JSON.stringify(payload) }),
  updateCase: (id: number, payload: Partial<{ status: CaseStatus; priority: CasePriority; title: string; description: string }>) =>
    apiFetch<MaintenanceCase>(`/cases/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCase: (id: number) => apiFetch<{ message: string }>(`/cases/${id}`, { method: "DELETE" }),

  searchHistory: () => apiFetch<SearchHistoryItem[]>("/search-history"),
  clearSearchHistory: () => apiFetch<{ message: string }>("/search-history", { method: "DELETE" }),
};
