import type {
  Application,
  ServerInfo,
  ContainerStatus,
  DoctorReport,
  ChangePlan,
  ReleaseRevision,
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(
      typeof detail === "string" ? detail : detail?.message || "Có lỗi xảy ra"
    );
  }
  return data;
}

export const api = {
  server: () => request<ServerInfo>("/api/server"),
  applications: () => request<Application[]>("/api/applications"),
  application: (id: number) => request<Application>(`/api/applications/${id}`),
  createApplication: (payload: unknown) =>
    request<Application>("/api/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  compose: (id: number) =>
    request<{ compose: string }>(`/api/applications/${id}/compose`),
  deploy: (id: number, expectedPlanId?: string) =>
    request<{ status: string; output: string; revision?: ReleaseRevision }>(`/api/applications/${id}/deploy`, {
      method: "POST",
      body: JSON.stringify({ expected_plan_id: expectedPlanId }),
    }),
  stop: (id: number) =>
    request<{ status: string; output: string }>(`/api/applications/${id}/stop`, {
      method: "POST",
    }),
  status: (id: number) =>
    request<{ containers: ContainerStatus[] }>(`/api/applications/${id}/status`),
  logs: (id: number) =>
    request<{ logs: string }>(`/api/applications/${id}/logs`),
  templates: () =>
    request<any[]>("/api/templates"),
  previewTemplate: (payload: { template_id: string; app_name: string; variables: Record<string, any> }) =>
    request<{ compose: string }>("/api/templates/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createFromTemplate: (payload: {
    template_id: string;
    name: string;
    environment: string;
    description: string;
    variables: Record<string, any>;
  }) =>
    request<Application>("/api/applications/from-template", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cloneApplication: (id: number, payload: { name: string; host_ports: Record<string, number> }) =>
    request<Application>(`/api/applications/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateApplication: (id: number, payload: unknown) =>
    request<Application>(`/api/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteApplication: (id: number) =>
    fetch(`/api/applications/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok && r.status !== 204) throw new Error("Xóa application thất bại");
    }),
  doctor: (id: number) =>
    request<DoctorReport>(`/api/applications/${id}/doctor`, { method: "POST" }),
  changePlan: (id: number) =>
    request<ChangePlan>(`/api/applications/${id}/change-plan`),
  revisions: (id: number) =>
    request<ReleaseRevision[]>(`/api/applications/${id}/revisions`),
  rollback: (id: number, revisionId: number) =>
    request<ReleaseRevision>(`/api/applications/${id}/rollback/${revisionId}`, {
      method: "POST",
    }),
};
