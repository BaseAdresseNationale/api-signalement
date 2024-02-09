import { Module } from '@nestjs/common';
import { SignalementController } from './signalement.controller';
import { SignalementService } from './signalement.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Signalement,
  SignalementSchema,
} from 'src/modules/signalement/schemas/signalement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Signalement.name, schema: SignalementSchema },
    ]),
  ],
  controllers: [SignalementController],
  providers: [SignalementService],
})
export class SignalementModule {}
