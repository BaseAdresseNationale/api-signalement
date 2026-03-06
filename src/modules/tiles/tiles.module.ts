import { Module, forwardRef } from '@nestjs/common';
import { TilesController } from './tiles.controller';
import { TilesService } from './tiles.service';
import { AlertModule } from '../alert/alert.module';
import { SignalementModule } from '../signalement/signalement.module';

@Module({
  imports: [forwardRef(() => AlertModule), forwardRef(() => SignalementModule)],
  controllers: [TilesController],
  providers: [TilesService],
})
export class TilesModule {}
