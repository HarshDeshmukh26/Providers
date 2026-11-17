ARG NODE_IMAGE=node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
FROM ${NODE_IMAGE}

WORKDIR /app
COPY source/mcp-images/http-webhook-mcp-converter/package*.json ./
# Keep the installed graph fixed by the original lock, including its overrides.
RUN npm ci --no-audit --no-fund
COPY source/mcp-images/http-webhook-mcp-converter/server.js ./
COPY source/mcp-images/LICENSE /licenses/mcp-images-LICENSE
COPY sources.lock.json THIRD_PARTY_NOTICES.md /licenses/

LABEL org.opencontainers.image.title="FragAI HTTP webhook converter" \
      org.opencontainers.image.source="https://github.com/HarshDeshmukh26/Providers" \
      org.opencontainers.image.licenses="Apache-2.0" \
      ai.fragai.mcp-images.revision="557dc93904933e9874ba5489c9b2e7c6adb8dcac"

CMD ["node", "server.js"]
