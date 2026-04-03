import { Module } from '@nestjs/common';
import { ProConnectController } from './proconnect.controller';
import { ProConnectService } from './proconnect.service';
import { SourceModule } from '../source/source.module';
import { InseeService } from './insee.service';

@Module({
  imports: [SourceModule],
  controllers: [ProConnectController],
  providers: [ProConnectService, InseeService],
})
export class ProConnectModule {}
