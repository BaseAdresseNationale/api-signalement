import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SourceEntity } from './source.entity';

@Injectable()
export class SourceGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req: Request & { source?: SourceEntity } = context.getArgByIndex(0);

    return Boolean(req.source);
  }
}
