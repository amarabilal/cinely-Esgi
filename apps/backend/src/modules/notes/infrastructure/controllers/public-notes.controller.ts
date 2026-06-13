import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotesService } from '../../application/services/notes.service';

@ApiTags('public-notes')
@Controller('public/notes')
export class PublicNotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Get a public note by its sharing token (unprotected)' })
  async findPublic(@Param('token') token: string) {
    const note = await this.notesService.findPublicNote(token);
    if (!note) {
      throw new NotFoundException('Note public introuvable');
    }
    return note;
  }
}
