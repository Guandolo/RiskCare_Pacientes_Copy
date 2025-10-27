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

# Install a simple server to serve the static files
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["serve", "-s", "dist", "-l", "8080"]