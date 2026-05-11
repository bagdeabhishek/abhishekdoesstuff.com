FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STATUS_UPSTREAM=http://192.168.1.61:9109/status

COPY package.json ./
COPY index.html styles.css status.js server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
