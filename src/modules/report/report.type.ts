import { AlertTypeEnum } from '../alert/alert.types';
import { SignalementTypeEnum } from '../signalement/signalement.types';

export enum ReportKindEnum {
  ALERT = 'alert',
  SIGNALEMENT = 'signalement',
}

export const ReportTypeEnum = { ...AlertTypeEnum, ...SignalementTypeEnum };
export type ReportTypeEnum = AlertTypeEnum | SignalementTypeEnum;
