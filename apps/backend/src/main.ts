import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as Sentry from '@sentry/node';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Sentry / GlitchTip — activé uniquement si DSN configuré
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }

  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['callback'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cinely API')
    .setDescription('API REST de l\'application de notes collaborative Cinely')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification, 2FA, reset mot de passe')
    .addTag('notes', 'CRUD notes, versioning, partage, recherche')
    .addTag('folders', 'Gestion des dossiers')
    .addTag('tags', 'Gestion des tags colorés')
    .addTag('settings', 'Profil utilisateur, sessions, 2FA setup')
    .addTag('health', 'État de santé de l\'application')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(3000);
}

bootstrap();
