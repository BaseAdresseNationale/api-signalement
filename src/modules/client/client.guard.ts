import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClientEntity } from './client.entity';

@Injectable()
export class ClientGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req: Request & { registeredClient?: ClientEntity } =
      context.getArgByIndex(0);

    return Boolean(req.registeredClient);
  }
}
