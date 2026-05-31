import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiPropertyOptional({ example: 'Ma note de réunion' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: '<p>Contenu HTML</p>' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 'uuid-du-dossier' })
  @IsUUID()
  @IsOptional()
  folderId?: string;
}
