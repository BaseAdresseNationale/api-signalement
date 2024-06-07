import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SourceService } from './source.service';
import { Source } from './source.schema';
import { SourceTypeEnum } from './source.types';
import { CreateSignalementDTO } from '../signalement/dto/signalement.dto';

@Injectable()
export class SourceMiddleware implements NestMiddleware {
  constructor(private sourceService: SourceService) {}

  async checkCaptcha(captchaToken) {
    const response = await fetch(`https://api.hcaptcha.com/siteverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `response=${captchaToken}&secret=${process.env.HCAPTCHA_SECRET_KEY}`,
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error('Invalid captcha token');
    }

    return json.success;
  }

  async use(
    req: Request & { source?: Source },
    res: Response,
    next: NextFunction,
  ) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const source: Source =
        await this.sourceService.findOneOrFailByToken(token);

      if (source.type === SourceTypeEnum.PUBLIC) {
        const captchaToken = (req.body as CreateSignalementDTO).author
          .captchaToken;
        if (!captchaToken) {
          throw new Error('Captcha token is required');
        }

        await this.checkCaptcha(captchaToken);
        delete req.body.author.captchaToken;
      }

      req.source = source;
    }

    next();
  }
}
