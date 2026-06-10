import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { SourceMiddleware } from './source.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Source } from './source.entity';

@Module({
  imports: [forwardRef(() => TypeOrmModule.forFeature([Source]))],
  controllers: [SourceController],
  providers: [SourceService, SourceMiddleware],
  exports: [SourceService, SourceMiddleware],
})
export class SourceModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SourceMiddleware)
      .forRoutes({ path: 'sources/:idSource', method: RequestMethod.PUT });
  }
}
