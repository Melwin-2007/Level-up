# Multi-stage Dockerfile for @mp/api
# Build context: repository root (.)
# Dockerfile path: apps/api/Dockerfile

FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

# Copy monorepo configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json apps/api/prisma ./apps/api/

# Install dependencies (frozen lockfile)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate Prisma client and compile TypeScript
RUN pnpm --filter @mp/api prisma:generate
RUN pnpm --filter @mp/api build

# Prune development dependencies for lean production container
RUN pnpm prune --prod

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Run as non-root user
USER node

# Copy runtime files from builder with correct ownership
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/src/main.js"]

