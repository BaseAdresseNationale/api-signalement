import { Module, forwardRef } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientMiddleware } from './client.middleware';
import { Client } from './client.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [forwardRef(() => TypeOrmModule.forFeature([Client]))],
  controllers: [ClientController],
  providers: [ClientService, ClientMiddleware],
  exports: [ClientService, ClientMiddleware],
})
export class ClientModule {}
