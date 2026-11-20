# FragAI MCP search and discovery

Phase 4.3 local candidate for replacing the platform's discovery system server.
It imports exactly obot-mcp-server v0.2.0, revision
`5051acefdceb073c32ea4ca78683d3922aea643b`, with the original Python dependency
lock. It does not upgrade FastMCP or change any tool implementation.

**Owner-attested publication; upstream terms remain pending.** The owner stated
that redistribution permission exists and explicitly instructed publication
before supplying its terms. That release-specific instruction is recorded in
`PUBLICATION_AUTHORIZATION.md`, hashed in the source lock and included in the
image. The release guard checks that it covers the exact candidate version.
It does not mark the upstream permission as received or independently verified,
and this package does not assign a new open-source licence to upstream source.

## Preserved contract

- Python 3.13.13, FastMCP 2.14.4 and MCP SDK 1.25.0; all application dependencies
  remain selected by the original `uv.lock`.
- `python main.py`, working directory `/app`, port 8080, `/mcp` streamable HTTP
  and `/healthz`; the original runtime user is retained for parity.
- `OBOT_URL` remains the API base setting. Each incoming request forwards its
  own Authorization header. No platform credential is embedded in the image.
- All four `obot_` tool names, input/output schemas, result/status fields,
  connected-server filtering, ranked search, configuration elicitation and
  OAuth metadata are retained. These identifiers are compatibility interfaces,
  not references to external Obot services.
- Builds use digest-pinned public Python/uv inputs and locked PyPI packages.
  They do not clone an Obot repository or inherit an Obot container image.
- No database, customer data, agent runtime, model provider or application
  feature flag is changed by this package.

## Build and test locally

From the Providers repository root, with Docker and Node available:

```powershell
./tools/build-independent-discovery.ps1 -Platform linux/amd64
./tools/build-independent-discovery.ps1 -Platform linux/arm64
```

ARM64 requires a native ARM64 engine or QEMU/binfmt support. The candidate tags
are `fragai-mcp-server:phase4-amd64` and `fragai-mcp-server:phase4-arm64`.
If Docker Desktop's default build network cannot resolve PyPI, the helper also
accepts `-BuildNetwork host`. The local review builds used this option after
retaining the failed default-network attempt. Cache entries remain validated
against the original wheel hashes; dependency versions are not relaxed.

The verifier compares launch metadata and installed Python packages, runs the
existing upstream unit suite against both actual runtime images, and exercises
real MCP clients against baseline, candidate, restarted candidate and rollback.
An isolated API fixture covers discovery, connected personal/shared inventory,
configuration acceptance/decline/cancel, hostname/template URLs, launch errors,
OAuth URL elicitation/completion, and concurrent per-user authorization. Tests
use an internal Docker network with no published ports or customer-data mounts.
Only containers/networks carrying the current run's ownership label are removed.
Reports are written under the ignored `bin/independence` directory.

Synthetic API/OAuth fixtures establish protocol compatibility. They do not prove
live external OAuth, full Nanobot chat, production Kubernetes networking, or the
security of every inherited dependency. The baseline's existing OAuth timeout
and error-handling behavior remains unchanged in this packaging-only candidate.
The retained client can log forwarded authorization at DEBUG level; do not
enable credential-bearing debug logs in production. Redacting that log and
hardening the inherited OAuth timeout behavior require a separate reviewed change.

## Publication and consumer cutover

The [local review results](LOCAL_REVIEW.md) record passing architecture checks,
local image identities and the remaining release limits.

Intended package:
`ghcr.io/harshdeshmukh26/fragai-mcp-server:v0.2.0-fragai.4.3-rc.1`.

Before publication: preserve the source notices and recorded authority,
pass `--publication`, review and commit the source branch, and run both
architecture compatibility gates. Publish only the exact tested images; record
their source commit and immutable multi-architecture digest. Verify anonymous
pulls on both architectures after making the package public.

Only then open a separate governance-platform PR selecting that digest through
`MCPServerSearchImage`. Preserve explicit overrides, the existing system server
ID and its feature gating. Keep the pinned original image for rollback.
