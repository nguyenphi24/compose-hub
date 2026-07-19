import type { ReleaseRevision } from "../types";
import { useI18n } from "../i18n";

type ReleaseTimelineProps = {
  revisions: ReleaseRevision[];
  busy: boolean;
  onRollback: (revision: ReleaseRevision) => void;
};

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReleaseTimeline({ revisions, busy, onRollback }: ReleaseTimelineProps) {
  const { language, t } = useI18n();
  return (
    <section className="card panel release-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">IMMUTABLE SNAPSHOTS</p>
          <h2>{t("release.title")}</h2>
          <p>{t("release.description")}</p>
        </div>
      </div>

      {revisions.length === 0 ? (
        <p className="muted">{t("release.empty")}</p>
      ) : (
        <div className="timeline">
          {revisions.map((revision) => (
            <article className="timeline-item" key={revision.id}>
              <div className={`timeline-dot ${revision.status}`} />
              <div className="timeline-content">
                <div className="timeline-heading">
                  <div>
                    <strong>#{revision.id} · {revision.action === "rollback" ? "Rollback" : "Deploy"}</strong>
                    <small>{formatTime(revision.created_at, language === "vi" ? "vi-VN" : "en-US")}</small>
                  </div>
                  <span className={`release-status ${revision.status}`}>{revision.status}</span>
                </div>
                {revision.target_revision_id && (
                  <p>Đã quay lại revision #{revision.target_revision_id}.</p>
                )}
                {revision.doctor_report && (
                  <p className="muted">
                    Doctor: {revision.doctor_report.critical_count} critical · {revision.doctor_report.warning_count} warning
                  </p>
                )}
                {revision.output && <pre className="release-output">{revision.output}</pre>}
                {revision.status === "success" && (
                  <button className="button secondary compact" disabled={busy} onClick={() => onRollback(revision)}>
                    Rollback về bản này
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
