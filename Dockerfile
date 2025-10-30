# 🧱 Imagen base: Node + Chromium (ideal para Puppeteer)
FROM ghcr.io/puppeteer/puppeteer:21.3.0

# 📂 Directorio de trabajo dentro del contenedor
WORKDIR /app

# 📦 Copiar archivos de dependencias primero
COPY package*.json ./

# 🚀 Instalar dependencias de producción (sin devDependencies)
RUN npm install --omit=dev

# 🧾 Copiar todo el código del proyecto
COPY . .

# ⚙️ Variables de entorno predeterminadas
ENV PORT=3000 \
    NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 🌐 Exponer el puerto donde corre la app
EXPOSE 3000

# 🧠 Healthcheck (verifica que el contenedor responda correctamente)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', res => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

# 🏁 Comando para iniciar la aplicación
CMD ["node", "server.js"]
