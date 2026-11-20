# Phase 4.3 local review results

Validated on 2026-11-20. These are local, unpublished discovery component images.
No governance application default, deployment or customer data was changed.
At this local review checkpoint, work was uncommitted on the separate
`fragai/mcp-discovery-phase4` branch. Publication preparation is recorded below.

| Architecture   | Local tag                        | Platform manifest                                                         |
| -------------- | -------------------------------- | ------------------------------------------------------------------------- |
| AMD64 (native) | `fragai-mcp-server:phase4-amd64` | `sha256:68ee8517c0c23079052fa0f9907162c0989ccdba550118caa27bb03b46fc53bc` |
| ARM64 (QEMU)   | `fragai-mcp-server:phase4-arm64` | `sha256:f30f972354600aa671370c31cde903f7966404e697037d484a14a075979e7f8f` |

Both architectures passed:

- Exact launch configuration, Python 3.13.13 and 89 installed Python package
  versions compared with the retained original image.
- All 86 upstream tests against both original and candidate runtimes.
- All 26 live MCP protocol scenarios against original, candidate, restarted
  candidate and original-image rollback: four passing stages per architecture.
- Embedded source provenance and original snapshot hashes.
- Preservation of unrelated applications and ownership-checked fixture cleanup,
  with zero cleanup errors and no published test ports or customer-data mounts.

The two final machine-readable reports are
`bin/independence/phase-4-discovery-amd64.json` and
`bin/independence/phase-4-discovery-arm64.json` in this checkout. Protocol details,
unit output and failed attempts are retained in the same ignored directory.
ARM64's final protocol run reuses the previously passed 86-test results only
after checking both actual image identities and the embedded source lock.

The default-network build first failed on PyPI DNS and a later AMD64 attempt
timed out downloading a wheel. Host build networking and a verified uv cache
allowed both source builds to finish without changing dependency versions.
Test infrastructure corrections covered the retained pre-filter limit behavior,
concurrent fixture exclusion, and slow ARM64 process/health readiness under
emulation. No upstream runtime source was changed to obtain these passes.

Source integrity, Node syntax/formatting, workflow YAML formatting, PowerShell
syntax and whitespace checks passed. Publication with pending terms was checked
and rejected. The release workflow was prepared locally, not pushed or dispatched.

Redistribution terms and required notices are pending, as requested by the
owner. Publication, public pulls, native deployment validation, live external
OAuth and the separate application-default PR remain subsequent gates. These
synthetic compatibility checks are not a production security certification.

## Subsequent publication instruction

The owner subsequently directed publication before providing the permission
text, relying on their earlier statement that they hold redistribution
permission. The release-specific record is included in the image and source
lock. Terms remain explicitly outstanding, rather than marked as reviewed.
The publication images will be rebuilt/retested with that metadata and the
owned repository commit label; the local image identities above remain the
historical pre-publication candidates.

Publication subsequently succeeded with fresh exact-image tests on both
architectures, followed by anonymous registry inspection and full Docker pulls.
See [PUBLICATION.md](PUBLICATION.md) for the distinct published identities,
release source commit, workflow and remaining application-default work.
