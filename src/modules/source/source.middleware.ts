import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SourceService } from './source.service';
import { SourceTypeEnum } from './source.types';
import { CreateSignalementDTO } from '../signalement/dto/signalement.dto';
import { Source } from './source.entity';
import { FCVerification } from '../../utils/friendly-captcha.utils';

@Injectable()
export class SourceMiddleware implements NestMiddleware {
  constructor(private sourceService: SourceService) {}

  async validatePublicSource(
    req: Request & { source?: Source },
  ): Promise<Source> {
    const sourceId = req.query.sourceId;
    let source: Source;
    try {
      source = await this.sourceService.findOneOrFail(sourceId as string);
    } catch (error) {
      throw new HttpException('Source not found', HttpStatus.NOT_FOUND);
    }
    if (source.type === SourceTypeEnum.PUBLIC) {
      const captchaToken = (req.body as CreateSignalementDTO).author
        .captchaToken;
      if (!captchaToken) {
        throw new HttpException(
          'Captcha token is required',
          HttpStatus.PRECONDITION_FAILED,
        );
      }

      const success = await FCVerification({
        sitekey: process.env.FRIENDLY_CAPTCHA_SITE_KEY,
        secret: process.env.FRIENDLY_CAPTCHA_SECRET,
        solution: captchaToken,
      });
      if (!success) {
        throw new HttpException('Invalid captcha', HttpStatus.UNAUTHORIZED);
      }
      delete req.body.author.captchaToken;

      return source;
    } else {
      throw new HttpException('Invalid source type', HttpStatus.BAD_REQUEST);
    }
  }

  async validatePrivateSource(
    req: Request & { source?: Source },
  ): Promise<Source> {
    const token = req.headers.authorization?.split(' ')[1];
    try {
      const source = await this.sourceService.findOneOrFailByToken(token);
      return source;
    } catch (error) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  async use(
    req: Request & { source?: Source },
    res: Response,
    next: NextFunction,
  ) {
    const token = req.headers.authorization?.split(' ')[1];
    let source: Source;
    if (token) {
      source = await this.validatePrivateSource(req);
    } else {
      source = await this.validatePublicSource(req);
    }

    req.source = source;

    next();
  }
}
