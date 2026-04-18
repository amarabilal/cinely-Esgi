import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}

export class UpdateFolderDto {
  @IsString()
  @MinLength(1)
  name: string;
}
