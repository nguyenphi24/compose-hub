# ComposeHub release roadmap

This roadmap reflects released functionality and the order of future work. A
future release starts only after the active release passes its gate in
[`task.md`](../task.md).

## Released

### v0.1.0 — Single Host Safe Release

- Application builder and blueprints.
- Compose Doctor.
- Deploy, status, logs and stop.
- Release snapshots and rollback.

### v0.2.0 — Change Plan

- Desired-versus-released Compose comparison.
- Deployment risk and data-risk classification.
- Deploy confirmation and stale-plan protection.

## Next

### v0.3.0 — Recovery Capsule

- Export a portable recovery manifest for the active release.
- Compose snapshot, image digests and secret references.
- Volume inventory with explicit backup coverage status.
- Capsule integrity validation.

## Later

### v0.4.0 — Safe Clone Environment

- Port and domain remapping.
- Empty, sanitized or restored data modes.
- Production-to-staging safety checks.

### v0.5.0 — Distribution

- Published multi-architecture container images.
- One-command installer.
- Version-pinned update and rollback commands.

Authentication/RBAC, multi-server management, Git integration and networking
automation remain unversioned until the preceding recovery and distribution
work is released.
