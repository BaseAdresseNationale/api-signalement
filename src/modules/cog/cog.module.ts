import { Module } from '@nestjs/common';
import { COGService } from './cog.service';

@Module({
  providers: [COGService],
  exports: [COGService],
})
export class COGModule {}
