import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiStandardErrors } from '../swagger/swagger.decorators';
import { AuthTokensDto, ErrorResponseDto } from '../swagger/dto/common-response.dto';

@ApiTags(SWAGGER_TAGS.AUTH)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'auth.login.summary',
    description: 'Returns JWT access and refresh tokens. No authentication required.',
  })
  @ApiResponse({ status: 200, description: 'auth.response.200', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'auth.response.401', type: ErrorResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'auth.refresh.summary',
    description: 'Exchange a valid refresh token for a new access/refresh token pair.',
  })
  @ApiResponse({ status: 200, description: 'auth.response.200', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'auth.response.401', type: ErrorResponseDto })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });
  }

  @Get('me')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'auth.me.summary',
    description: 'Returns the authenticated user with tenant memberships and permissions.',
    related: [SWAGGER_TAGS.USERS],
  })
  @ApiResponse({ status: 200, description: 'auth.response.200' })
  async me(@CurrentUser() user: User) {
    return this.auth.me(user);
  }

  @Patch('me')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'auth.updateProfile.summary', permissions: ['authenticated'] })
  @ApiResponse({ status: 200, description: 'auth.response.200' })
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'auth.me.summary', permissions: ['authenticated'] })
  @ApiResponse({ status: 200, description: 'auth.response.200' })
  @ApiStandardErrors()
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }
}
