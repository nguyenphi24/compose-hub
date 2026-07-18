import { FormEvent, useState } from "react";
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

export default function NewApplication() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<Service[]>([emptyService()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateService = (index: number, patch: Partial<Service>) => {
    setServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, ...patch } : service
      )
    );
  };

  const submit = async (event: FormEvent) => {
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

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">APPLICATION BUILDER</p>
          <h1>Tạo Application</h1>
          <p>Khai báo service trực tiếp bằng giao diện.</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={submit}>
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

        <div className="actions">
          <button className="button primary" disabled={saving}>
            {saving ? "Đang tạo..." : "Tạo Application"}
          </button>
        </div>
      </form>
    </>
  );
}
