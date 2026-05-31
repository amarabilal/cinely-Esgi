import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { FoldersService } from '../../application/services/folders.service';
import { CreateFolderDto, UpdateFolderDto } from '../../application/dto/folder.dto';

@ApiTags('folders')
@ApiBearerAuth()
@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  findAll(@CurrentUser() user: { sub: string }) {
    return this.foldersService.findAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.foldersService.remove(user.sub, id);
  }
}
