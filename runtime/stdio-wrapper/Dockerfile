ARG GO_IMAGE=golang:1.27.1-alpine@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414
ARG UV_IMAGE=ghcr.io/astral-sh/uv@sha256:e85be844203885286c60ffad8a858d48afb6c5a5c237ca0e67f12e74b8f174b1

FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS source
WORKDIR /src
ENV GOTOOLCHAIN=local
COPY source/mmmcp/go.mod source/mmmcp/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY source/mmmcp/ ./

FROM source AS source-tests
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go test -count=1 ./...

FROM source AS source-build
ARG TARGETOS=linux
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o /out/mmmcp ./cmd/mmmcp

FROM ${UV_IMAGE} AS uv-bin

FROM ${GO_IMAGE} AS locked-os
ARG TARGETARCH
COPY packages/${TARGETARCH}.* /locks/
COPY prepare-rootfs.sh /prepare-rootfs.sh
RUN --mount=type=cache,id=fragai-stdio-apks-${TARGETARCH},target=/apks \
    /bin/sh /prepare-rootfs.sh

FROM scratch AS runtime
COPY --from=locked-os /rootfs/ /
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
USER root
RUN addgroup -S -g 1000 mmmcp && \
    adduser -S -D -H -u 1000 -G mmmcp mmmcp && \
    install -d -o mmmcp -g mmmcp -m 0700 /var/lib/mmmcp
ENV XDG_DATA_HOME=/var/lib
WORKDIR /var/lib/mmmcp
VOLUME ["/var/lib/mmmcp"]
EXPOSE 8080

# Preserve the upstream Node/Python toolchain and npm dependency overrides.
RUN npm install -g npm@12.0.2 && \
    npm_root="$(npm root -g)" && \
    npm pkg delete devDependencies --prefix "${npm_root}/npm" && \
    npm install --prefix "${npm_root}/npm" --no-save --omit=dev \
        --ignore-scripts --no-audit --no-fund \
        brace-expansion@5.0.9 ip-address@10.3.1 tar@7.5.21 undici@6.28.0 && \
    npm cache clean --force && \
    mkdir -p /home/mmmcp && \
    chown -R mmmcp:mmmcp /home/mmmcp
COPY --from=uv-bin /uv /uvx /usr/local/bin/
COPY --from=source-build --chmod=0755 /out/mmmcp /usr/local/bin/mmmcp
COPY source/mmmcp/LICENSE /licenses/mmmcp-LICENSE
COPY source/mcp-images/LICENSE /licenses/mcp-images-LICENSE
COPY sources.lock.json THIRD_PARTY_NOTICES.md /licenses/
COPY packages/ /licenses/runtime-packages/

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
USER mmmcp
ENV PATH="/home/mmmcp/.local/bin:$PATH"
LABEL org.opencontainers.image.title="FragAI STDIO wrapper" \
      org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.licenses="Apache-2.0 AND MIT" \
      ai.fragai.mmmcp.revision="0ca1165038ba1569c4a6bf9c5cc300d4185de189" \
      ai.fragai.mcp-images.revision="557dc93904933e9874ba5489c9b2e7c6adb8dcac"
ENTRYPOINT ["mmmcp"]
CMD ["--help"]
