import { Module, forwardRef } from '@nestjs/common';
import { TilesController } from './tiles.controller';
import { TilesService } from './tiles.service';
import { AlertModule } from '../alert/alert.module';
import { SignalementModule } from '../signalement/signalement.module';
import { ReportModule } from '../report/report.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [
    forwardRef(() => AlertModule),
    forwardRef(() => SignalementModule),
    forwardRef(() => ReportModule),
    forwardRef(() => SettingModule),
  ],
  controllers: [TilesController],
  providers: [TilesService],
})
export class TilesModule {}
