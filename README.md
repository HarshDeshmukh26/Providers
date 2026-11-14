# FragAI Providers

Owned provider source and image builds for FragAI. The initial migration uses
the exact community and enterprise `v0.26.0` source snapshots. It preserves
provider IDs, manifest contents, configuration names, and executable paths.

## Build locally

Docker with BuildKit is required. Neither a cloud build server nor registry
credentials are needed to build these source snapshots locally.

```sh
docker build --target providers -t ghcr.io/harshdeshmukh26/fragai-providers:v0.26.0-fragai.1 .
docker build --target enterprise-providers -t ghcr.io/harshdeshmukh26/fragai-enterprise-providers:v0.26.0-fragai.1 .
docker build --target encryption-bins -t ghcr.io/harshdeshmukh26/fragai-encryption-bins:v0.26.0-fragai.1 .
```

For faster development builds, pass `--build-arg COMPRESS_BINARIES=false`.
The release default compresses and verifies the packaged binaries with UPX.
All targets include their source licenses and `sources.lock.env` provenance.
The encryption target builds the exact recorded AWS, Azure, and GCP snapshots
under `encryption/`, without cloning upstream repositories. It keeps the
installed executable names, CLI interfaces, and version metadata keys. Cloud
encryption binaries retain the upstream packager's uncompressed static build.

## Validate

With Go matching the modules' `go` directives installed, run:

```sh
bash scripts/test.sh
bash scripts/test-encryption.sh
```

The governance-platform migration tooling additionally compares provider
manifests and executable paths against its installed baseline. A successful
package build does not establish a successful live login, model request, or
cloud KMS operation; test those with the appropriate test accounts before
production cutover.

## Publish

The workflow builds all three image targets and runs provider tests. Version tags
matching `v*` publish versioned multi-architecture images only after tests pass.
Manual runs validate without publishing. Package publishing uses the
repository's scoped `GITHUB_TOKEN` with `packages: write`; no PAT is committed.

New GHCR packages can initially be private even when the source is public.
Set the image packages to public in GitHub package settings and verify an
anonymous pull before using them as public application defaults. Keep the
source repository's visibility unchanged unless the owner explicitly changes it.

## Consume in the application

The existing application Dockerfile already accepts image overrides:

```sh
docker build \
  --build-arg PROVIDERS_IMAGE=ghcr.io/harshdeshmukh26/fragai-providers:v0.26.0-fragai.1 \
  --build-arg ENTERPRISE_PROVIDERS_IMAGE=ghcr.io/harshdeshmukh26/fragai-enterprise-providers:v0.26.0-fragai.1 \
  --build-arg ENCRYPTION_BINS_IMAGE=ghcr.io/harshdeshmukh26/fragai-encryption-bins:v0.26.0-fragai.1 \
  -t fragai:provider-candidate .
```

Run that command from the application repository, after all three images are
published and accessible. Existing application defaults remain in place until
their migration gates have passed. Production should
record the tested image digests as well as the version tags.

## Remaining dependencies

This stage establishes owned provider source and packaging. It does not yet
remove the imported providers' external Obot Go modules. Runtime MCP/agent
images and the main application's Go dependencies
remain separate migration steps. See `THIRD_PARTY_NOTICES.md` for provenance
and the application repository's `docs/obot-independence-plan.md` for the plan.
