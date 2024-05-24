import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Client, ClientSchema } from './client.schema';
import { ClientMiddleware } from './client.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Client.name, schema: ClientSchema }]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        baseURL: configService.get('API_DEPOT_URL'),
        headers: {
          Authorization: `Token ${configService.get('API_DEPOT_ADMIN_TOKEN')}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ClientController],
  providers: [ClientService, ClientMiddleware],
  exports: [ClientService, ClientMiddleware],
})
export class ClientModule {}
