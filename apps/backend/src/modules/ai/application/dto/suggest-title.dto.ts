import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuggestTitleDto {
  @ApiProperty({ description: 'Note content (HTML or plain text)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content: string;
}
