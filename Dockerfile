# syntax=docker/dockerfile:1
ARG BUILD_IMAGE=cgr.dev/chainguard/wolfi-base
FROM --platform=$BUILDPLATFORM ${BUILD_IMAGE} AS base
RUN apk add --no-cache bash go-1.27 make git ca-certificates upx
ENV GOPROXY=https://proxy.golang.org \
    GONOPROXY=github.com/obot-platform,github.com/HarshDeshmukh26 \
    GOVCS=*:off
COPY sources.lock.env /sources.lock.env
COPY --chmod=0755 scripts/package.sh /usr/local/bin/package-fragai-providers

FROM base AS community-build
ARG TARGETOS
ARG TARGETARCH
ARG COMPRESS_BINARIES=true
COPY third_party/go/ /obot-providers/third_party/go/
COPY community/ /obot-providers/providers/
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/go/pkg/mod \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    package-fragai-providers community

FROM base AS enterprise-build
ARG TARGETOS
ARG TARGETARCH
ARG COMPRESS_BINARIES=true
COPY third_party/go/ /obot-providers/third_party/go/
COPY enterprise/ /obot-providers/enterprise-providers/
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/go/pkg/mod \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    package-fragai-providers enterprise

FROM base AS tests
ENV CGO_ENABLED=0
COPY third_party/go/ /source/third_party/go/
COPY community/ /source/community/
COPY enterprise/ /source/enterprise/
COPY scripts/test.sh /source/scripts/test.sh
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/go/pkg/mod \
    bash /source/scripts/test.sh

FROM base AS encryption-build
ARG TARGETOS
ARG TARGETARCH
COPY encryption/ /source/encryption/
COPY scripts/package-encryption.sh /source/scripts/package-encryption.sh
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/go/pkg/mod \
    CGO_ENABLED=0 GOTOOLCHAIN=local GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    bash /source/scripts/package-encryption.sh

FROM base AS encryption-tests
ENV CGO_ENABLED=0
COPY encryption/ /source/encryption/
COPY scripts/test-encryption.sh /source/scripts/test-encryption.sh
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/go/pkg/mod \
    bash /source/scripts/test-encryption.sh

FROM scratch AS providers
ARG BUILD_REVISION=uncommitted
LABEL org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.revision=${BUILD_REVISION} \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.title="FragAI providers"
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /obot-providers/providers
COPY --from=community-build /package/ /

FROM scratch AS enterprise-providers
ARG BUILD_REVISION=uncommitted
LABEL org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.revision=${BUILD_REVISION} \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="FragAI enterprise providers"
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /obot-providers/enterprise-providers
COPY --from=enterprise-build /package/ /

FROM scratch AS encryption-bins
ARG BUILD_REVISION=uncommitted
LABEL org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.revision=${BUILD_REVISION} \
      org.opencontainers.image.licenses="Apache-2.0 AND MIT" \
      org.opencontainers.image.title="FragAI encryption providers"
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /obot-providers
COPY --from=encryption-build /package/ /
