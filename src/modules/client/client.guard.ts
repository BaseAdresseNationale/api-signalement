import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Client } from './client.schema';

@Injectable()
export class ClientGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req: Request & { client?: Client } = context.getArgByIndex(0);

    return Boolean(req.client);
  }
}
