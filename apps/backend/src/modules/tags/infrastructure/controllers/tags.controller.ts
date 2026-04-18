import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { TagsService } from '../../application/services/tags.service';
import { CreateTagDto, UpdateTagDto } from '../../application/dto/tag.dto';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@CurrentUser() user: { sub: string }) {
    return this.tagsService.findAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateTagDto) {
    return this.tagsService.create(user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.tagsService.remove(user.sub, id);
  }
}
