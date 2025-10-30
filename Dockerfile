# Usa una imagen base de Node 18 con Chrome
FROM ghcr.io/puppeteer/puppeteer:21.3.0

WORKDIR /app
COPY . .
RUN npm install

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
