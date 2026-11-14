# FragAI provider migration changes

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
