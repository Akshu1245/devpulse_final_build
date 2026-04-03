# DevPulse Backend Dockerfile
FROM node:20-alpine AS base

# Install dependencies stage
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Set ownership
RUN chown -R app:nodejs /app
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
