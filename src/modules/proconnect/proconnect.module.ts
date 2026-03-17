import { Module } from '@nestjs/common';
import { ProConnectController } from './proconnect.controller';
import { ProConnectService } from './proconnect.service';
import { SourceModule } from '../source/source.module';

@Module({
  imports: [SourceModule],
  controllers: [ProConnectController],
  providers: [ProConnectService],
})
export class ProConnectModule {}
