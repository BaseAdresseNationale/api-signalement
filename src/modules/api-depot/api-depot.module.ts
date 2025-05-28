import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { ApiDepotService } from './api-depot.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        baseURL: configService.get('API_DEPOT_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ApiDepotService, Logger],
  exports: [ApiDepotService],
})
export class ApiDepotModule {}
