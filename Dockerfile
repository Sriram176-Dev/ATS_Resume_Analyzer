# syntax=docker/dockerfile:1

# ---- 1. Build the React app -------------------------------------------------
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. Install production-only server dependencies -------------------------
FROM node:22-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. Runtime image: one process serves the API and the built web app -----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
RUN chown -R node:node /app
USER node
WORKDIR /app/server
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
