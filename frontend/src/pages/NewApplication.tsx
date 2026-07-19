import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Service } from "../types";
import { useI18n } from "../i18n";

// ── helpers ──────────────────────────────────────────────────────────────────

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

function stateToService(s: ServiceEditorState): Service {
  const obj: Record<string, string> = {};
  for (const r of s.envRows) {
    const k = r.key.trim();
    if (k) obj[k] = r.value;
  }
  return {
    name: s.name,
    image: s.image,
    container_port: s.container_port ? Number(s.container_port) : null,
    host_port: s.host_port ? Number(s.host_port) : null,
    restart_policy: s.restart_policy,
    environment: obj,
    volumes: s.volumeRows
      .filter((v) => v.source.trim() && v.target.trim())
      .map((v) => ({ source: v.source.trim(), target: v.target.trim() })),
  };
}

// ── ServiceEditor ─────────────────────────────────────────────────────────────

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
    const seen = new Set<string>(); const dups = new Set<string>();
    keys.forEach((k) => { if (seen.has(k)) dups.add(k); else seen.add(k); });
    return dups;
  })();

  const addVolume = () =>
    onChange({ volumeRows: [...state.volumeRows, { source: "", target: "" }] });

  const updateVolume = (i: number, patch: Partial<VolumeRow>) => {
    const rows = state.volumeRows.map((v, idx) => {
      if (idx !== i) return v;
      const updated = { ...v, ...patch };
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

      {/* Env Vars */}
      <div style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 13, color: "#b5c0d0" }}>Environment Variables</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.envRows.map((row, i) => {
            const isDup = row.key.trim() && dupEnvKeys.has(row.key.trim());
            return (
              <div key={i}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                  <div>
                    <input value={row.key} onChange={(e) => updateEnvRow(i, { key: e.target.value })} placeholder="KEY"
                      style={isDup ? { borderColor: "#844150" } : undefined} />
                    {isDup && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffb8c5" }}>Key trùng</p>}
                  </div>
                  <input value={row.value} onChange={(e) => updateEnvRow(i, { value: e.target.value })} placeholder="value" />
                  <button type="button" className="button danger compact" onClick={() => removeEnvRow(i)}
                    style={{ alignSelf: "flex-start" }}>×</button>
                </div>
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
                <input value={vol.source} onChange={(e) => updateVolume(i, { source: e.target.value })} placeholder="source hoặc /host/path" />
                <input value={vol.target} onChange={(e) => updateVolume(i, { target: e.target.value })} placeholder="/container/path"
                  style={vol.targetError ? { borderColor: "#844150" } : undefined} />
                <button type="button" className="button danger compact" onClick={() => removeVolume(i)} style={{ alignSelf: "flex-start" }}>×</button>
              </div>
              {vol.targetError && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffb8c5" }}>{vol.targetError}</p>}
              {vol.source.trim().startsWith("/") && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffd78b" }}>⚠ Bind mount host path.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── Blueprint types ───────────────────────────────────────────────────────────

interface TemplateVariable {
  key: string; label: string; type: "int" | "string" | "password";
  default: any; required: boolean; description: string;
}
interface Template { id: string; name: string; description: string; variables: TemplateVariable[]; }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewApplication() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"blueprint" | "manual">("blueprint");

  // General info
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [description, setDescription] = useState("");

  // Manual builder
  const [serviceStates, setServiceStates] = useState<ServiceEditorState[]>([emptyServiceState()]);
  const [manualPreview, setManualPreview] = useState("");

  // Blueprint
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});
  const [previewCompose, setPreviewCompose] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch blueprints
  useEffect(() => {
    if (mode !== "blueprint") return;
    setLoadingTemplates(true);
    api.templates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0 && !selectedTemplateId) selectTemplate(data[0].id, data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải blueprint"))
      .finally(() => setLoadingTemplates(false));
  }, [mode]);

  const selectTemplate = (templateId: string, list = templates) => {
    setSelectedTemplateId(templateId);
    const tpl = list.find((t) => t.id === templateId);
    if (tpl) {
      const defaults: Record<string, any> = {};
      tpl.variables.forEach((v) => { defaults[v.key] = v.default; });
      setTemplateVariables(defaults);
    }
  };

  // Blueprint real-time preview
  useEffect(() => {
    if (mode !== "blueprint" || !selectedTemplateId) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await api.previewTemplate({
          template_id: selectedTemplateId,
          app_name: name || "preview-app",
          variables: templateVariables,
        });
        if (active) { setPreviewCompose(data.compose); setPreviewError(""); }
      } catch (err) {
        if (active) setPreviewError(err instanceof Error ? err.message : "Lỗi preview");
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, selectedTemplateId, name, templateVariables]);

  // Manual real-time compose preview (local build)
  useEffect(() => {
    if (mode !== "manual") return;
    const services = serviceStates.map(stateToService);
    const lines: string[] = [`name: composehub-${name || "preview-app"}`, "services:"];
    services.forEach((s) => {
      lines.push(`  ${s.name || "service"}:`);
      lines.push(`    image: ${s.image || "<image>"}`);
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
    setManualPreview(lines.join("\n"));
  }, [mode, name, serviceStates]);

  const updateServiceState = (index: number, patch: Partial<ServiceEditorState>) =>
    setServiceStates((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    // Validate
    for (const s of serviceStates) {
      const keys = s.envRows.map((r) => r.key.trim()).filter(Boolean);
      const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (dups.length) { setError(`Service "${s.name}": env key trùng — ${dups.join(", ")}`); return; }
      for (const v of s.volumeRows) {
        const t = v.target.trim();
        if (t && !t.startsWith("/")) { setError(`Service "${s.name}": volume target phải bắt đầu bằng /`); return; }
      }
    }
    setSaving(true); setError("");
    try {
      const app = await api.createApplication({ name, environment, description, services: serviceStates.map(stateToService) });
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo application");
    } finally { setSaving(false); }
  };

  const submitBlueprint = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTemplateId) { setError("Vui lòng chọn một Blueprint"); return; }
    setSaving(true); setError("");
    try {
      const app = await api.createFromTemplate({ template_id: selectedTemplateId, name, environment, description, variables: templateVariables });
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo application");
    } finally { setSaving(false); }
  };

  const getTemplateIconBg = (id: string) =>
    id === "nginx" ? "#1b4d3e" : id === "postgres" ? "#1a365d" : "#5c253c";
  const getTemplateIconText = (id: string) =>
    id === "nginx" ? "N" : id === "postgres" ? "P" : "8";

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("app.builder")}</p>
          <h1>{t("app.newTitle")}</h1>
          <p>{t("app.newDescription")}</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, borderBottom: "1px solid #24334a", paddingBottom: 16 }}>
        <button type="button" className={`button ${mode === "blueprint" ? "primary" : "secondary"}`} onClick={() => setMode("blueprint")}>
          {t("app.blueprints")}
        </button>
        <button type="button" className={`button ${mode === "manual" ? "primary" : "secondary"}`} onClick={() => setMode("manual")}>
          {t("app.manual")}
        </button>
      </div>

      {mode === "manual" ? (
        <form onSubmit={submitManual}>
          <div className="two-columns" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section className="card form-card">
                <h2>{t("app.general")}</h2>
                <div className="form-grid">
                  <label>Tên application<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="demo-blog" /></label>
                  <label>Môi trường
                    <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </label>
                  <label className="full">Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ứng dụng..." /></label>
                </div>
              </section>

              <div>
                <div className="section-title">
                  <div><h2>{t("app.services")}</h2><p>{t("app.servicesDescription")}</p></div>
                  <button type="button" className="button secondary" onClick={() => setServiceStates((p) => [...p, emptyServiceState()])}>
                    {t("app.addService")}
                  </button>
                </div>
                <div className="service-list">
                  {serviceStates.map((svc, index) => (
                    <ServiceEditor
                      key={index} index={index} state={svc} canRemove={serviceStates.length > 1}
                      onChange={(patch) => updateServiceState(index, patch)}
                      onRemove={() => setServiceStates((p) => p.filter((_, i) => i !== index))}
                    />
                  ))}
                </div>
              </div>

              <div className="actions">
                <button className="button primary" disabled={saving}>{saving ? t("app.creating") : t("app.create")}</button>
              </div>
            </div>

            {/* Manual Compose Preview */}
            <article className="card panel code-panel" style={{ position: "sticky", top: 24 }}>
              <div className="section-title">
                <div><h2>{t("app.preview")}</h2><p>{t("app.realtime")}</p></div>
              </div>
              <pre style={{ minHeight: 340, margin: 0 }}>{manualPreview || t("app.previewHint")}</pre>
            </article>
          </div>
        </form>
      ) : (
        /* Blueprint mode */
        <div>
          {loadingTemplates ? (
            <div className="card" style={{ padding: 20 }}>{t("app.loadingBlueprints")}</div>
          ) : (
            <>
              <div className="app-grid" style={{ marginBottom: 28 }}>
                {templates.map((tpl) => (
                  <div key={tpl.id} className="card app-card"
                    style={{ cursor: "pointer", border: selectedTemplateId === tpl.id ? "2px solid #705cff" : "1px solid #24334a", background: selectedTemplateId === tpl.id ? "#151e2b" : "#121b29" }}
                    onClick={() => selectTemplate(tpl.id)}>
                    <div className="app-icon" style={{ background: getTemplateIconBg(tpl.id), color: "#fff" }}>
                      {getTemplateIconText(tpl.id)}
                    </div>
                    <div>
                      <h3>{tpl.name}</h3>
                      <p style={{ fontSize: 13, lineHeight: 1.4 }}>{tpl.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {activeTemplate && (
                <form onSubmit={submitBlueprint}>
                  <div className="two-columns">
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <section className="card form-card">
                        <h2>{t("app.general")}</h2>
                        <div className="form-grid">
                          <label>Tên application<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="my-blueprint-app" /></label>
                          <label>Môi trường
                            <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                              <option value="production">Production</option>
                              <option value="staging">Staging</option>
                              <option value="development">Development</option>
                            </select>
                          </label>
                          <label className="full">Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Ứng dụng tạo từ mẫu ${activeTemplate.name}...`} /></label>
                        </div>
                      </section>

                      <section className="card form-card">
                        <h2>Cấu hình biến cho {activeTemplate.name}</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {activeTemplate.variables.map((varDef) => (
                            <div key={varDef.key}>
                              <label style={{ marginBottom: 4 }}>
                                {varDef.label} {varDef.required && <span style={{ color: "#ffb8c5" }}>*</span>}
                              </label>
                              <input
                                type={varDef.type === "password" ? "password" : varDef.type === "int" ? "number" : "text"}
                                value={templateVariables[varDef.key] ?? ""}
                                onChange={(e) => setTemplateVariables((p) => ({ ...p, [varDef.key]: e.target.value }))}
                                required={varDef.required}
                                placeholder={String(varDef.default ?? "")}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8997aa" }}>{varDef.description}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className="actions">
                        <button className="button primary" disabled={saving}>{saving ? t("app.creating") : t("app.createBlueprint")}</button>
                      </div>
                    </div>

                    <article className="card panel code-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <div className="section-title">
                        <div><h2>{t("app.preview")}</h2><p>{t("app.realtime")}</p></div>
                      </div>
                      {previewError
                        ? <div className="alert error" style={{ flex: 1 }}>{previewError}</div>
                        : <pre style={{ flex: 1, margin: 0, minHeight: 380 }}>{previewCompose || t("app.loadingPreview")}</pre>
                      }
                    </article>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
