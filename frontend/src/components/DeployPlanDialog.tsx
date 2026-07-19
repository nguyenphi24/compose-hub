import type { ChangePlan } from "../types";
import { useI18n } from "../i18n";

type DeployPlanDialogProps = {
  plan: ChangePlan | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeployPlanDialog({ plan, busy, onCancel, onConfirm }: DeployPlanDialogProps) {
  const { t } = useI18n();
  if (!plan) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal deploy-plan-modal">
        <p className="eyebrow">DEPLOY GATE</p>
        <h2>{t("deploy.confirmTitle")}</h2>
        <div className={`deploy-risk risk-${plan.risk_level}`}>
          <strong>{plan.risk_level.toUpperCase()} RISK</strong>
          <span>{plan.rollback_available ? t("deploy.rollbackReady") : t("deploy.firstDeploy")}</span>
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
          <button className="button secondary" disabled={busy} onClick={onCancel}>{t("common.cancel")}</button>
          <button className={plan.risk_level === "high" ? "button danger" : "button primary"} disabled={busy} onClick={onConfirm}>
            {busy ? t("deploy.deploying") : t("deploy.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
