import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import DoctorReport from "../components/DoctorReport";
import ReleaseTimeline from "../components/ReleaseTimeline";
import RollbackDialog from "../components/RollbackDialog";
import type {
  Application,
  ContainerStatus,
  DoctorReport as DoctorReportData,
  ReleaseRevision,
} from "../types";

export default function ApplicationDetail() {
  const { id } = useParams();
  const appId = Number(id);
  const [application, setApplication] = useState<Application | null>(null);
  const [compose, setCompose] = useState("");
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [logs, setLogs] = useState("");
  const [doctor, setDoctor] = useState<DoctorReportData | null>(null);
  const [revisions, setRevisions] = useState<ReleaseRevision[]>([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<ReleaseRevision | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [appData, composeData, statusData, logData, doctorData, revisionData] = await Promise.all([
        api.application(appId),
        api.compose(appId),
        api.status(appId),
        api.logs(appId),
        api.doctor(appId),
        api.revisions(appId),
      ]);
      setApplication(appData);
      setCompose(composeData.compose);
      setContainers(statusData.containers);
      setLogs(logData.logs);
      setDoctor(doctorData);
      setRevisions(revisionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
    }
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runDoctor = async () => {
    setDoctorLoading(true);
    setError("");
    try {
      setDoctor(await api.doctor(appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chạy Compose Doctor");
    } finally {
      setDoctorLoading(false);
    }
  };

  const action = async (type: "deploy" | "stop") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (type === "deploy") {
        const freshDoctor = await api.doctor(appId);
        setDoctor(freshDoctor);
        if (!freshDoctor.can_deploy) {
          setError("Deploy bị chặn. Hãy xử lý các lỗi Critical trong Compose Doctor.");
          return;
        }
      }
      const result = type === "deploy" ? await api.deploy(appId) : await api.stop(appId);
      setMessage(result.output || result.status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };

  const confirmRollback = async () => {
    if (!rollbackTarget) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.rollback(appId, rollbackTarget.id);
      setMessage(`Đã rollback về revision #${rollbackTarget.id}. Release rollback #${result.id} đã được lưu.`);
      setRollbackTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback thất bại");
    } finally {
      setBusy(false);
    }
  };

  if (!application) {
    return <div className="card">Đang tải...</div>;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <Link className="back-link" to="/">← Dashboard</Link>
          <p className="eyebrow">{application.environment}</p>
          <h1>{application.name}</h1>
          <p>{application.description || "Application Docker Compose"}</p>
        </div>
        <div className="actions">
          <button className="button secondary" disabled={busy} onClick={() => action("stop")}>Stop</button>
          <button className="button primary" disabled={busy || doctorLoading || Boolean(doctor && !doctor.can_deploy)} onClick={() => action("deploy")}>
            {busy ? "Đang xử lý..." : "Deploy"}
          </button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="stats-grid">
        <article className="card stat">
          <span>Services</span>
          <strong>{application.services.length}</strong>
          <small>được khai báo</small>
        </article>
        <article className="card stat">
          <span>Containers</span>
          <strong>{containers.length}</strong>
          <small>được phát hiện</small>
        </article>
        <article className="card stat">
          <span>Trạng thái</span>
          <strong>{containers.some((c) => c.status === "running") ? "Running" : "Stopped"}</strong>
          <small>theo Docker Engine</small>
        </article>
      </section>

      <section className="section">
        <DoctorReport report={doctor} loading={doctorLoading} onRun={runDoctor} />
      </section>

      <section className="two-columns section">
        <article className="card panel">
          <div className="section-title">
            <div>
              <h2>Containers</h2>
              <p>Trạng thái hiện tại.</p>
            </div>
            <button className="button secondary" onClick={refresh}>Refresh</button>
          </div>
          {containers.length === 0 ? (
            <p>Chưa deploy application.</p>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Image</th><th>Status</th></tr></thead>
              <tbody>
                {containers.map((container) => (
                  <tr key={container.id}>
                    <td>{container.name}</td>
                    <td>{container.image}</td>
                    <td><span className={`status ${container.status}`}>{container.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card panel">
          <h2>Services</h2>
          <div className="service-summary">
            {application.services.map((service) => (
              <div key={service.id}>
                <strong>{service.name}</strong>
                <span>{service.image}</span>
                <small>
                  {service.host_port && service.container_port
                    ? `${service.host_port}:${service.container_port}`
                    : "Không public port"}
                </small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="two-columns section">
        <article className="card panel code-panel">
          <h2>compose.yaml</h2>
          <pre>{compose}</pre>
        </article>
        <article className="card panel code-panel">
          <h2>Logs</h2>
          <pre>{logs}</pre>
        </article>
      </section>

      <section className="section">
        <ReleaseTimeline revisions={revisions} busy={busy} onRollback={setRollbackTarget} />
      </section>

      <RollbackDialog
        revision={rollbackTarget}
        busy={busy}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={confirmRollback}
      />
    </>
  );
}
