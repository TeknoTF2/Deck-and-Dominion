# Build stage
FROM node:20-alpine AS build

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
COPY server/data/ server/data/
RUN npm run seed

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=server --workspace=shared

# Copy built artifacts from build stage
COPY --from=build /app/shared/dist/ shared/dist/
COPY --from=build /app/server/dist/ server/dist/
COPY --from=build /app/client/dist/ client/dist/
COPY --from=build /app/server/data/ server/data/

# Copy card art directory structure (images added at runtime via volume or upload)
COPY card-art/ card-art/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
