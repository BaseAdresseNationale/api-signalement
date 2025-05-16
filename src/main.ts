import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('API Signalement')
    .setDescription("API permettant de signaler des problèmes d'adressage")
    .setVersion('1.0')
    .addServer(process.env.API_SIGNALEMENT_URL)
    .addBearerAuth(
      {
        description: `Please enter a valid source token`,
        name: 'Authorization',
        type: 'http',
        in: 'Header',
      },
      'source-token',
    )
    .addBearerAuth(
      {
        description: `Please enter a valid client token`,
        name: 'Authorization',
        type: 'http',
        in: 'Header',
      },
      'client-token',
    )
    .addBearerAuth(
      {
        description: `Please enter a valid admin token`,
        name: 'Authorization',
        type: 'http',
        in: 'Header',
      },
      'admin-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 5005);
}
bootstrap();
