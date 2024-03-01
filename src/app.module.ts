import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SignalementModule } from './modules/signalement/signalement.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('MONGODB_URI'),
        // tls: true,
        // tlsCAFile: `${__dirname}/../${config.get('MONGODB_CERTIFICATE')}`,
        // authMechanism: 'PLAIN',
      }),
      inject: [ConfigService],
    }),
    SignalementModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
