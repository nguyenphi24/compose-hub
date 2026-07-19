import type { ChangePlan } from "../types";

type DeployPlanDialogProps = {
  plan: ChangePlan | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeployPlanDialog({ plan, busy, onCancel, onConfirm }: DeployPlanDialogProps) {
  if (!plan) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal deploy-plan-modal">
        <p className="eyebrow">DEPLOY GATE</p>
        <h2>Xác nhận Change Plan</h2>
        <div className={`deploy-risk risk-${plan.risk_level}`}>
          <strong>{plan.risk_level.toUpperCase()} RISK</strong>
          <span>{plan.rollback_available ? "Rollback sẵn sàng" : "Chưa có rollback cho first deploy"}</span>
        </div>
        <div className="deploy-change-list">
          {plan.changes.map((change) => (
            <div key={`${change.code}-${change.service || "app"}`}>
              <strong>{change.service ? `${change.service}: ` : ""}{change.title}</strong>
              <small>{change.detail}</small>
            </div>
          ))}
        </div>
        <div className="actions modal-actions">
          <button className="button secondary" disabled={busy} onClick={onCancel}>Hủy</button>
          <button className={plan.risk_level === "high" ? "button danger" : "button primary"} disabled={busy} onClick={onConfirm}>
            {busy ? "Đang deploy..." : "Xác nhận Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
