# Base image with Node.js 20
FROM node:20-slim

# Install system dependencies including Python (required by Modal)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (or bun if you prefer)
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json* pnpm-lock.yaml* bun.lockb* ./

# Install dependencies
# If bun.lockb exists, we might need bun, but pnpm import or just npm install usually works if package-lock is present. 
# As this repo has bun.lockb, let's try to use bun if possible or fallback to standard npm/pnpm.
# For simplicity and robustness across environments, we can stick to pnpm/npm if package-lock exists.
# The repo has package-lock.json, so npm/pnpm is safe.
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Expose Vite default port
EXPOSE 5173

# Default command (can be overridden by the Sandbox Manager)
CMD ["pnpm", "run", "dev", "--host"]
