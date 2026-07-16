import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleExchangeDto {
  @ApiProperty({ description: 'One-time code from the cinely://auth deep link' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
