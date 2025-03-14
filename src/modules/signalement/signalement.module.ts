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
import { StatsController } from './stats.controller';
import { SignalementTilesService } from './tiles/signalement-tiles.service';

@Module({
  imports: [
    forwardRef(() => TypeOrmModule.forFeature([Signalement])),
    SourceModule,
    ClientModule,
  ],
  controllers: [SignalementController, StatsController],
  providers: [SignalementService, SignalementTilesService],
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
