import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { SignalementController } from './signalement.controller';
import { SignalementService } from './signalement.service';
import { SourceModule } from '../source/source.module';
import { SourceMiddleware } from '../source/source.middleware';
import { ClientModule } from '../client/client.module';
import { ClientMiddleware } from '../client/client.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Signalement } from './signalement.entity';
import { SettingModule } from '../setting/setting.module';
import { ReportModule } from '../report/report.module';
import { BalAdminModule } from '../bal-admin/bal-admin.module';
import { PartenairePerimeterGuard } from '../../common/partenaire-perimeter.guard';

@Module({
  imports: [
    forwardRef(() => TypeOrmModule.forFeature([Signalement])),
    forwardRef(() => SourceModule),
    forwardRef(() => ClientModule),
    forwardRef(() => SettingModule),
    ReportModule,
    BalAdminModule,
  ],
  controllers: [SignalementController],
  providers: [SignalementService, PartenairePerimeterGuard],
  exports: [SignalementService],
})
export class SignalementModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SourceMiddleware)
      .forRoutes({ path: 'signalements', method: RequestMethod.POST });

    consumer.apply(ClientMiddleware).forRoutes(
      {
        path: 'signalements/:idSignalement',
        method: RequestMethod.GET,
      },
      {
        path: 'signalements/:idSignalement',
        method: RequestMethod.PUT,
      },
    );
  }
}
