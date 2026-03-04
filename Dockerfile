FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

ENV API_PORT=10000
ENV SERVE_WEB_DIST=true
ENV WEB_DIST_DIR=apps/web/dist
EXPOSE 10000

CMD ["node", "apps/api/dist/index.js"]
