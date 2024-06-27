import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { SignalementController } from './signalement.controller';
import { SignalementService } from './signalement.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Signalement, SignalementSchema } from './schemas/signalement.schema';
import { SourceModule } from '../source/source.module';
import { SourceMiddleware } from '../source/source.middleware';
import { ClientModule } from '../client/client.module';
import { ClientMiddleware } from '../client/client.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Signalement.name, schema: SignalementSchema },
    ]),
    SourceModule,
    ClientModule,
  ],
  controllers: [SignalementController],
  providers: [SignalementService],
  exports: [SignalementService],
})
export class SignalementModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SourceMiddleware)
      .forRoutes({ path: 'signalements', method: RequestMethod.POST });

    consumer.apply(ClientMiddleware).forRoutes({
      path: 'signalements/:idSignalement',
      method: RequestMethod.PUT,
    });
  }
}
