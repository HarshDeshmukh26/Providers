# FragAI HTTP webhook converter

Phase 4.2 owns the existing HTTP webhook-to-MCP adapter's build. The source is
an exact copy of mcp-images v0.26.0. Application adoption is tracked separately
and does not happen automatically when a package is published.

## Preserved contract

- `docker-entrypoint.sh`, `node server.js`, `/app`, the original runtime user,
  Node 20.20.2, npm 10.8.2 and the installed dependency inventories.
- `WEBHOOK_URL` (required), optional `WEBHOOK_SECRET`, and `PORT` (default 8099).
- Streamable HTTP at `/mcp`, the `fire-webhook` tool and its existing schemas,
  session initialization, GET/SSE and DELETE termination.
- JSON POST payloads and the optional HMAC-SHA256 `X-Obot-Signature-256`
  signature. The receiver remains responsible for verifying the signature.
- Every HTTP 2xx response accepts; other statuses or delivery failures reject.
  The HTTP response body is not parsed as a policy decision or mutated message.
  In particular, HTTP 200 with `{"accept":false}` still accepts, matching the
  retained implementation. The converter does not implement redaction.

The Node input is pinned by digest and does not inherit an Obot image. `npm ci`
installs the original integrity-locked dependency graph; inventory comparisons
must pass before accepting this packaging-command change. This first stage
does not upgrade Node, Alpine, dependencies or the implementation.

## Build and verify locally

From the repository root, with Docker running:

```powershell
.\tools\build-independent-webhook.ps1 -Platform linux/amd64
.\tools\build-independent-webhook.ps1 -Platform linux/arm64
```

ARM64 execution needs Docker's ARM emulation or a native ARM64 host. Tests use
temporary labelled containers, an HTTP receiver serving only synthetic data
and loopback-published ports. They do not mount the Docker socket or existing
application data. Inventory containers have networking disabled. Cleanup
checks ownership labels before deleting test resources.

The verifier compares the candidate against the retained immutable baseline,
including Node/npm, OS packages, all 94 installed dependency manifests,
application-file hashes and container launch settings. It checks signatures,
unsigned requests, success/error status codes, delivery errors, invalid input,
sessions, restart, changed URL/secret/port and rollback. Reports are written to
ignored `bin/independence/phase-4-webhook-<architecture>.json`.

## Source and publication

`sources.lock.json` records the original revision, six raw source file hashes,
official Node base digest and per-architecture baseline inventory hashes.
The original Apache-2.0 license and dependency notices remain in the source
and image. Existing protocol identifiers remain intact for compatibility.

Release source is intended for `HarshDeshmukh26/Providers`, following the
existing provider and STDIO packaging process. The dedicated workflow validates
both architectures. Publication requires an explicit matching `fragai-webhook-`
release tag or a manual publication request in that repository, and reruns
compatibility tests against the exact images it pushes. Ordinary pull requests
and validation-only runs do not publish.

The candidate reference is recorded in the lock. New packages must be verified
as anonymously pullable before any application-default change. Publication by
itself does not redeploy an application or complete application/backend parity.

The [release record](releases/v0.26.0-fragai.4.2-rc.1.md) contains the published
digest, source commit, successful workflow and verified anonymous pulls.
