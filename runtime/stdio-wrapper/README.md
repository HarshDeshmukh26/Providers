# FragAI STDIO wrapper: Phase 4.1

This is a source build of the existing `v0.26.0` STDIO wrapper. It preserves
the MMMCP v0.1.2 executable and Node/NPX, Python/UVX tooling. It does not change
the main application's MMMCP library or any provider, credential, database,
API, or configuration identifier.

`source/mmmcp` is a complete, byte-exact snapshot at
`0ca1165038ba1569c4a6bf9c5cc300d4185de189`. `source/mcp-images` contains the
original wrapper Dockerfile, parent selectors and Apache licence at
`557dc93904933e9874ba5489c9b2e7c6adb8dcac`. MMMCP's own licence is MIT.
`sources.lock.json` records all 126 file hashes, container input digests and
the eight runtime package manifests.
The source's nested upstream workflows are inert records, not active root
workflows. Do not run their original publication commands.

The root Dockerfile builds the binary from this snapshot. Its only container
inputs are Go and Astral UV; it does not inherit an Obot image. The Go image
also supplies build-only tools for assembling an empty runtime filesystem.
Each architecture installs the original 60 Wolfi packages, with exact versions,
full APK payload SHA-256 hashes and original baseline package control checksums
under `packages/`. Both identities are checked before package scripts run.
These historical APK archives have no individual signature stream; the narrow
`--allow-untrusted` install accepts only the already verified local payloads,
with network resolution disabled. The runtime retains the original package
keys, repository setting and world file. This is hash-based verification of
the locked baseline, not a claim that individual APK signatures were verified.

Wolfi's public package mirrors, npm and the Go module proxy remain third-party
build inputs. Historical packages can disappear from those mirrors; a release
process should retain the verified payloads in an owner-controlled cache.
Npm transitive resolution is compared against the original full package tree;
the strict baseline comparison must pass before each candidate is accepted.
The publication workflow exports and publishes the exact tested images instead
of rebuilding them after their compatibility checks.

## Build and compare locally

From the application repository root, with Docker running:

```powershell
.\tools\build-independent-stdio.ps1 -Platform linux/amd64
.\tools\build-independent-stdio.ps1 -Platform linux/arm64
```

The helper verifies the source lock, runs the existing Linux source tests,
builds the selected architecture, pulls the retained baseline and compares
both images. ARM64 execution on an AMD64 host requires Docker emulation.
The verifier uses platform-specific image inspection; it was validated with
Docker Engine 29.2 and requires the corresponding `image inspect --platform`
support in the CLI and daemon.
It does not publish images or change the application default/deployment.

Individual commands:

```sh
node tools/verify-stdio-sources.mjs
docker build --target source-tests runtime/stdio-wrapper
docker build --platform linux/amd64 -t fragai-stdio-wrapper:phase4-amd64 runtime/stdio-wrapper
docker pull --platform linux/amd64 ghcr.io/obot-platform/mcp-images/stdio-wrapper@sha256:f6d4c18c4b860c421928b7bf2a279c502ff664c2a29ff7092cc8f2530da1139f
node tools/verify-stdio-wrapper.mjs --image fragai-stdio-wrapper:phase4-amd64 --platform linux/amd64
```

The comparison requires matching users, entrypoints, command flags, paths,
environment, ports, volumes, APK inventory and control checksums, repository
policy, Node/Python/tool versions, npm overrides and the full nested npm
dependency inventory. It uses offline local NPX/UVX packages to exercise MCP initialize,
tool discovery/calls, resources, prompts and explicit environment forwarding.
It checks that an unforwarded synthetic secret does not reach the subprocess.
For each language, it runs baseline → candidate → restart → baseline rollback
against the same disposable SQLite volume, checks retained state markers and
clean shutdown, then removes only its own labelled containers and volumes.
It never mounts the Docker socket, customer data, keys or the application volume.
Reports are written under ignored `bin/independence/phase-4-stdio-*.json`.

These are wrapper-level checks. They do not establish real catalogue package
compatibility, OAuth tenant behavior, production upgrade safety or a live
Kubernetes rollout. Existing source tests cover additional protocol and
subprocess lifecycle behavior; their scope is distinct from the image smoke test.

## Publication and default gate

The root `runtime-stdio.yml` workflow verifies tracked source bytes and runs
both architecture comparisons. PRs do not publish. Manual publication defaults
to off; an explicit `fragai-stdio-v*` release tag also requests publication.
That tag must exactly match `fragai-stdio-` followed by the candidate version
in `sources.lock.json`.
When explicitly enabled, it refuses existing release tags, checks the loaded
artifact IDs against the passing reports and publishes the tested images as
one multi-platform candidate. It does not change application defaults.

Before changing `pkg/mcp/manager.go`, retain the original image for rollback,
record the published digest, verify anonymous pulls for both architectures,
and test the Docker and Kubernetes launch contracts and applicable hosting
behavior. Keep the existing option/env names, listen arguments and data paths.
An authenticated push alone does not prove public deployment access.

This component is published by the Providers repository. The application
image and its deployment remain separate work in governance-platform.

The HTTP webhook converter, MCP discovery image and Nanobot agent are separate
review steps. MCP discovery still needs its redistribution terms clarified.
