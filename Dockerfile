# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install bun for fast installs/builds
RUN npm install -g bun

# Only copy manifests first for better caching
COPY package.json ./
COPY bun.lockb ./

# Install deps (allow lockfile update to include new deps)
RUN bun install

# Copy the rest of the app
COPY . .

# Build-time vars for Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

# Validate required build args to avoid blank pages at runtime
RUN test -n "$VITE_SUPABASE_URL" && \
    test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || \
    (echo "ERROR: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing. Pass --build-arg values in Cloud Build." && exit 1)

# Build static assets
RUN bun run build

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

# Lightweight static server
RUN npm install -g serve

# Copy build output only
COPY --from=builder /app/dist ./dist

# Cloud Run expects the app to listen on $PORT
ENV PORT=8080
EXPOSE 8080

# Start server (expand $PORT via shell)
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
