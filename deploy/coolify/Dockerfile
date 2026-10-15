# Public preview of Open SaaS with the MPT payment processor, built from
# `template/app` on Coolify. Build context: repository root.
#
# Stage `wasp` runs `wasp build` (server sources in .wasp/out), and
# `client-build` the client build (static files in .wasp/out/web-app/build). The Wasp CLI ships a
# linux-arm64 binary for glibc only, hence the Debian image.

FROM node:24-bookworm AS wasp
ENV WASP_TELEMETRY_DISABLE=1
RUN npm install -g @wasp.sh/wasp-cli@0.26.0-rc.1
WORKDIR /app
COPY template/app/ ./
RUN rm -rf .wasp node_modules .env.server .env.client
RUN wasp install && wasp build

FROM wasp AS client-build
ARG REACT_APP_API_URL
# Paddle's client env vars are validated even when Paddle isn't the chosen
# processor; the values are never used.
RUN REACT_APP_API_URL="$REACT_APP_API_URL" \
    REACT_APP_PADDLE_CLIENT_TOKEN=unused \
    REACT_APP_PADDLE_SANDBOX_MODE=true \
    npx vite build

# Server: same steps as the Dockerfile `wasp build` generates in .wasp/out.
FROM node:24.14.1-alpine3.23 AS base
RUN apk --no-cache -U upgrade && apk add --no-cache openssl

FROM base AS server-builder
RUN apk add --no-cache python3 build-base libtool autoconf automake
WORKDIR /app
COPY --from=wasp /app/.wasp/out/src ./src
COPY --from=wasp /app/.wasp/out/package.json /app/.wasp/out/package-lock.json ./
COPY --from=wasp /app/.wasp/out/tsconfig.src.json ./
COPY --from=wasp /app/.wasp/out/server .wasp/out/server
COPY --from=wasp /app/.wasp/out/sdk .wasp/out/sdk
COPY --from=wasp /app/.wasp/out/types .wasp/out/types
COPY --from=wasp /app/.wasp/out/libs .wasp/out/libs
RUN npm install && cd .wasp/out/server && npm install
COPY --from=wasp /app/.wasp/out/db/schema.prisma .wasp/out/db/
RUN cd .wasp/out/server && npx prisma generate --schema='../db/schema.prisma'
RUN cd .wasp/out/server && npm run bundle
RUN mkdir -p ./.wasp/out/server/node_modules

FROM base AS server
RUN apk add --no-cache python3
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/out/server/node_modules .wasp/out/server/node_modules
COPY --from=server-builder /app/.wasp/out/server/bundle .wasp/out/server/bundle
COPY --from=server-builder /app/.wasp/out/server/package*.json .wasp/out/server/
COPY --from=wasp /app/.wasp/out/db/ .wasp/out/db/
EXPOSE 3001
WORKDIR /app/.wasp/out/server
ENTRYPOINT ["npm", "run", "start-production"]

# Client: prerendered pages plus `200.html` as the SPA fallback.
FROM nginx:1.27-alpine AS client
COPY deploy/coolify/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/.wasp/out/web-app/build /usr/share/nginx/html
EXPOSE 80
