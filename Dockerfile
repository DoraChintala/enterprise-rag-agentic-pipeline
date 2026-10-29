# ---- Build stage ----
# Compiles TypeScript to JavaScript with dev dependencies available.
FROM node:20-alpine AS build
WORKDIR /app

# Install ALL deps (including dev) using the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Production deps stage ----
# A clean layer with only production dependencies (smaller final image).
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage ----
# Minimal image: prod deps + compiled JS + static UI. Runs as non-root.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public ./public
COPY package.json ./

# Run as the built-in non-root "node" user for security.
USER node

EXPOSE 3000

# Simple container healthcheck hitting the /health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
