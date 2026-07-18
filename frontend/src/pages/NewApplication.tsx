import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Service } from "../types";

const emptyService = (): Service => ({
  name: "",
  image: "",
  container_port: null,
  host_port: null,
  restart_policy: "unless-stopped",
  environment: {},
  volumes: [],
});

interface TemplateVariable {
  key: string;
  label: string;
  type: "int" | "string" | "password";
  default: any;
  required: boolean;
  description: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
}

export default function NewApplication() {
  const navigate = useNavigate();
  
  // Tabs: 'blueprint' or 'manual'
  const [mode, setMode] = useState<"blueprint" | "manual">("blueprint");
  
  // General application info
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [description, setDescription] = useState("");
  
  // State for manual builder
  const [services, setServices] = useState<Service[]>([emptyService()]);
  
  // State for blueprints
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});
  const [previewCompose, setPreviewCompose] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch blueprints on mount
  useEffect(() => {
    if (mode === "blueprint") {
      setLoadingTemplates(true);
      api.templates()
        .then((data) => {
          setTemplates(data);
          if (data.length > 0 && !selectedTemplateId) {
            selectTemplate(data[0].id, data);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách blueprint");
        })
        .finally(() => {
          setLoadingTemplates(false);
        });
    }
  }, [mode]);

  // Select blueprint and pre-populate variables with defaults
  const selectTemplate = (templateId: string, list = templates) => {
    setSelectedTemplateId(templateId);
    const tpl = list.find((t) => t.id === templateId);
    if (tpl) {
      const defaults: Record<string, any> = {};
      tpl.variables.forEach((v) => {
        defaults[v.key] = v.default;
      });
      setTemplateVariables(defaults);
    }
  };

  // Update a single template variable value
  const handleVariableChange = (key: string, value: string) => {
    setTemplateVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Real-time Preview logic
  useEffect(() => {
    if (mode !== "blueprint" || !selectedTemplateId) return;
    let active = true;

    const fetchPreview = async () => {
      try {
        const data = await api.previewTemplate({
          template_id: selectedTemplateId,
          app_name: name || "preview-app",
          variables: templateVariables,
        });
        if (active) {
          setPreviewCompose(data.compose);
          setPreviewError("");
        }
      } catch (err) {
        if (active) {
          setPreviewError(err instanceof Error ? err.message : "Lỗi tạo preview");
        }
      }
    };

    const timer = setTimeout(fetchPreview, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, selectedTemplateId, name, templateVariables]);

  const updateService = (index: number, patch: Partial<Service>) => {
    setServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, ...patch } : service
      )
    );
  };

  // Submit manual form
  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const app = await api.createApplication({
        name,
        environment,
        description,
        services,
      });
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo application");
    } finally {
      setSaving(false);
    }
  };

  // Submit blueprint form
  const submitBlueprint = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTemplateId) {
      setError("Vui lòng chọn một Blueprint");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const app = await api.createFromTemplate({
        template_id: selectedTemplateId,
        name,
        environment,
        description,
        variables: templateVariables,
      });
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo application");
    } finally {
      setSaving(false);
    }
  };

  const getTemplateIconBg = (id: string) => {
    if (id === "nginx") return "#1b4d3e";
    if (id === "postgres") return "#1a365d";
    return "#5c253c";
  };

  const getTemplateIconText = (id: string) => {
    if (id === "nginx") return "N";
    if (id === "postgres") return "P";
    return "8";
  };

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">APPLICATION BUILDER</p>
          <h1>Tạo Application</h1>
          <p>Khai báo ứng dụng của bạn bằng Blueprint hoặc Giao diện thủ công.</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "28px", borderBottom: "1px solid #24334a", paddingBottom: "16px" }}>
        <button
          type="button"
          className={`button ${mode === "blueprint" ? "primary" : "secondary"}`}
          onClick={() => setMode("blueprint")}
        >
          Kho Blueprint
        </button>
        <button
          type="button"
          className={`button ${mode === "manual" ? "primary" : "secondary"}`}
          onClick={() => setMode("manual")}
        >
          Tự cấu hình (Cơ bản)
        </button>
      </div>

      {mode === "manual" ? (
        /* Manual Form */
        <form onSubmit={submitManual}>
          <section className="card form-card">
            <h2>Thông tin chung</h2>
            <div className="form-grid">
              <label>
                Tên application
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="demo-blog" />
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
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ứng dụng demo chạy Nginx..." />
              </label>
            </div>
          </section>

          <section className="section">
            <div className="section-title">
              <div>
                <h2>Services</h2>
                <p>MVP hỗ trợ image, port và restart policy.</p>
              </div>
              <button type="button" className="button secondary" onClick={() => setServices([...services, emptyService()])}>
                + Thêm service
              </button>
            </div>

            <div className="service-list">
              {services.map((service, index) => (
                <article className="card form-card" key={index}>
                  <div className="service-header">
                    <h3>Service #{index + 1}</h3>
                    {services.length > 1 && (
                      <button type="button" className="button danger" onClick={() => setServices(services.filter((_, i) => i !== index))}>
                        Xóa
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <label>
                      Tên service
                      <input value={service.name} onChange={(e) => updateService(index, { name: e.target.value })} required placeholder="web" />
                    </label>
                    <label>
                      Docker image
                      <input value={service.image} onChange={(e) => updateService(index, { image: e.target.value })} required placeholder="nginx:alpine" />
                    </label>
                    <label>
                      Container port
                      <input type="number" value={service.container_port ?? ""} onChange={(e) => updateService(index, { container_port: e.target.value ? Number(e.target.value) : null })} placeholder="80" />
                    </label>
                    <label>
                      Host port
                      <input type="number" value={service.host_port ?? ""} onChange={(e) => updateService(index, { host_port: e.target.value ? Number(e.target.value) : null })} placeholder="8088" />
                    </label>
                    <label>
                      Restart policy
                      <select value={service.restart_policy} onChange={(e) => updateService(index, { restart_policy: e.target.value })}>
                        <option value="unless-stopped">unless-stopped</option>
                        <option value="always">always</option>
                        <option value="no">no</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="actions" style={{ marginTop: "24px" }}>
            <button className="button primary" disabled={saving}>
              {saving ? "Đang tạo..." : "Tạo Application"}
            </button>
          </div>
        </form>
      ) : (
        /* Blueprint Form */
        <div>
          {loadingTemplates ? (
            <div className="card" style={{ padding: "20px" }}>Đang tải danh sách Blueprint...</div>
          ) : (
            <>
              {/* Grid of Templates */}
              <div className="app-grid" style={{ marginBottom: "28px" }}>
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="card app-card"
                    style={{
                      cursor: "pointer",
                      border: selectedTemplateId === tpl.id ? "2px solid #705cff" : "1px solid #24334a",
                      background: selectedTemplateId === tpl.id ? "#151e2b" : "#121b29",
                    }}
                    onClick={() => selectTemplate(tpl.id)}
                  >
                    <div className="app-icon" style={{ background: getTemplateIconBg(tpl.id), color: "#fff" }}>
                      {getTemplateIconText(tpl.id)}
                    </div>
                    <div>
                      <h3>{tpl.name}</h3>
                      <p style={{ fontSize: "13px", lineHeight: "1.4" }}>{tpl.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {activeTemplate && (
                <form onSubmit={submitBlueprint}>
                  <div className="two-columns">
                    {/* Left Column: Config Form */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <section className="card form-card">
                        <h2>Thông tin chung</h2>
                        <div className="form-grid">
                          <label>
                            Tên application
                            <input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              placeholder="my-blueprint-app"
                            />
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
                            <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder={`Ứng dụng tạo từ mẫu ${activeTemplate.name}...`}
                            />
                          </label>
                        </div>
                      </section>

                      <section className="card form-card">
                        <h2>Cấu hình biến cho {activeTemplate.name}</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          {activeTemplate.variables.map((varDef) => (
                            <div key={varDef.key}>
                              <label style={{ marginBottom: "4px" }}>
                                {varDef.label} {varDef.required && <span style={{ color: "#ffb8c5" }}>*</span>}
                              </label>
                              <input
                                type={varDef.type === "password" ? "password" : varDef.type === "int" ? "number" : "text"}
                                value={templateVariables[varDef.key] ?? ""}
                                onChange={(e) => handleVariableChange(varDef.key, e.target.value)}
                                required={varDef.required}
                                placeholder={String(varDef.default ?? "")}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8997aa" }}>
                                {varDef.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className="actions">
                        <button className="button primary" disabled={saving}>
                          {saving ? "Đang tạo..." : `Tạo từ Blueprint`}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Live Compose.yaml Preview */}
                    <div>
                      <article className="card panel code-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <div className="section-title">
                          <div>
                            <h2>Xem trước compose.yaml</h2>
                            <p>Thay đổi cấu hình để cập nhật YAML thời gian thực.</p>
                          </div>
                        </div>
                        {previewError ? (
                          <div className="alert error" style={{ flex: 1 }}>{previewError}</div>
                        ) : (
                          <pre style={{ flex: 1, margin: 0, minHeight: "380px" }}>{previewCompose || "Đang tải preview..."}</pre>
                        )}
                      </article>
                    </div>
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
