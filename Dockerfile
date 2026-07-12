FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STATUS_UPSTREAM=http://192.168.1.61:9109/status

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html styles.css status.js server.js musings.js robots.txt sitemap.xml humans.txt og.png og.svg logo.jpg logo-transparent.png logo-512.webp favicon.ico favicon-48.png favicon-192.png apple-touch-icon.png ./
COPY assets ./assets
COPY notes ./notes
COPY content ./content

EXPOSE 3000
CMD ["node", "server.js"]
