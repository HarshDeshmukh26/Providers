# FragAI provider migration changes

## Phase 4.3 discovery publication completed (2026-11-20)

- Publish `ghcr.io/harshdeshmukh26/fragai-mcp-server:v0.2.0-fragai.4.3-rc.1`
  from `fd5c57ce0e0879410c796902b37f582dcbe4a5bd` after successful AMD64 and
  ARM64 compatibility gates and retesting the exact publication images.
- Record immutable index
  `sha256:9a1da88b0e38fa687d44fdda72622f0491967680dcc9190a9238a96e2ee12f00`,
  architecture digests and workflow `44780930778` in the component publication
  record. Anonymous manifests, provenance labels and full pulls pass on both
  architectures without saved registry credentials.
- Keep terms explicitly pending under the recorded owner attestation. The
  governance default, deployed application and customer data are unchanged.

## Phase 4.3 publication authorized by owner (2026-11-20)

- The owner, who previously stated they hold redistribution permission,
  explicitly directed publication before supplying its text. Preserve that
  release-specific instruction in `PUBLICATION_AUTHORIZATION.md`, hash it in the
  source lock and include it in the image. Terms remain marked as outstanding;
  the record is not represented as an upstream licence or independent verification.
- Extend the publication guard to accept that exact version's locked instruction.
  Unknown authority states, different release versions and changed/missing records
  remain blocked. Preserve all ten upstream source hashes and runtime interfaces.
- Rebuild and retest the actual publication images with the notice and source
  revision labels before publishing; keep the application default separate.

## Phase 4.3 MCP discovery local preparation (2026-11-20)

- Imported the exact discovery source revision
  `5051acefdceb073c32ea4ca78683d3922aea643b` with its original dependency lock
  and 86 existing unit tests. Added a digest-pinned independent Python/uv build.
- Added integrity verification, local build orchestration, live MCP protocol
  compatibility tests, ownership-checked cleanup and a separate release recipe.
  Original tool names, authentication forwarding, elicitation, API paths and
  launch configuration are retained; no discovery implementation is rewritten.
- Owner states that redistribution permission exists and will provide its terms.
  Local build/testing is authorized first. Publication remains blocked until the
  permission text and required notices are recorded; no new licence is assigned.
- Auth/model/encryption, STDIO and webhook packages, application defaults,
  customer data and the running application are unchanged.
- Local AMD64 and emulated ARM64 builds passed launch/Python/89-package parity,
  the 86 original tests against each runtime, and 26 real MCP scenarios in each
  baseline/candidate/restart/rollback stage. Cleanup passed with no production
  changes. See `runtime/mcp-discovery/LOCAL_REVIEW.md` for identities and limits.

## Phase 4.1 STDIO publication (2026-11-16)

- Added STDIO packaging, fixtures, source verification and the separate
  `runtime-stdio.yml` release workflow. Imported packaging from
  governance-platform revision `a7e7c81ac0318d713a0b24f7136c5bc887b83fc6`;
  retained all 126 upstream source-file hashes and original licences.
- Preserved the exact MMMCP v0.1.2 source, both runtime architectures, original
  tool versions and 60 system packages per architecture. No provider code,
  provider image default, existing release tag or application data is changed.
- Set the image's source association and source-lock publication repository to
  `HarshDeshmukh26/Providers`. The GHCR namespace remains `harshdeshmukh26`.
- Release-tag publishing runs the existing source tests and both complete
  baseline/protocol comparisons, exports the tested image artifacts, checks
  artifact identity and refuses to overwrite image tags. Public pulls and live
  application validation remain separate post-publication gates.

## Encryption source migration (release candidate in preparation)

- Imported 181 files from the exact AWS, Azure, and GCP source revisions
  recorded in the installed v0.26.0 encryption bundle. See `sources.lock.env`
  and `THIRD_PARTY_NOTICES.md` for revisions and component licenses.
- Added `encryption-bins` and `encryption-tests` Docker targets, local-source
  packaging, and a test runner. The new build never invokes the historical
  community script that clones upstream HEAD.
- Preserved all three executable names, build entry points/static linker
  options, CLI flags, KMS interfaces, and installed version metadata keys.
- Extended release CI to test encryption and build/publish its bundle for
  AMD64 and ARM64 alongside the existing auth/model bundles.
- Local AWS, Azure, and GCP unit/mock suites passed. Azure's separate
  cloud-backed client suite was not run; its upstream unit-test scope is
  preserved. AMD64 artifacts passed the application repository's offline
  source-version, executable, license, and CLI comparison with the retained
  application baseline.
- No imported provider implementation or module version was upgraded. Windows
  line-ending normalization is the only source import difference.
- Real cloud KMS and existing-ciphertext verification remain deployment gates.
  This source change does not replace an application deployment or data volume.

## v0.26.0-fragai.1-rc.1

- Imported pinned community and enterprise v0.26.0 snapshots at source commit
  `e941e6110501fa157b9e3acdc915be956c4e0780`.
- Added owned builds, source/license provenance, and release CI for both
  auth/model provider bundles. Preserved the installed manifest/path contracts.
