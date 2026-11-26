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

## Go dependencies used by the provider images

The provider build uses the following module copies from `third_party/go`.
Each copy matches the original module and `go.mod` checksums. The lock there
records the exact versions, source revisions, licences and source tree hashes.

| Directory under `third_party/go` | Source revision | Licence |
| --- | --- | --- |
| `chat-completion-client` | `88dd50945c18205ee3300ebdaa787eaa94fa009d` | Apache-2.0 |
| `auth-providers-common` | `9ab827189ee645232a18d13c09143eae10a879c3` | Apache-2.0 |
| `openai-model-provider` | `d90e9d6df0eb3545e455c81856e2d615466c252a` | Apache-2.0 |
| `oauth2-proxy` | `5704f042a6ff237d162cb420b8281c5202f1d7c6` | MIT |

The community OpenAI and auth helpers already used by other providers stay in
place. Gemini and enterprise auth use the separate revisions recorded above.
The root build copies their dependency licence texts and lock into the provider
images. Module paths, binary entry points and configuration keys stay compatible.

The imported community encryption packager is retained as source history.
The root
`encryption-bins` target uses only the imported `encryption/` source trees and
preserves the installed binary names, build entry points, static build flags,
and version metadata keys.

## HTTP webhook converter

`runtime/http-webhook-converter/source/mcp-images` contains six exact source
files from `obot-platform/mcp-images` v0.26.0, revision
`557dc93904933e9874ba5489c9b2e7c6adb8dcac`, under Apache-2.0. The component
retains the original license, package manifests and source-file hashes. Its
own notices explain the pinned official Node/Alpine input and npm dependencies.
Protocol names and the existing signature header are preserved for compatibility.
