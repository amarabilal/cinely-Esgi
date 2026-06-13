import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'fcm-device-token-string' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'android', description: "e.g. 'android' | 'ios' | 'web'" })
  @IsString()
  platform: string;
}
