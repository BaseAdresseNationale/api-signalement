import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { ClientService } from './client.service';
import { Client } from './client.schema';

@Injectable()
export class ClientMiddleware implements NestMiddleware {
  constructor(private clientService: ClientService) {}

  async use(
    req: Request & { client?: Client },
    res: Response,
    next: NextFunction,
  ) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const client: Client =
        await this.clientService.findOneOrFailByToken(token);
      req.client = client;
    }

    next();
  }
}
