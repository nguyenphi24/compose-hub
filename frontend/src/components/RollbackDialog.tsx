import type { ReleaseRevision } from "../types";

type RollbackDialogProps = {
  revision: ReleaseRevision | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RollbackDialog({ revision, busy, onCancel, onConfirm }: RollbackDialogProps) {
  if (!revision) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="rollback-title">
        <p className="eyebrow">SAFE RELEASE</p>
        <h2 id="rollback-title">Rollback về revision #{revision.id}?</h2>
        <p>
          ComposeHub sẽ deploy Compose snapshot đã lưu của revision này. Cấu hình application hiện tại sẽ được giữ lại như một revision rollback mới.
        </p>
        <div className="actions modal-actions">
          <button className="button secondary" disabled={busy} onClick={onCancel}>Hủy</button>
          <button className="button danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Đang rollback..." : "Xác nhận rollback"}
          </button>
        </div>
      </section>
    </div>
  );
}
