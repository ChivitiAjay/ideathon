# Multi-Stage Production Dockerfile for Google Cloud Run
# Base Image
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies Stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Security: Run as non-root user
USER node

# Copy application files and node_modules
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node ai-studio-instructions ./ai-studio-instructions
COPY --chown=node:node firestore.rules ./

# Expose standard Cloud Run HTTP Port
EXPOSE 8080

# Start Application
CMD ["node", "server/server.js"]
