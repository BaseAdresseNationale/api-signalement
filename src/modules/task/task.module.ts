import { Module, forwardRef } from '@nestjs/common';
import { SignalementModule } from '../signalement/signalement.module';
import { TaskService } from './task.service';
import { MesAdressesAPIModule } from '../mes-adresses-api/mes-adresses-api.module';
import { DataGouvModule } from '../datagouv/datagouv.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    forwardRef(() => SignalementModule),
    MesAdressesAPIModule,
    DataGouvModule,
    ConfigModule,
  ],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
