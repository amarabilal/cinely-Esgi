import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token for native clients (web uses the httpOnly cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
