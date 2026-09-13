FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package*.json ./
COPY --chown=node:node assets ./assets
USER node
CMD ["node", "dist/index.js"]
