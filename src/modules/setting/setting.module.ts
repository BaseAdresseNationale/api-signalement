import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './setting.entity';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';
import { ApiDepotModule } from '../api-depot/api-depot.module';
import { SourceModule } from '../source/source.module';
import { CommuneStatusCacheService } from './commune-status-cache.service';

@Module({
  imports: [
    forwardRef(() => TypeOrmModule.forFeature([Setting])),
    forwardRef(() => ApiDepotModule),
    forwardRef(() => SourceModule),
  ],
  controllers: [SettingController],
  providers: [SettingService, CommuneStatusCacheService],
  exports: [SettingService, CommuneStatusCacheService],
})
export class SettingModule {}
