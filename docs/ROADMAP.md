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

### v0.3.0 — Distribution Foundation

- One-command installer from GitHub Releases.
- Version-pinned installation and data-preserving upgrades.
- Configurable installation directory and ports.
- Vietnamese and English UI.

## Later

### v0.4.0 — Recovery Capsule

- Portable recovery manifest for the active release.
- Compose snapshot, image digests and secret references.
- Volume inventory and capsule integrity validation.

### v0.5.0 — Safe Clone Environment

- Port and domain remapping.
- Empty, sanitized or restored data modes.
- Production-to-staging safety checks.

### Later — Published Images

- Published multi-architecture container images.
- Update and rollback commands that do not require a local image build.

Authentication/RBAC, multi-server management, Git integration and networking
automation remain unversioned until the preceding recovery and distribution
work is released.
