import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SourceService } from './source.service';
import { Source } from './source.schema';

@Injectable()
export class SourceMiddleware implements NestMiddleware {
  constructor(private sourceService: SourceService) {}

  async use(
    req: Request & { source?: Source },
    res: Response,
    next: NextFunction,
  ) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const source: Source =
        await this.sourceService.findOneOrFailByToken(token);
      req.source = source;
    }

    next();
  }
}
