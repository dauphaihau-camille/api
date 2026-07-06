import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class GithubOAuthGuard extends AuthGuard('github') {
  override getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const redirectTo = request.query.redirectTo;

    return {
      scope: ['user:email'],
      session: false,
      state: typeof redirectTo === 'string' ? redirectTo : undefined,
    };
  }
}
