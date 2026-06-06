FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN ./node_modules/.bin/prisma generate
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node -e \"const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.restaurant.count().then(n=>{p.\$disconnect();process.exit(n>0?0:1)})\" || npm run seed; node dist/main"]
