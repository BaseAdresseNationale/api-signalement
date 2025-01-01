import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MesAdressesAPIService } from './mes-adresses-api.service';

@Module({
  imports: [ConfigModule],
  providers: [MesAdressesAPIService],
  exports: [MesAdressesAPIService],
})
export class MesAdressesAPIModule {}
