import type { DoctorReport as DoctorReportData } from "../types";
import { useI18n } from "../i18n";

type DoctorReportProps = {
  report: DoctorReportData | null;
  loading: boolean;
  onRun: () => void;
};

const label = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export default function DoctorReport({ report, loading, onRun }: DoctorReportProps) {
  const { t } = useI18n();
  return (
    <section className="card panel doctor-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">SAFE RELEASE</p>
          <h2>{t("doctor.title")}</h2>
          <p>{t("doctor.description")}</p>
        </div>
        <button className="button secondary" disabled={loading} onClick={onRun}>
          {loading ? t("doctor.checking") : t("doctor.run")}
        </button>
      </div>

      {!report ? (
        <p className="muted">{t("doctor.empty")}</p>
      ) : (
        <>
          <div className={`doctor-summary ${report.can_deploy ? "safe" : "blocked"}`}>
            <strong>{report.can_deploy ? "Sẵn sàng deploy" : "Deploy đang bị chặn"}</strong>
            <span>{report.critical_count} critical · {report.warning_count} warning · {report.info_count} info</span>
          </div>
          <div className="doctor-issues">
            {report.issues.map((issue) => (
              <article className={`doctor-issue ${issue.severity}`} key={`${issue.code}-${issue.service || "app"}`}>
                <div className="issue-heading">
                  <span className={`severity ${issue.severity}`}>{label[issue.severity]}</span>
                  {issue.service && <small>{issue.service}</small>}
                </div>
                <strong>{issue.title}</strong>
                <p>{issue.detail}</p>
                {issue.recommendation && <small>Gợi ý: {issue.recommendation}</small>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
