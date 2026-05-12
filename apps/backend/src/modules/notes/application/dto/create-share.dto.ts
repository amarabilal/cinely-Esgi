import { IsEmail, IsIn } from 'class-validator';

export class CreateShareDto {
  @IsEmail()
  email: string;

  @IsIn(['READ', 'WRITE'])
  permission: 'READ' | 'WRITE';
}
