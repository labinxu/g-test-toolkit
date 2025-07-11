import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { fastifyStatic } from '@fastify/static';
import { fastifyCookie } from '@fastify/cookie';
//import { fastifySession } from '@fastify/session';
import fastifyCsrf from '@fastify/csrf-protection';
//
dotenv.config();
async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    bodyLimit: 1024 * 1024,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'public'), // 静态文件目录
    prefix: '/public/', // 访问路径前缀
  });

  await app.register(fastifyCookie, {
    secret:
      process.env.COOKIE_SECRET ||
      '36f35c47625d65f8f8fbf1545e5da6617be0704103267b52b842fa7f5695748f', // 用于签名 cookie
    parseOptions: {},
  });
  await app.register(fastifyCsrf, {
    cookieKey: '_csrf',
    cookieOpts: { signed: true },
  });
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allow both origins
    credentials: true,
    //allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const options = new DocumentBuilder()
    .setTitle('G-TOOLKIT API document')
    .setDescription('Doggy api...')
    .setVersion('1.0')
    .addServer('http://127.0.0.1:3001', 'Local environment')
    .addTag('G-TOOLKIT API TABLE')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3001);
}

bootstrap();
