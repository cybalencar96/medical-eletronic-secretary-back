# Stage 1: Base image with Node.js 20 LTS
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# Stage 2: Dependencies installation
FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm ci

# Stage 3: Build TypeScript
FROM dependencies AS build
COPY . .
RUN npm run build

# Stage 4: Development image with hot-reload
FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 5: Production image (optimized)
FROM base AS production
ENV NODE_ENV=production
USER node
COPY --chown=node:node --from=dependencies /prod_node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
