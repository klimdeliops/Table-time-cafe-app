import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const isProduction = process.env.NODE_ENV === 'production';

  const productionOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProduction && productionOrigins.length === 0) {
    console.error(
      '[CORS] FATAL: ALLOWED_ORIGINS is not set or is empty. ' +
      'The server cannot start in production without an explicit origin allowlist. ' +
      'Set ALLOWED_ORIGINS=https://yourdomain.com in your environment.',
    );
    process.exit(1);
  }

  const devOrigins = !isProduction
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173']
    : [];

  const allowedOrigins = [...productionOrigins, ...devOrigins];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}

bootstrap();
