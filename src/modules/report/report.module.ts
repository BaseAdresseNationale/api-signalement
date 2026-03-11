import { Module, forwardRef } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AlertModule } from '../alert/alert.module';
import { SignalementModule } from '../signalement/signalement.module';

@Module({
  imports: [forwardRef(() => AlertModule), forwardRef(() => SignalementModule)],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
