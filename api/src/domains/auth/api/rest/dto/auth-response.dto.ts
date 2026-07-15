import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuthResponse, UserProfile } from '../../../app/auth.types';

export class UserProfileResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  email!: string;
  @ApiPropertyOptional()
  display_name?: string;
  @ApiProperty()
  status!: UserProfile['status'];
  @ApiProperty()
  session_id!: string;
  @ApiProperty({
    type: [String],
  })
  roles!: string[];
  @ApiProperty({
    type: [String],
  })
  permissions!: string[];

  static fromUserProfile(profile: UserProfile): UserProfileResponseDto {
    return {
      id: profile.id,
      email: profile.email,
      display_name: profile.displayName,
      status: profile.status,
      session_id: profile.sessionId,
      roles: profile.roles,
      permissions: profile.permissions,
    };
  }
}

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;
  @ApiProperty()
  refresh_token!: string;
  @ApiProperty({
    type: () => UserProfileResponseDto,
  })
  user!: UserProfileResponseDto;

  static fromAuthResponse(response: AuthResponse): AuthResponseDto {
    return {
      access_token: response.accessToken,
      refresh_token: response.refreshToken,
      user: UserProfileResponseDto.fromUserProfile(response.user),
    };
  }
}
