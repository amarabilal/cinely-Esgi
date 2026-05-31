import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'Travail' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'uuid-parent' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

export class UpdateFolderDto {
  @ApiProperty({ example: 'Travail (renommé)' })
  @IsString()
  @MinLength(1)
  name: string;
}
