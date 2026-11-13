#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

for bundle in community enterprise; do
    for module in "$bundle"/*/go.mod; do
        (
            cd "$(dirname "$module")"
            echo "Testing $PWD"
            go test ./...
        )
    done
done
