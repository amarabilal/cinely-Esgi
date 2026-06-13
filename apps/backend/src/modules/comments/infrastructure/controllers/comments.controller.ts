import {
  Controller, Get, Post, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CommentsService } from '../../application/services/comments.service';

class CreateCommentDto {
  content: string;
  parentId?: string;
}

@ApiTags('comments')
@ApiBearerAuth()
@Controller('notes/:noteId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comments for a note' })
  async findByNoteId(
    @Param('noteId') noteId: string,
  ) {
    return this.commentsService.findByNoteId(noteId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a comment on a note' })
  async create(
    @CurrentUser() user: { sub: string },
    @Param('noteId') noteId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.sub, noteId, dto.content, dto.parentId);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  async delete(
    @CurrentUser() user: { sub: string },
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.delete(user.sub, commentId);
  }
}
