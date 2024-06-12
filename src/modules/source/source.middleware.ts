import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
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
      throw new HttpException('Invalid captcha token', HttpStatus.UNAUTHORIZED);
    }

    return json.success;
  }

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

      await this.checkCaptcha(captchaToken);
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
