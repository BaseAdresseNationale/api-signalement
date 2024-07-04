import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { ClientService } from './client.service';
import { ClientEntity } from './client.entity';

@Injectable()
export class ClientMiddleware implements NestMiddleware {
  constructor(private clientService: ClientService) {}

  async use(
    req: Request & { registeredClient?: ClientEntity },
    res: Response,
    next: NextFunction,
  ) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const client: ClientEntity =
        await this.clientService.findOneOrFailByToken(token);
      req.registeredClient = client;
    }

    next();
  }
}
