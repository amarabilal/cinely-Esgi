import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsUUID, IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { NotebooksService } from '../../application/services/notebooks.service';

class CreateNotebookDto {
  @ApiProperty({ example: 'My AI Research Notebook' })
  @IsString()
  @IsNotEmpty()
  title: string;
}

class UpdateNotebookDto {
  @ApiProperty({ example: 'My Renamed Notebook' })
  @IsString()
  @IsNotEmpty()
  title: string;
}

class ChatDto {
  @ApiProperty({ example: 'What is the summary of these guidelines?' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  activeSourceIds?: string[];
}

class GenerateGuideDto {
  @ApiProperty({ enum: ['briefing', 'faq', 'study-guide', 'timeline', 'audio', 'flashcards', 'quiz', 'slide-deck', 'mind-map', 'report', 'data-table'] })
  @IsEnum(['briefing', 'faq', 'study-guide', 'timeline', 'audio', 'flashcards', 'quiz', 'slide-deck', 'mind-map', 'report', 'data-table'])
  type: 'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table';

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  activeSourceIds?: string[];
}

@ApiTags('notebooks')
@ApiBearerAuth()
@Controller('notebooks')
@UseGuards(JwtAuthGuard)
export class NotebooksController {
  constructor(private readonly notebooksService: NotebooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notebooks for current user' })
  findAll(@CurrentUser() user: { sub: string }) {
    return this.notebooksService.findAll(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notebook' })
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateNotebookDto) {
    return this.notebooksService.create(user.sub, dto.title);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notebook details with linked notes' })
  findOne(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notebooksService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a notebook' })
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateNotebookDto,
  ) {
    return this.notebooksService.update(user.sub, id, dto.title);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a notebook' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    await this.notebooksService.remove(user.sub, id);
  }

  @Post(':id/notes/:noteId')
  @ApiOperation({ summary: 'Add a note to a notebook as source' })
  addNote(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notebooksService.addNote(user.sub, id, noteId);
  }

  @Delete(':id/notes/:noteId')
  @ApiOperation({ summary: 'Remove a note/source from a notebook' })
  removeNote(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notebooksService.removeNote(user.sub, id, noteId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get chat messages for a notebook' })
  getMessages(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notebooksService.getMessages(user.sub, id);
  }

  @Post(':id/chat')
  @ApiOperation({ summary: 'Chat with the notebook sources' })
  chat(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: ChatDto,
  ) {
    return this.notebooksService.chat(user.sub, id, dto.query, dto.activeSourceIds);
  }

  @Post(':id/generate-guide')
  @ApiOperation({ summary: 'Generate guide from source notes' })
  generateGuide(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: GenerateGuideDto,
  ) {
    return this.notebooksService.generateGuide(user.sub, id, dto.type, dto.activeSourceIds);
  }
}
