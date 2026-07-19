import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { Service } from "../types";

// ── helpers ──────────────────────────────────────────────────────────────────

function envObjToRows(env: Record<string, string>): { key: string; value: string }[] {
  return Object.entries(env).map(([key, value]) => ({ key, value }));
}

function rowsToEnvObj(rows: { key: string; value: string }[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (k) obj[k] = r.value;
  }
  return obj;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface EnvRow { key: string; value: string }
interface VolumeRow { source: string; target: string; targetError?: string }

interface ServiceEditorState {
  name: string;
  image: string;
  container_port: string;
  host_port: string;
  restart_policy: string;
  envRows: EnvRow[];
  volumeRows: VolumeRow[];
}

// ── factory ───────────────────────────────────────────────────────────────────

function emptyServiceState(): ServiceEditorState {
  return {
    name: "",
    image: "",
    container_port: "",
    host_port: "",
    restart_policy: "unless-stopped",
    envRows: [{ key: "", value: "" }],
    volumeRows: [],
  };
}

function serviceToState(svc: Service): ServiceEditorState {
  return {
    name: svc.name,
    image: svc.image,
    container_port: svc.container_port !== null ? String(svc.container_port) : "",
    host_port: svc.host_port !== null ? String(svc.host_port) : "",
    restart_policy: svc.restart_policy,
    envRows: envObjToRows(svc.environment).concat([{ key: "", value: "" }]),
    volumeRows: svc.volumes.map((v) => ({ source: v.source, target: v.target })),
  };
}

function stateToService(s: ServiceEditorState): Service {
  return {
    name: s.name,
    image: s.image,
    container_port: s.container_port ? Number(s.container_port) : null,
    host_port: s.host_port ? Number(s.host_port) : null,
    restart_policy: s.restart_policy,
    environment: rowsToEnvObj(s.envRows),
    volumes: s.volumeRows
      .filter((v) => v.source.trim() && v.target.trim())
      .map((v) => ({ source: v.source.trim(), target: v.target.trim() })),
  };
}

// ── ServiceEditor component ───────────────────────────────────────────────────

function ServiceEditor({
  index,
  state,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  state: ServiceEditorState;
  canRemove: boolean;
  onChange: (patch: Partial<ServiceEditorState>) => void;
  onRemove: () => void;
}) {
  const updateEnvRow = (i: number, patch: Partial<EnvRow>) => {
    const rows = state.envRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    // Auto-add new empty row if last row has content
    const last = rows[rows.length - 1];
    if (last.key.trim() || last.value.trim()) rows.push({ key: "", value: "" });
    onChange({ envRows: rows });
  };

  const removeEnvRow = (i: number) => {
    const rows = state.envRows.filter((_, idx) => idx !== i);
    if (rows.length === 0) rows.push({ key: "", value: "" });
    onChange({ envRows: rows });
  };

  const dupEnvKeys = (() => {
    const keys = state.envRows.map((r) => r.key.trim()).filter(Boolean);
    const seen = new Set<string>();
    const dups = new Set<string>();
    keys.forEach((k) => { if (seen.has(k)) dups.add(k); else seen.add(k); });
    return dups;
  })();

  const addVolume = () =>
    onChange({ volumeRows: [...state.volumeRows, { source: "", target: "" }] });

  const updateVolume = (i: number, patch: Partial<VolumeRow>) => {
    const rows = state.volumeRows.map((v, idx) => {
      if (idx !== i) return v;
      const updated = { ...v, ...patch };
      // Validate target
      const t = updated.target.trim();
      updated.targetError = t && !t.startsWith("/") ? "Target phải bắt đầu bằng /" : undefined;
      return updated;
    });
    onChange({ volumeRows: rows });
  };

  const removeVolume = (i: number) =>
    onChange({ volumeRows: state.volumeRows.filter((_, idx) => idx !== i) });

  return (
    <article className="card form-card">
      <div className="service-header">
        <h3>Service #{index + 1}</h3>
        {canRemove && (
          <button type="button" className="button danger" onClick={onRemove}>Xóa</button>
        )}
      </div>

      {/* Basic fields */}
      <div className="form-grid">
        <label>
          Tên service
          <input value={state.name} onChange={(e) => onChange({ name: e.target.value })} required placeholder="web" />
        </label>
        <label>
          Docker image
          <input value={state.image} onChange={(e) => onChange({ image: e.target.value })} required placeholder="nginx:alpine" />
        </label>
        <label>
          Container port
          <input type="number" value={state.container_port} onChange={(e) => onChange({ container_port: e.target.value })} placeholder="80" />
        </label>
        <label>
          Host port
          <input type="number" value={state.host_port} onChange={(e) => onChange({ host_port: e.target.value })} placeholder="8080" />
        </label>
        <label>
          Restart policy
          <select value={state.restart_policy} onChange={(e) => onChange({ restart_policy: e.target.value })}>
            <option value="unless-stopped">unless-stopped</option>
            <option value="always">always</option>
            <option value="on-failure">on-failure</option>
            <option value="no">no</option>
          </select>
        </label>
      </div>

      {/* Environment Variables */}
      <div style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 13, color: "#b5c0d0" }}>
          Environment Variables
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.envRows.map((row, i) => {
            const isDup = row.key.trim() && dupEnvKeys.has(row.key.trim());
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                <div>
                  <input
                    value={row.key}
                    onChange={(e) => updateEnvRow(i, { key: e.target.value })}
                    placeholder="KEY"
                    style={isDup ? { borderColor: "#844150" } : undefined}
                  />
                  {isDup && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffb8c5" }}>Key trùng</p>}
                </div>
                <input
                  value={row.value}
                  onChange={(e) => updateEnvRow(i, { value: e.target.value })}
                  placeholder="value"
                />
                <button
                  type="button"
                  className="button danger compact"
                  onClick={() => removeEnvRow(i)}
                  disabled={state.envRows.length === 1 && !row.key && !row.value}
                  style={{ alignSelf: "flex-start" }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume Mounts */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#b5c0d0" }}>Volume Mounts</p>
          <button type="button" className="button secondary compact" onClick={addVolume}>+ Thêm volume</button>
        </div>
        {state.volumeRows.length === 0 && (
          <p style={{ fontSize: 13, color: "#8290a4", margin: 0 }}>Chưa có volume mount nào.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.volumeRows.map((vol, i) => (
            <div key={i}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                <input
                  value={vol.source}
                  onChange={(e) => updateVolume(i, { source: e.target.value })}
                  placeholder="source (named vol hoặc /host/path)"
                />
                <input
                  value={vol.target}
                  onChange={(e) => updateVolume(i, { target: e.target.value })}
                  placeholder="/container/path"
                  style={vol.targetError ? { borderColor: "#844150" } : undefined}
                />
                <button type="button" className="button danger compact" onClick={() => removeVolume(i)} style={{ alignSelf: "flex-start" }}>×</button>
              </div>
              {vol.targetError && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffb8c5" }}>{vol.targetError}</p>}
              {vol.source.trim().startsWith("/") && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffd78b" }}>
                  ⚠ Bind mount host path — đảm bảo path tồn tại trên host.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function EditApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const appId = Number(id);

  const [appName, setAppName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [description, setDescription] = useState("");
  const [serviceStates, setServiceStates] = useState<ServiceEditorState[]>([emptyServiceState()]);

  const [previewCompose, setPreviewCompose] = useState("");
  const [previewError, setPreviewError] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing app data
  useEffect(() => {
    api.application(appId)
      .then((app) => {
        setAppName(app.name);
        setEnvironment(app.environment);
        setDescription(app.description);
        setServiceStates(app.services.map(serviceToState));
      })
      .catch(() => setError("Không thể tải dữ liệu application"))
      .finally(() => setLoading(false));
  }, [appId]);

  // Real-time Compose preview using preview endpoint with template_id trick
  // We use the raw compose text endpoint instead
  const refreshPreview = useCallback(async () => {
    const services = serviceStates.map(stateToService);
    // Build a temp payload and use the manual create preview (compose text)
    // We call the API preview via a draft application structure
    try {
      const res = await api.previewTemplate({
        template_id: "__manual__",
        app_name: appName || "preview-app",
        variables: { services },
      });
      setPreviewCompose(res.compose);
      setPreviewError("");
    } catch {
      // Fallback: build locally from the state
      const lines: string[] = [`name: composehub-${appName || "preview-app"}`, "services:"];
      services.forEach((s) => {
        lines.push(`  ${s.name}:`);
        lines.push(`    image: ${s.image}`);
        lines.push(`    restart: ${s.restart_policy}`);
        if (s.host_port && s.container_port) {
          lines.push(`    ports:`);
          lines.push(`      - "${s.host_port}:${s.container_port}"`);
        }
        const env = Object.entries(s.environment);
        if (env.length) {
          lines.push(`    environment:`);
          env.forEach(([k, v]) => lines.push(`      ${k}: ${v}`));
        }
        if (s.volumes.length) {
          lines.push(`    volumes:`);
          s.volumes.forEach((v) => lines.push(`      - ${v.source}:${v.target}`));
        }
      });
      setPreviewCompose(lines.join("\n"));
      setPreviewError("");
    }
  }, [serviceStates, appName]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(refreshPreview, 400);
    return () => clearTimeout(timer);
  }, [refreshPreview, loading]);

  const updateServiceState = (index: number, patch: Partial<ServiceEditorState>) => {
    setServiceStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const addService = () => setServiceStates((prev) => [...prev, emptyServiceState()]);
  const removeService = (index: number) =>
    setServiceStates((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Validate: no duplicate env keys
    for (const s of serviceStates) {
      const keys = s.envRows.map((r) => r.key.trim()).filter(Boolean);
      const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (dups.length > 0) {
        setError(`Service "${s.name}" có env key trùng: ${dups.join(", ")}`);
        return;
      }
      // Validate volume targets
      for (const v of s.volumeRows) {
        const t = v.target.trim();
        if (t && !t.startsWith("/")) {
          setError(`Service "${s.name}": Volume target phải bắt đầu bằng /`);
          return;
        }
      }
    }
    setSaving(true);
    setError("");
    try {
      await api.updateApplication(appId, {
        name: appName,
        environment,
        description,
        services: serviceStates.map(stateToService),
      });
      navigate(`/applications/${appId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật application");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card" style={{ padding: 20 }}>Đang tải...</div>;

  return (
    <>
      <header className="page-header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(`/applications/${appId}`)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16, display: "block" }}
          >
            ← Quay lại
          </button>
          <p className="eyebrow">APPLICATION BUILDER</p>
          <h1>Chỉnh sửa Application</h1>
          <p>Cập nhật cấu hình dịch vụ. Sau khi lưu, deploy để áp dụng thay đổi.</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="two-columns" style={{ alignItems: "start" }}>
          {/* Left: Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card form-card">
              <h2>Thông tin chung</h2>
              <div className="form-grid">
                <label>
                  Tên application
                  <input value={appName} onChange={(e) => setAppName(e.target.value)} required placeholder="my-app" />
                </label>
                <label>
                  Môi trường
                  <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </label>
                <label className="full">
                  Mô tả
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ứng dụng..." />
                </label>
              </div>
            </section>

            <div>
              <div className="section-title">
                <div>
                  <h2>Services</h2>
                  <p>Cấu hình image, port, env vars và volume mounts.</p>
                </div>
                <button type="button" className="button secondary" onClick={addService}>+ Thêm service</button>
              </div>
              <div className="service-list">
                {serviceStates.map((svc, index) => (
                  <ServiceEditor
                    key={index}
                    index={index}
                    state={svc}
                    canRemove={serviceStates.length > 1}
                    onChange={(patch) => updateServiceState(index, patch)}
                    onRemove={() => removeService(index)}
                  />
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="button primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button type="button" className="button secondary" onClick={() => navigate(`/applications/${appId}`)}>
                Hủy
              </button>
            </div>
          </div>

          {/* Right: Compose Preview */}
          <article className="card panel code-panel" style={{ position: "sticky", top: 24 }}>
            <div className="section-title">
              <div>
                <h2>Xem trước compose.yaml</h2>
                <p>Cập nhật thời gian thực khi bạn chỉnh sửa.</p>
              </div>
            </div>
            {previewError
              ? <div className="alert error">{previewError}</div>
              : <pre style={{ minHeight: 340, margin: 0 }}>{previewCompose || "Đang tải..."}</pre>
            }
          </article>
        </div>
      </form>
    </>
  );
}
