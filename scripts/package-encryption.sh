#!/bin/bash
set -euo pipefail

source /sources.lock.env
mkdir -p /package/bin /package/obot-providers /package/licenses/encryption
mkdir -p /package/etc/ssl/certs /package/tmp
chmod 1777 /package/tmp
cp /etc/ssl/certs/ca-certificates.crt /package/etc/ssl/certs/
cp /sources.lock.env /package/licenses/sources.lock.env

for component in aws azure gcp; do
    (
        cd "/source/encryption/$component"
        main=cmd/server/main.go
        if [ "$component" = gcp ]; then
            main=cmd/k8s-cloudkms-plugin/main.go
        fi
        # Match the installed packager's entry points, static build, and flags.
        # Source is already imported at the locked revision: never clone HEAD.
        go build -mod=readonly -trimpath -ldflags='-s -w -buildid=' \
            -o "/package/bin/$component-encryption-provider" "$main"
        cp LICENSE "/package/licenses/encryption/$component-LICENSE"
    )
done

# Retain the existing version keys for consumers of installed build metadata.
# The owned image source/revision label records the maintained source commit.
printf 'export OBOT_SERVER_VERSIONS="github.com/obot-platform/aws-encryption-provider=%s,github.com/obot-platform/kubernetes-kms=%s,github.com/obot-platform/k8s-cloudkms-plugin=%s"\n' \
    "${AWS_ENCRYPTION_SOURCE_REVISION:0:7}" \
    "${AZURE_ENCRYPTION_SOURCE_REVISION:0:7}" \
    "${GCP_ENCRYPTION_SOURCE_REVISION:0:7}" \
    > /package/obot-providers/.envrc.providers.encryption-bins
