import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalementModule } from './modules/signalement/signalement.module';
import { SourceModule } from './modules/source/source.module';
import { ClientModule } from './modules/client/client.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { entities } from './app.entities';
import { migrations } from './migrations';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('POSTGRES_URL'),
        synchronize: config.get('SYNCHRONIZE_DB') === 'true',
        keepConnectionAlive: true,
        schema: 'public',
        migrationsRun: true,
        migrations,
        entities,
      }),
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: config.get('SMTP_URL'),
        defaults: {
          from: config.get('SMTP_FROM'),
        },
        template: {
          dir: __dirname + '/email-templates',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    SignalementModule,
    SourceModule,
    ClientModule,
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
