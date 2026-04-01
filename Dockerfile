# ============================
# STAGE 1: BUILD
# ============================
FROM node:22.16.0-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build TypeScript
RUN npm run build-ts


# ============================
# STAGE 2: PRODUCTION
# ============================
FROM node:22.16.0-alpine AS production

WORKDIR /app

# Create settings directory explicitly (safety)
RUN mkdir -p /app/src/settings

# Copy built output and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy injected JSON configs
COPY --from=builder /app/src/settings ./src/settings

# Install production dependencies only
RUN npm install --omit=dev --legacy-peer-deps

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
