import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { SourceModule } from '../source/source.module';
import { SourceMiddleware } from '../source/source.middleware';
import { ClientModule } from '../client/client.module';
import { ClientMiddleware } from '../client/client.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingModule } from '../setting/setting.module';
import { Alert } from './alert.entity';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';

@Module({
  imports: [
    forwardRef(() => TypeOrmModule.forFeature([Alert])),
    forwardRef(() => SourceModule),
    forwardRef(() => ClientModule),
    forwardRef(() => SettingModule),
  ],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SourceMiddleware)
      .forRoutes({ path: 'alerts', method: RequestMethod.POST });

    consumer.apply(ClientMiddleware).forRoutes(
      {
        path: 'alerts/:idAlert',
        method: RequestMethod.GET,
      },
      {
        path: 'alerts/:idAlert',
        method: RequestMethod.PUT,
      },
    );
  }
}
