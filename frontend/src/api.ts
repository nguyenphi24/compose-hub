import type { Application, ServerInfo, ContainerStatus } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Có lỗi xảy ra");
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
  deploy: (id: number) =>
    request<{ status: string; output: string }>(`/api/applications/${id}/deploy`, {
      method: "POST",
    }),
  stop: (id: number) =>
    request<{ status: string; output: string }>(`/api/applications/${id}/stop`, {
      method: "POST",
    }),
  status: (id: number) =>
    request<{ containers: ContainerStatus[] }>(`/api/applications/${id}/status`),
  logs: (id: number) =>
    request<{ logs: string }>(`/api/applications/${id}/logs`),
};
