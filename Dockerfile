# Build stage
FROM node:20-alpine AS build

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY shared/ shared/
COPY server/ server/
COPY client/ client/

# Build in correct order: shared -> server -> client
RUN npm run build

# Seed the database
RUN npm run seed

# Production stage
FROM node:20-alpine

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for all workspaces (all needed for workspace resolution)
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts from build stage
COPY --from=build /app/shared/dist/ shared/dist/
COPY --from=build /app/server/dist/ server/dist/
COPY --from=build /app/client/dist/ client/dist/
COPY --from=build /app/server/data/ server/data/

# Copy card art directory structure (images added at runtime via volume or upload)
COPY card-art/ card-art/

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
