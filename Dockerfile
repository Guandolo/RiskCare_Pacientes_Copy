# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (use clean install if lockfile exists)
COPY package.json package-lock.json* ./
# Use npm install to avoid lockfile mismatch failures in CI
RUN npm install --no-audit --no-fund

# Copy the source code
COPY . .

# Build-time variables required by Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

# Generate .env.production for Vite using build args or fallback to .env in repo
RUN set -eux; \
  if [ -n "${VITE_SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then \
    echo "Using build args for Vite env"; \
    printf "VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n" "$VITE_SUPABASE_URL" "$VITE_SUPABASE_PUBLISHABLE_KEY" > .env.production; \
  elif [ -f .env ]; then \
    echo "Using .env to create .env.production"; \
    cp .env .env.production; \
  else \
    echo "ERROR: Provide build args VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or include a .env file"; \
    exit 1; \
  fi

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
