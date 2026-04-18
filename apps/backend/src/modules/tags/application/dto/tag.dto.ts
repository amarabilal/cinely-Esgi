import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color' })
  color?: string;
}

export class UpdateTagDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color' })
  color?: string;
}
