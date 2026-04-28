import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataGouvService } from './datagouv.service';

@Module({
  imports: [ConfigModule],
  providers: [DataGouvService],
  exports: [DataGouvService],
})
export class DataGouvModule {}
