import { Client } from './modules/client/client.entity';
import { Source } from './modules/source/source.entity';
import { Report } from './modules/report/report.entity';
import { Signalement } from './modules/signalement/signalement.entity';
import { Setting } from './modules/setting/setting.entity';
import { Alert } from './modules/alert/alert.entity';

export const entities = [Client, Source, Report, Signalement, Setting, Alert];
