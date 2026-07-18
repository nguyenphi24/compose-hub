import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Application, ServerInfo } from "../types";

function formatBytes(value?: number) {
  if (!value) return "-";
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function Dashboard() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.server(), api.applications()])
      .then(([serverData, apps]) => {
        setServer(serverData);
        setApplications(apps);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">SINGLE HOST MVP</p>
          <h1>Dashboard</h1>
          <p>Quản lý application Docker Compose mà không cần SSH.</p>
        </div>
        <Link className="button primary" to="/applications/new">
          + Tạo Application
        </Link>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="stats-grid">
        <article className="card stat">
          <span>Docker host</span>
          <strong>{server?.online ? "Online" : "Offline"}</strong>
          <small>{server?.name || server?.error || "Đang tải..."}</small>
        </article>
        <article className="card stat">
          <span>Containers</span>
          <strong>{server?.containers_running ?? "-"}</strong>
          <small>{server?.containers ?? "-"} tổng container</small>
        </article>
        <article className="card stat">
          <span>Applications</span>
          <strong>{applications.length}</strong>
          <small>được quản lý bởi ComposeHub</small>
        </article>
        <article className="card stat">
          <span>Tài nguyên</span>
          <strong>{server?.cpus ?? "-"} CPU</strong>
          <small>{formatBytes(server?.memory_bytes)} RAM</small>
        </article>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>Applications</h2>
            <p>Mỗi application bao gồm nhiều service liên quan.</p>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="card empty">
            <h3>Chưa có application</h3>
            <p>Tạo application đầu tiên để bắt đầu demo.</p>
            <Link className="button primary" to="/applications/new">
              Tạo ngay
            </Link>
          </div>
        ) : (
          <div className="app-grid">
            {applications.map((app) => (
              <Link className="card app-card" to={`/applications/${app.id}`} key={app.id}>
                <div className="app-icon">{app.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>{app.name}</h3>
                  <p>{app.description || "Không có mô tả"}</p>
                  <small>
                    {app.services.length} service · {app.environment}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
