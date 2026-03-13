import { forwardRef, Module } from '@nestjs/common';
import { StatsController } from '../stats/stats.controller';
import { SignalementModule } from '../signalement/signalement.module';
import { AlertModule } from '../alert/alert.module';

@Module({
  imports: [forwardRef(() => SignalementModule), forwardRef(() => AlertModule)],
  controllers: [StatsController],
  providers: [],
  exports: [],
})
export class StatsModule {}
