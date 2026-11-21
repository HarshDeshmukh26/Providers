ARG PYTHON_IMAGE=python:3.13.13-slim@sha256:aa938a849bcb82dce8f49480f056ab82bf5c1c3ebc294f0430f37b6820e7f286
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.12.5@sha256:e85be844203885286c60ffad8a858d48afb6c5a5c237ca0e67f12e74b8f174b1
FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder
COPY --from=uv /uv /uvx /bin/
WORKDIR /app
COPY source/obot-mcp-server/pyproject.toml source/obot-mcp-server/uv.lock ./
RUN --mount=type=cache,id=fragai-discovery-uv,target=/root/.cache/uv,sharing=locked \
    UV_CONCURRENT_DOWNLOADS=4 uv sync --frozen --no-install-project --no-dev
COPY source/obot-mcp-server/main.py ./
COPY source/obot-mcp-server/obot_mcp/ ./obot_mcp/
RUN --mount=type=cache,id=fragai-discovery-uv,target=/root/.cache/uv,sharing=locked \
    UV_CONCURRENT_DOWNLOADS=4 uv sync --frozen --no-dev

FROM builder AS test
COPY source/obot-mcp-server/test_server.py ./
RUN /app/.venv/bin/python -m pytest test_server.py -q

FROM ${PYTHON_IMAGE} AS runtime
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/main.py /app/main.py
COPY --from=builder /app/obot_mcp /app/obot_mcp
COPY sources.lock.json THIRD_PARTY_NOTICES.md PUBLICATION_AUTHORIZATION.md /licenses/
ENV PATH="/app/.venv/bin:$PATH"
LABEL org.opencontainers.image.title="FragAI MCP discovery server" \
      org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.version="v0.2.0-fragai.4.3-rc.1" \
      ai.fragai.discovery.revision="5051acefdceb073c32ea4ca78683d3922aea643b" \
      ai.fragai.redistribution="owner-attested-terms-pending"
ENTRYPOINT ["python", "main.py"]
