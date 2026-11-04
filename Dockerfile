# Etapa 1: dependencias de producción y código.
FROM node:24-alpine AS build
WORKDIR /app

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de npm ci.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# Etapa 2: imagen final.
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8081
# Los secretos (JWT_SECRET, MONGO_URL) se cargan al ejecutar, nunca en la imagen.

COPY --chown=node:node --from=build /app ./

# Las portadas subidas se guardan acá: la carpeta no viaja en la imagen (.dockerignore).
RUN mkdir -p src/public/img && chown node:node src/public/img

# El proceso corre sin privilegios de root.
USER node

EXPOSE 8081

# node directo y no npm start: así el proceso recibe la señal de apagado.
CMD ["node", "src/app.js"]
