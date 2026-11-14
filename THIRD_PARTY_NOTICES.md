# Provider source provenance

This repository maintains source snapshots for FragAI provider images.

| Directory | Original source | Revision | License |
| --- | --- | --- | --- |
| `community` | https://github.com/obot-platform/providers | `917e4371277499e8e88548c67243a8e1d5c45842` (`v0.26.0`) | Apache-2.0; see `community/LICENSE` |
| `enterprise` | https://github.com/obot-platform/enterprise-providers | `5784972cd5139792fef090ec1b360a4ce386441d` (`v0.26.0`) | MIT; see `enterprise/LICENSE` |
| `encryption/aws` | https://github.com/obot-platform/aws-encryption-provider | `0519a349ef3bbf54236067049e4280a9ffc32e6c` | Apache-2.0; see `encryption/aws/LICENSE` |
| `encryption/azure` | https://github.com/obot-platform/kubernetes-kms | `6869e68e538e24080f8ec8beba9af1620d8807d3` | Microsoft MIT; see `encryption/azure/LICENSE` |
| `encryption/gcp` | https://github.com/obot-platform/k8s-cloudkms-plugin | `35cb6822386dddc9fb4b624d5eccf4c132eae0d3` | Apache-2.0; see `encryption/gcp/LICENSE` |

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
an independent encryption image because it clones upstream HEAD. The root
`encryption-bins` target uses only the imported `encryption/` source trees and
does not invoke that historical script. It preserves the installed binary
names, build entry points, static build flags, and version metadata keys.
