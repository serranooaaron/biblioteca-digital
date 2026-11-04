FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=8081
ENV NODE_ENV=production

EXPOSE 8081

CMD ["npm", "start"]
