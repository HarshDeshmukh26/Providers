# FragAI STDIO wrapper third-party notices

This image builds MMMCP v0.1.2 from source and preserves the STDIO wrapper's
packaging at mcp-images v0.26.0. The original project names and import paths
remain for compatibility and attribution.

- MMMCP: <https://github.com/obot-platform/mmmcp>, revision
  `0ca1165038ba1569c4a6bf9c5cc300d4185de189`, MIT.
  Original licence: `source/mmmcp/LICENSE`, also `/licenses/mmmcp-LICENSE`
  in the image.
- MCP images: <https://github.com/obot-platform/mcp-images>, revision
  `557dc93904933e9874ba5489c9b2e7c6adb8dcac`, Apache-2.0.
  Original licence: `source/mcp-images/LICENSE`, also
  `/licenses/mcp-images-LICENSE` in the image.
- UV/UVX: Astral UV 0.12.5, distributed under MIT or Apache-2.0.
  <https://github.com/astral-sh/uv>. Its own copyright and licensing terms apply.
- Wolfi packages, Go modules, Node, npm and bundled dependencies retain their
  respective copyright and licensing terms. The unchanged Go module graph is
  recorded by `source/mmmcp/go.mod` and `go.sum`.

The source lock records imported file hashes, pinned container inputs and the
per-architecture manifests for the original 60 Wolfi packages. Their payload
hashes, package control checksums and package database identify the bundled
versions; these notices do not replace each dependency's own licence.
Nested upstream CI/release files are retained as source records; they do not
activate workflows in this repository or publish to their original destinations.
