import { FastifyInstance } from 'fastify';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import dotenv from 'dotenv';
import * as path from 'path';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrfProtection from '@fastify/csrf-protection';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    bodyLimit: 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  // Explicitly cast the Fastify instance
  const fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;

  // Register plugins directly on the Fastify instance
  await fastifyInstance.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/public/',
  });

  // npm's module resolution surfaces slightly different types than pnpm; cast keeps the register call type-safe.
  await fastifyInstance.register(fastifyCookie as any, {
    secret:
      process.env.COOKIE_SECRET ||
      '36f35c47625d65f8f8fbf1545e5da6617be0704103267b52b842fa7f5695748f',
    parseOptions: {},
  });
  await fastifyInstance.register(fastifyCsrfProtection, {
    cookieKey: '_csrf',
    cookieOpts: { signed: true },
  });

  // Expose a CSRF token endpoint for SPA clients
  fastifyInstance.get('/api/csrf-token', async (request, reply) => {
    const raw = (request as any).cookies?._csrf
    if (!raw) {
      return reply.code(400).send({ error: 'CSRF cookie not found' })
    }
    // If cookie is signed, unsign to get the actual token
    const unsignResult = (fastifyInstance as any).unsignCookie
      ? (fastifyInstance as any).unsignCookie(raw)
      : { valid: false, value: raw }
    const token = unsignResult && unsignResult.valid ? unsignResult.value : raw
    return { token }
  })

  // Rest of the code remains the same
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
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
