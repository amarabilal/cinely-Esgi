import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShareDto {
  @ApiProperty({ example: 'collaborator@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['READ', 'WRITE'], example: 'READ' })
  @IsIn(['READ', 'WRITE'])
  permission: 'READ' | 'WRITE';
}
