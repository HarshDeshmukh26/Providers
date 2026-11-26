#!/bin/bash
set -euo pipefail

source /sources.lock.env
kind=${1:?Specify community or enterprise}
case "$kind" in
    community)
        source_dir=/obot-providers/providers
        registry=providers
        envrc=providers
        revision=$COMMUNITY_SOURCE_REVISION
        ;;
    enterprise)
        source_dir=/obot-providers/enterprise-providers
        registry=enterprise-providers
        envrc=enterprise
        revision=$ENTERPRISE_SOURCE_REVISION
        ;;
    *) echo "Unknown provider bundle: $kind" >&2; exit 1 ;;
esac

cd "$source_dir"
# Invoke the pinned build script directly: source snapshots have no nested .git.
# Normalize only the build-container copy for Windows checkouts.
sed -i 's/\r$//' scripts/build.sh
bash scripts/build.sh

destination="/package/obot-providers/$registry"
mkdir -p "$destination" /package/etc/ssl/certs /package/tmp /package/licenses
chmod 1777 /package/tmp
cp /etc/ssl/certs/ca-certificates.crt /package/etc/ssl/certs/
cp LICENSE "/package/licenses/$kind-LICENSE"
cp /sources.lock.env /package/licenses/sources.lock.env
dependency_sources=/obot-providers/third_party/go
cp "$dependency_sources/sources.lock.json" /package/licenses/go-sources.lock.json
for module in "$dependency_sources"/*/LICENSE; do
    cp "$module" "/package/licenses/$(basename "$(dirname "$module")")-LICENSE"
done
cp -a auth-providers model-providers "$destination/"

for binary in */bin/obot-provider; do
    test -x "$binary"
    mkdir -p "$destination/$(dirname "$binary")"
    cp "$binary" "$destination/$binary"
done

case "${COMPRESS_BINARIES:-true}" in
    true)
        upx --best --lzma "$destination"/*/bin/obot-provider
        upx --test "$destination"/*/bin/obot-provider
        ;;
    false) ;;
    *) echo 'COMPRESS_BINARIES must be true or false' >&2; exit 1 ;;
esac

printf 'export OBOT_SERVER_PROVIDER_REGISTRIES="/obot-providers/%s"\nexport OBOT_SERVER_VERSIONS="github.com/HarshDeshmukh26/Providers/%s=%s"\n' \
    "$registry" "$kind" "$revision" \
    > "/package/obot-providers/.envrc.providers.$envrc"
