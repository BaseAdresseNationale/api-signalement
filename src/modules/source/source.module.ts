import { Module } from '@nestjs/common';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Source, SourceSchema } from './source.schema';
import { SourceMiddleware } from './source.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Source.name, schema: SourceSchema }]),
  ],
  controllers: [SourceController],
  providers: [SourceService, SourceMiddleware],
  exports: [SourceService, SourceMiddleware],
})
export class SourceModule {}
