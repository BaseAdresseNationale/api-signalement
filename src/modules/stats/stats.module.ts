import { forwardRef, Module } from '@nestjs/common';
import { StatsController } from '../stats/stats.controller';
import { SignalementModule } from '../signalement/signalement.module';
import { AlertModule } from '../alert/alert.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [
    forwardRef(() => SignalementModule),
    forwardRef(() => AlertModule),
    forwardRef(() => SettingModule),
  ],
  controllers: [StatsController],
  providers: [],
  exports: [],
})
export class StatsModule {}
