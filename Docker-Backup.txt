# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
# Copy package files
COPY package*.json ./
# Install dependencies (remove package-lock.json to avoid npm v10 multi-arch lock bugs with rollup binaries)
RUN rm -f package-lock.json && npm install
# Copy source code
COPY . .
# Build frontend
RUN npx vite build

# ---- Stage 2: Production ----
FROM node:20-alpine
WORKDIR /app
# Install runtime dependencies for native modules (needed for better-sqlite3 rebuild)
RUN apk add --no-cache python3 make g++
# Copy package.json from builder
COPY --from=builder /app/package*.json ./
# Install production dependencies only (rebuilds native modules)
RUN rm -f package-lock.json && npm install --omit=dev
# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
# Expose port
EXPOSE 3000
CMD ["node", "server.js"]
