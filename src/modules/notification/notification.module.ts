import { Module, forwardRef } from '@nestjs/common';
import { SignalementModule } from '../signalement/signalement.module';
import { NotificationService } from './notification.service';
import { MesAdressesAPIModule } from '../mes-adresses-api/mes-adresses-api.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    forwardRef(() => SignalementModule),
    MesAdressesAPIModule,
    ConfigModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
