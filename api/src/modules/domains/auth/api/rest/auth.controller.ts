import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Req,
  Res,
  Post,
  Query,
  UseInterceptors,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Idempotent } from '../../../../../common/decorators/idempotent.decorator';
import { resolveOrThrow } from '../../../../../common/application/result';
import { parseDurationToMilliseconds } from '../../../../../libs/duration';
import type {
  AuthenticatedUser,
  OAuthIdentity,
} from '../../app/auth.types';
import { AuthenticateOAuthUseCase } from '../../app/use-cases/authenticate-oauth.use-case';
import { GetCurrentUserUseCase } from '../../app/use-cases/get-current-user.use-case';
import { LoginUseCase } from '../../app/use-cases/login.use-case';
import { LogoutUseCase } from '../../app/use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from '../../app/use-cases/request-password-reset.use-case';
import { RefreshSessionUseCase } from '../../app/use-cases/refresh-session.use-case';
import { ResetPasswordUseCase } from '../../app/use-cases/reset-password.use-case';
import { RegisterUseCase } from '../../app/use-cases/register.use-case';
import { StartEmailAuthUseCase } from '../../app/use-cases/start-email-auth.use-case';
import { VerifyEmailAuthUseCase } from '../../app/use-cases/verify-email-auth.use-case';
import { VerifyResetPasswordTokenUseCase } from '../../app/use-cases/verify-reset-password-token.use-case';
import { CurrentUser } from '../../../../../common/decorators/current-user.decorator';
import { GithubOAuthGuard } from '../guard/github-oauth.guard';
import { GoogleOAuthGuard } from '../guard/google-oauth.guard';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { PermissionsGuard } from '../guard/permissions.guard';
import { mapAuthAppErrorToHttpException } from './auth-error-mapper';
import { AuthCookieService } from './auth-cookie.utils';
import { AuthHttpExceptionFilter } from './auth-http-exception.filter';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { AuthResponseDto, UserProfileResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import {
  StartEmailAuthDto,
  StartEmailAuthResponseDto,
} from './dto/start-email-auth.dto';
import { TokenQueryDto } from './dto/token-query.dto';
import { VerifyEmailAuthDto } from './dto/verify-email-auth.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { IdempotencyKeyInterceptor } from '../../../../../common/interceptors/idempotency-key.interceptor';

const authRouteRateLimits = {
  register: {
    limit: 3,
    ttl: parseDurationToMilliseconds('10m', 600_000),
    blockDuration: parseDurationToMilliseconds('30m', 1_800_000),
  },
  login: {
    limit: 5,
    ttl: parseDurationToMilliseconds('1m', 60_000),
    blockDuration: parseDurationToMilliseconds('5m', 300_000),
  },
  emailStart: {
    limit: 5,
    ttl: parseDurationToMilliseconds('5m', 300_000),
    blockDuration: parseDurationToMilliseconds('10m', 600_000),
  },
  emailVerify: {
    limit: 10,
    ttl: parseDurationToMilliseconds('5m', 300_000),
    blockDuration: parseDurationToMilliseconds('10m', 600_000),
  },
  refresh: {
    limit: 10,
    ttl: parseDurationToMilliseconds('1m', 60_000),
    blockDuration: parseDurationToMilliseconds('5m', 300_000),
  },
  passwordReset: {
    limit: 5,
    ttl: parseDurationToMilliseconds('10m', 600_000),
    blockDuration: parseDurationToMilliseconds('15m', 900_000),
  },
} as const;

@Controller('auth')
@UseFilters(AuthHttpExceptionFilter)
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly authenticateOAuthUseCase: AuthenticateOAuthUseCase,
    private readonly startEmailAuthUseCase: StartEmailAuthUseCase,
    private readonly verifyEmailAuthUseCase: VerifyEmailAuthUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly verifyResetPasswordTokenUseCase: VerifyResetPasswordTokenUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('register')
  @Throttle({
    default: authRouteRateLimits.register,
  })
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(IdempotencyKeyInterceptor)
  @Idempotent({
    scope: 'auth:register',
  })
  @ApiOperation({
    summary: 'Register',
  })
  @ApiCreatedResponse({
    type: AuthResponseDto,
  })
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authResponse = resolveOrThrow(
      await this.registerUseCase.execute({
        email: body.email,
        password: body.password,
        displayName: body.display_name,
      }),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);

    return AuthResponseDto.fromAuthResponse(authResponse);
  }

  @Get('oauth/google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Start Google OAuth',
  })
  @ApiFoundResponse({
    description: 'Redirects to Google OAuth consent screen.',
  })
  async googleOAuth(): Promise<void> {}

  @Get('oauth/google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Handle Google callback',
  })
  @ApiFoundResponse({
    description: 'Sets auth cookies and redirects to the app.',
  })
  async googleOAuthCallback(
    @Req() request: Request & { user: OAuthIdentity },
    @Res() response: Response,
  ): Promise<void> {
    await this.completeOAuthAuthentication(request, response);
  }

  @Get('oauth/github')
  @UseGuards(GithubOAuthGuard)
  @ApiOperation({
    summary: 'Start GitHub OAuth',
  })
  @ApiFoundResponse({
    description: 'Redirects to GitHub OAuth consent screen.',
  })
  async githubOAuth(): Promise<void> {}

  @Get('oauth/github/callback')
  @UseGuards(GithubOAuthGuard)
  @ApiOperation({
    summary: 'Handle GitHub callback',
  })
  @ApiFoundResponse({
    description: 'Sets auth cookies and redirects to the app.',
  })
  async githubOAuthCallback(
    @Req() request: Request & { user: OAuthIdentity },
    @Res() response: Response,
  ): Promise<void> {
    await this.completeOAuthAuthentication(request, response);
  }

  @Post('login')
  @Throttle({
    default: authRouteRateLimits.login,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
  })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authResponse = resolveOrThrow(
      await this.loginUseCase.execute(body),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);

    return AuthResponseDto.fromAuthResponse(authResponse);
  }

  @Post('email/start')
  @Throttle({
    default: authRouteRateLimits.emailStart,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send login code',
  })
  @ApiOkResponse({
    type: StartEmailAuthResponseDto,
  })
  async startEmailAuth(
    @Body() body: StartEmailAuthDto,
  ): Promise<StartEmailAuthResponseDto> {
    const result = await this.startEmailAuthUseCase.execute({
      email: body.email,
      intent: body.intent,
    });

    return StartEmailAuthResponseDto.fromResult(result);
  }

  @Post('email/verify')
  @Throttle({
    default: authRouteRateLimits.emailVerify,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify login code',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
  })
  async verifyEmailAuth(
    @Body() body: VerifyEmailAuthDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authResponse = resolveOrThrow(
      await this.verifyEmailAuthUseCase.execute({
        challengeId: body.challenge_id,
        code: body.code,
        intent: body.intent,
        displayName: body.display_name,
      }),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);

    return AuthResponseDto.fromAuthResponse(authResponse);
  }

  @Post('refresh')
  @Throttle({
    default: authRouteRateLimits.refresh,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh session',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
  })
  async refresh(
    @Req() request: Request,
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authResponse = resolveOrThrow(
      await this.refreshSessionUseCase.execute(
        body.refresh_token || this.authCookieService.extractRefreshToken(request),
      ),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);

    return AuthResponseDto.fromAuthResponse(authResponse);
  }

  @Post('forgot-password')
  @Throttle({
    default: authRouteRateLimits.passwordReset,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Forgot password',
  })
  @ApiNoContentResponse({
    description: 'Password reset request accepted.',
  })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.requestPasswordResetUseCase.execute(body.email);
  }

  @Get('verify-token')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify token',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['reset_password'],
  })
  @ApiOkResponse({
    description: 'Token is valid.',
  })
  async verifyToken(@Query() query: VerifyTokenDto): Promise<void> {
    resolveOrThrow(
      await this.verifyResetPasswordTokenUseCase.execute(query.token),
      mapAuthAppErrorToHttpException,
    );
  }

  @Post('reset-password')
  @Throttle({
    default: authRouteRateLimits.passwordReset,
  })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
  })
  @ApiOkResponse({
    type: AuthResponseDto,
  })
  async resetPassword(
    @Query() query: TokenQueryDto,
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authResponse = resolveOrThrow(
      await this.resetPasswordUseCase.execute({
        token: query.token,
        password: body.password,
      }),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);

    return AuthResponseDto.fromAuthResponse(authResponse);
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Logout',
  })
  @ApiNoContentResponse({
    description: 'Logged out successfully.',
  })
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute(currentUser);
    this.authCookieService.clearAuthCookies(response);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Current user',
  })
  @ApiOkResponse({
    type: UserProfileResponseDto,
  })
  async me(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserProfileResponseDto> {
    const userProfile = await this.getCurrentUserUseCase.execute(currentUser);

    return UserProfileResponseDto.fromUserProfile(
      userProfile,
    );
  }

  private async completeOAuthAuthentication(
    request: Request & { user: OAuthIdentity },
    response: Response,
  ): Promise<void> {
    const authResponse = resolveOrThrow(
      await this.authenticateOAuthUseCase.execute(request.user),
      mapAuthAppErrorToHttpException,
    );

    this.authCookieService.setAuthCookies(response, authResponse);
    response.redirect(302, this.buildAppRedirectUrl(request.query.state));
  }

  private buildAppRedirectUrl(state: unknown): string {
    const redirectTarget = this.getSafeRedirectTarget(
      typeof state === 'string' ? state : undefined,
    ) ?? '/workspace';

    return `${this.authCookieService.getAppBaseUrl()}${redirectTarget}`;
  }

  private getSafeRedirectTarget(redirectTarget: string | undefined): string | null {
    if (!redirectTarget) {
      return null;
    }

    if (!redirectTarget.startsWith('/') || redirectTarget.startsWith('//')) {
      return null;
    }

    return redirectTarget;
  }
}
