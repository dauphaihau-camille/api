import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { parseSortValue } from '~/common/application/sort';
import { resolveOrThrow } from '~/common/application/result';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { RequirePermissions } from '~/common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CreateUserUseCase } from '~/modules/domains/user/app/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from '~/modules/domains/user/app/use-cases/get-user-by-id.use-case';
import { ListUsersUseCase } from '~/modules/domains/user/app/use-cases/list-users.use-case';
import { PermissionsGuard } from '~/modules/domains/auth/api/guard/permissions.guard';
import {
  type UploadedAvatarFile,
  UpdateUserUseCase,
} from '~/modules/domains/user/app/use-cases/update-user.use-case';
import {
  buildListUsersQuery,
  DEFAULT_USER_LIST_SORT,
} from '../../app/user.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUserAppErrorToHttpException } from './user-http-error-mapper';
import { JwtAuthGuard } from '~/modules/domains/auth/api/guard/jwt-auth.guard';
import {
  mapUserListSortField,
  PaginatedUserSummaryResponseDto,
  USER_LIST_SORT_FIELDS_API,
  UserSummaryResponseDto,
} from './dto/user-response.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags('Users')
@ApiCookieAuth('access_token')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  @Get()
  @RequirePermissions('users.read')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'List',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: USER_LIST_SORT_FIELDS_API,
    isArray: true,
    description: 'Sort expression, for example: created_at:desc',
  })
  @ApiOkResponse({
    type: PaginatedUserSummaryResponseDto,
  })
  users(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUserSummaryResponseDto> {
    const sortOption = parseSortValue(
      query.sort,
      USER_LIST_SORT_FIELDS_API,
      { field: 'created_at', direction: DEFAULT_USER_LIST_SORT.direction },
    );

    return this.listUsersUseCase.execute(buildListUsersQuery({
      page: query.page,
      limit: query.limit,
      sort: {
        field: mapUserListSortField(sortOption.field),
        direction: sortOption.direction,
      },
    })).then(PaginatedUserSummaryResponseDto.fromPaginatedResult);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  @Header('Cache-Control', 'private, no-cache')
  @ApiOperation({
    summary: 'Get by id',
  })
  @ApiParam({
    name: 'id',
    type: String,
  })
  @ApiOkResponse({
    type: UserSummaryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User was not found.',
  })
  async user(@Param('id') id: string): Promise<UserSummaryResponseDto> {
    const user = await this.getUserByIdUseCase.execute(id);

    if (!user) {
      throw new NotFoundException('User was not found');
    }

    return UserSummaryResponseDto.fromUserSummary(user);
  }

  @Post()
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Create',
  })
  @ApiCreatedResponse({
    type: UserSummaryResponseDto,
  })
  createUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateUserDto,
  ): Promise<UserSummaryResponseDto> {
    return this.createUserUseCase
      .execute(currentUser, {
        email: body.email,
        password: body.password,
        displayName: body.display_name,
      })
      .then((result) => resolveOrThrow(result, mapUserAppErrorToHttpException))
      .then(UserSummaryResponseDto.fromUserSummary);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileInterceptor('avatar_file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update',
  })
  @ApiParam({
    name: 'id',
    type: String,
  })
  @ApiOkResponse({
    type: UserSummaryResponseDto,
  })
  updateUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateUserDto,
    @UploadedFile() avatarFile?: UploadedAvatarFile,
  ): Promise<UserSummaryResponseDto> {
    this.validateAvatarFile(avatarFile);

    return this.updateUserUseCase.execute(currentUser, id, {
      version: body.version,
      displayName: body.display_name,
      status: body.status,
      avatarFile,
    })
      .then((result) => resolveOrThrow(result, mapUserAppErrorToHttpException))
      .then(UserSummaryResponseDto.fromUserSummary);
  }

  private validateAvatarFile(file?: UploadedAvatarFile): void {
    if (!file) {
      return;
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Avatar file must be an image');
    }

    if (!file.buffer?.byteLength) {
      throw new BadRequestException('Avatar file is empty');
    }
  }
}
