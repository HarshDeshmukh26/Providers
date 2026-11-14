#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# No host credentials are needed: these suites use fake/mock KMS services.
export AWS_EC2_METADATA_DISABLED=true
export GOTOOLCHAIN=local
for component in aws azure gcp; do
    (
        cd "encryption/$component"
        echo "Testing encryption/$component"
        case "$component" in
            azure)
                # Upstream's unit-test target excludes tests/client, which
                # requires a running cloud-backed /opt/azurekms.sock service.
                go test -mod=readonly -count=1 -timeout=10m ./cmd/... ./pkg/...
                ;;
            *) go test -mod=readonly -count=1 -timeout=10m ./... ;;
        esac
    )
done
