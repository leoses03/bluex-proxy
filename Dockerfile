# Usa imagen oficial de Node con Chromium incluido (ideal para Puppeteer)
FROM ghcr.io/puppeteer/puppeteer:21.3.0

# Establece el directorio de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala dependencias
RUN npm install --omit=dev

# Copia el resto del código
COPY . .

# Define variables de entorno
ENV PORT=3000 \
    NODE_ENV=production

# Expone el puerto
EXPOSE 3000

# Inicia la aplicación
CMD ["node", "server.js"]
