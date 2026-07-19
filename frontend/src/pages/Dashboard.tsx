import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Application, ServerInfo } from "../types";
import { useI18n } from "../i18n";

function formatBytes(value?: number) {
  if (!value) return "-";
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function Dashboard() {
  const { t } = useI18n();
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
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
        <Link className="button primary" to="/applications/new">
          {t("dashboard.create")}
        </Link>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="stats-grid">
        <article className="card stat">
          <span>{t("dashboard.dockerHost")}</span>
          <strong>{server?.online ? t("dashboard.online") : t("dashboard.offline")}</strong>
          <small>{server?.name || server?.error || t("dashboard.loading")}</small>
        </article>
        <article className="card stat">
          <span>{t("dashboard.containers")}</span>
          <strong>{server?.containers_running ?? "-"}</strong>
          <small>{t("dashboard.totalContainers", { count: server?.containers ?? "-" })}</small>
        </article>
        <article className="card stat">
          <span>{t("dashboard.applications")}</span>
          <strong>{applications.length}</strong>
          <small>{t("dashboard.managed")}</small>
        </article>
        <article className="card stat">
          <span>{t("dashboard.resources")}</span>
          <strong>{server?.cpus ?? "-"} CPU</strong>
          <small>{formatBytes(server?.memory_bytes)} RAM</small>
        </article>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>{t("dashboard.applications")}</h2>
            <p>{t("dashboard.sectionDescription")}</p>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="card empty">
            <h3>{t("dashboard.emptyTitle")}</h3>
            <p>{t("dashboard.emptyDescription")}</p>
            <Link className="button primary" to="/applications/new">
              {t("dashboard.createNow")}
            </Link>
          </div>
        ) : (
          <div className="app-grid">
            {applications.map((app) => (
              <Link className="card app-card" to={`/applications/${app.id}`} key={app.id}>
                <div className="app-icon">{app.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>{app.name}</h3>
                  <p>{app.description || t("dashboard.noDescription")}</p>
                  <small>
                    {t("dashboard.serviceCount", { count: app.services.length, environment: app.environment })}
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
