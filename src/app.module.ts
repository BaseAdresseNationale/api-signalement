import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalementModule } from './modules/signalement/signalement.module';
import { SourceModule } from './modules/source/source.module';
import { ClientModule } from './modules/client/client.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskModule } from './modules/task/task.module';
import typeorm from './config/typeorm';
import { SettingModule } from './modules/setting/setting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) =>
        configService.get('typeorm'),
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
    TaskModule,
    SettingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
