# Phase 4.3 discovery publication

Published on 2026-11-20 by the [release workflow](https://github.com/HarshDeshmukh26/Providers/actions/runs/44780930778).
All three jobs succeeded: AMD64 compatibility, ARM64 compatibility and publication.

- Image: `ghcr.io/harshdeshmukh26/fragai-mcp-server:v0.2.0-fragai.4.3-rc.1`
- Immutable index: `sha256:9a1da88b0e38fa687d44fdda72622f0491967680dcc9190a9238a96e2ee12f00`
- Providers source commit: `fd5c57ce0e0879410c796902b37f582dcbe4a5bd`
- Source release tag: `fragai-discovery-v0.2.0-fragai.4.3-rc.1`
- Retained upstream revision: `5051acefdceb073c32ea4ca78683d3922aea643b`

| Platform | Published manifest |
| -------- | ------------------ |
| Linux AMD64 | `sha256:cb0e79febb7d0ad955ab3ce36a20055f46255d08d66ecb7108e5cafa07322bad` |
| Linux ARM64 | `sha256:01dd43e234c2a4cfb1b0ec1fe836ea4830c706e83d60f8df2a2f258abe2fb41d` |

The publication job rebuilt and retested the exact images carrying the Providers
commit label before pushing them. On both architectures it passed launch settings,
Python and all 89 installed package versions, 86 original unit tests against each
runtime, and 26 live MCP scenarios in each baseline, candidate, restart and rollback
stage. ARM64 ran under QEMU; this is not native production deployment validation.

After publication, anonymous registry requests verified the release tag and index
bytes, both platform manifests/configurations, the owned source and exact commit
labels, retained upstream revision, original entrypoint and working directory.
Full digest-pinned Docker pulls passed for both platforms using an empty temporary
Docker configuration without saved registry credentials. The package is publicly
pullable; no visibility change was needed in this session. The machine-readable
consumer-side record is `bin/independence/discovery-publication-verification.json`.

Redistribution remains `owner-attested-pending-terms`, as disclosed in the embedded
notices and release-specific authorization record. The owner's permission text
and any additional required notices remain outstanding. No upstream licence has
been invented or marked as independently verified.

This is a discovery component release. It does not change the governance
application's default, enable agents, replace a running container or modify data.
The separate application-default PR and deployment validation remain pending.
The earlier local-only candidates in [LOCAL_REVIEW.md](LOCAL_REVIEW.md) have
different identities and are not the published images above.
