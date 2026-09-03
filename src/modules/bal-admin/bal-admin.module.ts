import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BalAdminService } from './bal-admin.service';

@Module({
  imports: [ConfigModule],
  providers: [BalAdminService],
  exports: [BalAdminService],
})
export class BalAdminModule {}
