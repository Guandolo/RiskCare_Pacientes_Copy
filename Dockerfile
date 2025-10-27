# Use Node.js 20 as the base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install bun globally
RUN npm install -g bun

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies
RUN bun install

# Copy application files
COPY . .

# Build the application
RUN bun run build

# Use a lightweight production server
RUN npm install -g serve

# Set environment variable for port
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server
CMD serve -s dist -l $PORT