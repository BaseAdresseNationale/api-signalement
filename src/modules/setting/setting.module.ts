import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './setting.entity';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';
import { ApiDepotModule } from '../api-depot/api-depot.module';
import { SourceModule } from '../source/source.module';

@Module({
  imports: [
    forwardRef(() => TypeOrmModule.forFeature([Setting])),
    ApiDepotModule,
    SourceModule,
  ],
  controllers: [SettingController],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
