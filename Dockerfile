FROM node:24-alpine AS build

WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY astro.config.mjs tsconfig.json server.js ./
COPY src ./src
COPY content ./content
COPY public ./public
COPY scripts ./scripts
COPY data ./data
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STATUS_UPSTREAM=http://192.168.1.61:9109/status
ENV BIRDNET_UPSTREAM=http://192.168.1.91

COPY --from=build /app/server.js ./server.js
COPY --from=build /app/dist ./dist
COPY --from=build /app/build/manifest.json ./build/manifest.json
COPY --from=build /app/data/bird-art.json ./data/bird-art.json

EXPOSE 3000
CMD ["node", "server.js"]
