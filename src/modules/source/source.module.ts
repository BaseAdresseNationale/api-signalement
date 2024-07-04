import { Module, forwardRef } from '@nestjs/common';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { SourceMiddleware } from './source.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceEntity } from './source.entity';

@Module({
  imports: [forwardRef(() => TypeOrmModule.forFeature([SourceEntity]))],
  controllers: [SourceController],
  providers: [SourceService, SourceMiddleware],
  exports: [SourceService, SourceMiddleware],
})
export class SourceModule {}
