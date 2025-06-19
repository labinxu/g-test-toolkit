import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule,DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config()
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const options = new DocumentBuilder()
    .setTitle('G-TOOLKIT API document')
    .setDescription('Doggy api...')
    .setVersion('1.0')
    .addServer('http://127.0.0.1:3000', 'Local environment')
    .addTag('G-TOOLKIT API TABLE')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform query params to DTO types
      whitelist: true, // Strip unknown properties
    }),
  );
  await app.listen(3000);
}
bootstrap();
