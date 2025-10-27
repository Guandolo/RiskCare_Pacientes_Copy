# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (use clean install if lockfile exists)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the source code
COPY . .

# Build-time variables required by Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

# Fail early if required vars are missing to avoid blank page deployments
RUN test -n "$VITE_SUPABASE_URL" -a -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || \
    (echo "ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Pass --build-arg values in your Cloud Build/CI." && exit 1)

# Build static assets
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

# Lightweight static server
RUN npm install -g serve@14

# Copy only the build output
COPY --from=builder /app/dist ./dist

# Cloud Run provides the port in $PORT (default to 8080)
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]

