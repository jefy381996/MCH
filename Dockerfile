# syntax=docker/dockerfile:1

# ---- build the website ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/index-core/package.json packages/index-core/
COPY packages/chain/package.json packages/chain/
COPY packages/price-engine/package.json packages/price-engine/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY . .
RUN npm run build -w @mch/web

# ---- runtime: Node runs the TypeScript sources directly, no compile step ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/index-core/package.json packages/index-core/
COPY packages/chain/package.json packages/chain/
COPY packages/price-engine/package.json packages/price-engine/
COPY packages/web/package.json packages/web/
RUN npm ci --omit=dev && npm cache clean --force
COPY packages/index-core/src packages/index-core/src
COPY packages/chain/src packages/chain/src
COPY packages/chain/scripts packages/chain/scripts
COPY packages/price-engine/src packages/price-engine/src
COPY contracts/plutus.json contracts/plutus.json
COPY config config
COPY deployments deployments
COPY --from=build /app/packages/web/dist packages/web/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# The oracle submitter uses the same image:
#   docker run ... node packages/chain/scripts/submitter.ts
CMD ["node", "packages/price-engine/src/main.ts"]
