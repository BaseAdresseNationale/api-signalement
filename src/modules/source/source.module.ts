import { Module, forwardRef } from '@nestjs/common';
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
export class SourceModule {}
