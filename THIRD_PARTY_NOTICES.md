# Provider source provenance

This repository maintains source snapshots for FragAI provider images.

| Directory | Original source | Revision | License |
| --- | --- | --- | --- |
| `community` | https://github.com/obot-platform/providers | `917e4371277499e8e88548c67243a8e1d5c45842` (`v0.26.0`) | Apache-2.0; see `community/LICENSE` |
| `enterprise` | https://github.com/obot-platform/enterprise-providers | `5784972cd5139792fef090ec1b360a4ce386441d` (`v0.26.0`) | MIT; see `enterprise/LICENSE` |

Original source files and copyright notices are preserved. The root Dockerfile,
packaging script, and release workflow are FragAI's integration tooling. Module
dependencies retain their own licenses; each module's `go.mod` and `go.sum`
record its dependencies. The image source label identifies the maintained copy,
not a transfer of ownership of upstream copyrights.

These first-stage builds still fetch the pinned Go modules in the imported
source, including some Obot modules and the OAuth2 Proxy fork. Those inputs must
be mirrored or vendored in a later step before claiming complete build
independence. The imported community encryption packager is retained as source
history and is not invoked by the root Dockerfile; it must not be used to build
an allegedly independent encryption image because it clones upstream HEAD.
