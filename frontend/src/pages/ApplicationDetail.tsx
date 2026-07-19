import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import DoctorReport from "../components/DoctorReport";
import ChangePlanPanel from "../components/ChangePlanPanel";
import DeployPlanDialog from "../components/DeployPlanDialog";
import ReleaseTimeline from "../components/ReleaseTimeline";
import RollbackDialog from "../components/RollbackDialog";
import type {
  Application,
  ChangePlan,
  ContainerStatus,
  DoctorReport as DoctorReportData,
  ReleaseRevision,
} from "../types";
import { useI18n } from "../i18n";

export default function ApplicationDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const appId = Number(id);
  const [application, setApplication] = useState<Application | null>(null);
  const [compose, setCompose] = useState("");
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [logs, setLogs] = useState("");
  const [doctor, setDoctor] = useState<DoctorReportData | null>(null);
  const [changePlan, setChangePlan] = useState<ChangePlan | null>(null);
  const [revisions, setRevisions] = useState<ReleaseRevision[]>([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [showDeployPlan, setShowDeployPlan] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<ReleaseRevision | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [clonePorts, setClonePorts] = useState<Record<string, string>>({});
  const [cloneError, setCloneError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [appData, composeData, statusData, logData, doctorData, planData, revisionData] = await Promise.all([
        api.application(appId),
        api.compose(appId),
        api.status(appId),
        api.logs(appId),
        api.doctor(appId),
        api.changePlan(appId),
        api.revisions(appId),
      ]);
      setApplication(appData);
      setCompose(composeData.compose);
      setContainers(statusData.containers);
      setLogs(logData.logs);
      setDoctor(doctorData);
      setChangePlan(planData);
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

  const refreshChangePlan = async () => {
    setPlanLoading(true);
    setError("");
    try {
      setChangePlan(await api.changePlan(appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo Change Plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const stopApplication = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.stop(appId);
      setMessage(result.output || result.status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };

  const prepareDeploy = async () => {
    setPlanLoading(true);
    setError("");
    setMessage("");
    try {
      const [freshDoctor, freshPlan] = await Promise.all([
        api.doctor(appId),
        api.changePlan(appId),
      ]);
      setDoctor(freshDoctor);
      setChangePlan(freshPlan);
      if (!freshDoctor.can_deploy) {
        setError("Deploy bị chặn. Hãy xử lý các lỗi Critical trong Compose Doctor.");
        return;
      }
      setShowDeployPlan(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chuẩn bị Deploy");
    } finally {
      setPlanLoading(false);
    }
  };

  const confirmDeploy = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.deploy(appId, changePlan?.plan_id);
      setMessage(result.output || result.status);
      setShowDeployPlan(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy thất bại");
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

  const openCloneModal = () => {
    if (!application) return;
    setCloneName(`${application.name}-copy`);
    setClonePorts(
      Object.fromEntries(
        application.services
          .filter((service) => service.host_port)
          .map((service) => [service.name, ""])
      )
    );
    setCloneError("");
    setShowCloneModal(true);
  };

  const cloneApp = async () => {
    if (!application) return;
    const cleanName = cloneName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleanName) {
      setCloneError("Tên clone không hợp lệ.");
      return;
    }
    const publicServices = application.services.filter((service) => service.host_port);
    const hostPorts = Object.fromEntries(
      publicServices.map((service) => [service.name, Number(clonePorts[service.name])])
    );
    if (Object.values(hostPorts).some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) {
      setCloneError("Hãy nhập host port mới hợp lệ (1-65535) cho mọi service public.");
      return;
    }
    setBusy(true);
    setCloneError("");
    setMessage("");
    try {
      const cloned = await api.cloneApplication(appId, { name: cleanName, host_ports: hostPorts });
      setMessage("Clone thành công!");
      setShowCloneModal(false);
      navigate(`/applications/${cloned.id}`);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Clone thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.deleteApplication(appId);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa application thất bại");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!application) {
    return <div className="card">{t("dashboard.loading")}</div>;
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
          <button className="button secondary" disabled={busy} onClick={openCloneModal}>Clone</button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => navigate(`/applications/${appId}/edit`)}
          >
            {t("detail.edit")}
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => setShowDeleteModal(true)}
          >
            {t("detail.delete")}
          </button>
          <button className="button secondary" disabled={busy} onClick={stopApplication}>Stop</button>
          <button className="button primary" disabled={busy || doctorLoading || planLoading || Boolean(doctor && !doctor.can_deploy)} onClick={prepareDeploy}>
            {planLoading ? t("detail.planning") : "Deploy"}
          </button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="stats-grid">
        <article className="card stat">
          <span>Services</span>
          <strong>{application.services.length}</strong>
          <small>{t("detail.declared")}</small>
        </article>
        <article className="card stat">
          <span>Containers</span>
          <strong>{containers.length}</strong>
          <small>{t("detail.detected")}</small>
        </article>
        <article className="card stat">
          <span>{t("detail.status")}</span>
          <strong>{containers.some((c) => c.status === "running") ? "Running" : "Stopped"}</strong>
          <small>{t("detail.dockerStatus")}</small>
        </article>
      </section>

      <section className="section">
        <DoctorReport report={doctor} loading={doctorLoading} onRun={runDoctor} />
      </section>

      <section className="section">
        <ChangePlanPanel plan={changePlan} loading={planLoading} onRefresh={refreshChangePlan} />
      </section>

      <section className="two-columns section">
        <article className="card panel">
          <div className="section-title">
            <div>
              <h2>Containers</h2>
              <p>{t("detail.currentStatus")}</p>
            </div>
            <button className="button secondary" onClick={refresh}>Refresh</button>
          </div>
          {containers.length === 0 ? (
            <p>{t("detail.notDeployed")}</p>
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
                    : t("detail.noPublicPort")}
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

      {showDeployPlan && (
        <DeployPlanDialog
          plan={changePlan}
          busy={busy}
          onCancel={() => setShowDeployPlan(false)}
          onConfirm={confirmDeploy}
        />
      )}

      {showCloneModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={(event) => { event.preventDefault(); cloneApp(); }}>
            <p className="eyebrow">SAFE CLONE</p>
            <h2>Clone "{application.name}"</h2>
            <p>Chọn host port mới để clone có thể deploy song song với application gốc.</p>
            {cloneError && <div className="alert error">{cloneError}</div>}
            <div className="clone-fields">
              <label>
                Tên application mới
                <input value={cloneName} onChange={(event) => setCloneName(event.target.value)} required />
              </label>
              {application.services.filter((service) => service.host_port).map((service) => (
                <label key={service.name}>
                  Host port mới cho {service.name}
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={clonePorts[service.name] ?? ""}
                    placeholder={`Port gốc: ${service.host_port}`}
                    onChange={(event) => setClonePorts((ports) => ({ ...ports, [service.name]: event.target.value }))}
                    required
                  />
                </label>
              ))}
            </div>
            <div className="actions modal-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={() => setShowCloneModal(false)}>Hủy</button>
              <button className="button primary" type="submit" disabled={busy}>{busy ? "Đang clone..." : "Tạo clone"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="eyebrow">XÁC NHẬN XÓA</p>
            <h2>Xóa "{application.name}"?</h2>
            <p>
              Thao tác này sẽ xóa toàn bộ metadata và file compose của application.
              Các Docker volume sẽ <strong>không</strong> bị xóa tự động.
              Hành động này không thể hoàn tác.
            </p>
            <div className="actions modal-actions">
              <button
                className="button secondary"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Hủy
              </button>
              <button
                className="button danger"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
