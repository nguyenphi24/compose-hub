import type { ChangePlan } from "../types";

type ChangePlanPanelProps = {
  plan: ChangePlan | null;
  loading: boolean;
  onRefresh: () => void;
};

const riskLabel = { low: "Low", medium: "Medium", high: "High" };

export default function ChangePlanPanel({ plan, loading, onRefresh }: ChangePlanPanelProps) {
  return (
    <section className="card panel change-plan-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">CHANGE CONTROL</p>
          <h2>Change Plan</h2>
          <p>So sánh cấu hình mong muốn với release thành công đang chạy.</p>
        </div>
        <button className="button secondary" disabled={loading} onClick={onRefresh}>
          {loading ? "Đang phân tích..." : "Refresh plan"}
        </button>
      </div>

      {!plan ? (
        <p className="muted">Chưa có Change Plan.</p>
      ) : (
        <>
          <div className={`change-plan-summary risk-${plan.risk_level}`}>
            <div>
              <span className={`risk-badge ${plan.risk_level}`}>{riskLabel[plan.risk_level]} risk</span>
              <strong>{plan.first_deploy ? "First deploy" : `So với revision #${plan.baseline_revision_id}`}</strong>
            </div>
            <span>{plan.rollback_available ? "Có rollback snapshot" : "Chưa có rollback snapshot"}</span>
          </div>
          <div className="change-plan-metrics">
            <span><strong>{plan.services_added.length}</strong> add</span>
            <span><strong>{plan.services_recreated.length}</strong> recreate</span>
            <span><strong>{plan.services_removed.length}</strong> remove</span>
          </div>
          <div className="change-list">
            {plan.changes.map((change) => (
              <article className={`change-item risk-${change.risk}`} key={`${change.code}-${change.service || "app"}`}>
                <div className="issue-heading">
                  <span className={`risk-badge ${change.risk}`}>{riskLabel[change.risk]}</span>
                  {change.service && <small>{change.service}</small>}
                </div>
                <strong>{change.title}</strong>
                <p>{change.detail}</p>
                <small>
                  {change.requires_recreate && "Container sẽ recreate"}
                  {change.requires_recreate && change.data_risk && " · "}
                  {change.data_risk && "Cần kiểm tra dữ liệu"}
                </small>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
