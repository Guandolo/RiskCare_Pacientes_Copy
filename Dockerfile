# Use an official Node.js runtime as the base image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies using bun
RUN bun install

# Copy the rest of the application code
COPY . .

# Build the application
RUN bun run build

# Install a production-grade server
RUN npm install -g @google/local-server

# Expose the port that Cloud Run will use
ENV PORT=8080
EXPOSE 8080

# Command to run the application with proper headers and configuration
CMD ["local-server", "dist", "--host", "0.0.0.0", "--port", "8080", "--cors"]