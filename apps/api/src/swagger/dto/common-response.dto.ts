import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class AuthTokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;
}

export class VersionResponseDto {
  @ApiProperty({ example: 'modern-cms-api' })
  name!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: 'abc1234' })
  gitSha!: string;

  @ApiProperty({ example: '2026-06-27T12:00:00.000Z' })
  buildTime!: string;

  @ApiProperty({ example: 'production' })
  nodeEnv!: string;

  @ApiProperty({ example: { auditEnabled: true } })
  features!: { auditEnabled: boolean };
}
