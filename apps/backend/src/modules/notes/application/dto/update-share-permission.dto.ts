import { IsIn } from 'class-validator';

export class UpdateSharePermissionDto {
  @IsIn(['READ', 'WRITE'])
  permission: 'READ' | 'WRITE';
}
