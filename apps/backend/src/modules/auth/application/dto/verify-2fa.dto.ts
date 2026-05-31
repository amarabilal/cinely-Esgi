import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ description: 'Token temporaire JWT (scope 2fa, 5min)' })
  @IsString()
  tempToken: string;

  @ApiProperty({ example: '123456', description: 'Code TOTP 6 chiffres ou code de récupération' })
  @IsString()
  @Length(6, 6)
  code: string;
}
