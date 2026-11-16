#!/bin/sh
set -eu

case "$TARGETARCH" in
  amd64) apk_arch=x86_64 ;;
  arm64) apk_arch=aarch64 ;;
  *) echo "Unsupported runtime architecture: $TARGETARCH" >&2; exit 1 ;;
esac

mkdir -p /apks /rootfs
while read -r checksum package; do
  if [ -f "/apks/$package" ] && \
    printf '%s  %s\n' "$checksum" "/apks/$package" | sha256sum -c - >/dev/null 2>&1; then
    continue
  fi
  wget -q -O "/apks/$package" "https://apk.cgr.dev/chainguard/$apk_arch/$package" || \
    wget -q -O "/apks/$package" "https://packages.wolfi.dev/os/$apk_arch/$package"
  printf '%s  %s\n' "$checksum" "/apks/$package" | sha256sum -c -
done < "/locks/$TARGETARCH.sha256"

package_controls() {
  awk -F: '/^P:/ {name=$2} /^V:/ {version=$2} /^C:/ {checksum=$2} \
    /^$/ {if (name) print name " " version " " checksum; name=""; version=""; checksum=""} \
    END {if (name) print name " " version " " checksum}' | sort
}

# These historical archives have no individual signature stream. Authenticate
# every full payload with the reviewed SHA-256 lock, then compare control
# checksums with the immutable installed baseline BEFORE running any scripts.
apk --allow-untrusted index --output /package-index.tar.gz /apks/*.apk
tar -xOzf /package-index.tar.gz APKINDEX | package_controls > /actual.controls
diff -u "/locks/$TARGETARCH.controls" /actual.controls

# Install only the verified local archives into an empty runtime. This flag
# permits the already-verified unsigned archives; it does not relax hashes,
# package identity checks above, TLS verification, or the runtime's APK policy.
apk --root /rootfs --initdb --no-network --allow-untrusted \
  --repositories-file /dev/null add /apks/*.apk
package_controls < /rootfs/lib/apk/db/installed > /actual.controls
diff -u "/locks/$TARGETARCH.controls" /actual.controls
cp "/locks/$TARGETARCH.world" /rootfs/etc/apk/world
cp "/locks/$TARGETARCH.repositories" /rootfs/etc/apk/repositories
