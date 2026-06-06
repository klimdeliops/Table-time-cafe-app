FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN ./node_modules/.bin/prisma generate
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
