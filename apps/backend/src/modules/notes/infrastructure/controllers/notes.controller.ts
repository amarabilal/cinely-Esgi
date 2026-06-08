import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { NotesService } from '../../application/services/notes.service';
import { NotesGateway } from '../gateways/notes.gateway';
import { CreateNoteDto } from '../../application/dto/create-note.dto';
import { UpdateNoteDto } from '../../application/dto/update-note.dto';
import { QueryNotesDto } from '../../application/dto/query-notes.dto';
import { CreateShareDto } from '../../application/dto/create-share.dto';
import { UpdateSharePermissionDto } from '../../application/dto/update-share-permission.dto';

@ApiTags('notes')
@ApiBearerAuth()
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly notesGateway: NotesGateway,
  ) {}

  @Get('search')
  search(
    @CurrentUser() user: { sub: string },
    @Query('q') q: string,
    @Query('semantic') semantic?: string,
  ) {
    if (!q?.trim()) return [];
    if (semantic === 'true') return this.notesService.searchSemantic(user.sub, q.trim());
    return this.notesService.search(user.sub, q.trim());
  }

  @Get('shared')
  findSharedWithMe(@CurrentUser() user: { sub: string }) {
    return this.notesService.findSharedWithMe(user.sub);
  }

  @Get('stats')
  getStats(@CurrentUser() user: { sub: string }) {
    return this.notesService.getStats(user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: { sub: string }, @Query() query: QueryNotesDto) {
    return this.notesService.findAll(user.sub, query);
  }

  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateNoteDto) {
    return this.notesService.create(user.sub, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notesService.findOne(user.sub, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    await this.notesService.remove(user.sub, id);
    this.notesGateway.emitNoteDeleted(id);
  }

  @Patch(':id/favorite')
  async toggleFavorite(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const note = await this.notesService.findOne(user.sub, id);
    return this.notesService.update(user.sub, id, { isFavorite: !note.isFavorite });
  }

  @Patch(':id/archive')
  async toggleArchive(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const note = await this.notesService.findOne(user.sub, id);
    const updated = await this.notesService.update(user.sub, id, { isArchived: !note.isArchived });
    if (updated?.isArchived) this.notesGateway.emitNoteArchived(id);
    return updated;
  }

  @Post(':id/tags/:tagId')
  async addTag(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    const note = await this.notesService.addTag(user.sub, id, tagId);
    if (note) this.notesGateway.emitTagsUpdated(id, note.tags);
    return note;
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(200)
  async removeTag(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    const note = await this.notesService.removeTag(user.sub, id, tagId);
    if (note) this.notesGateway.emitTagsUpdated(id, note.tags);
    return note;
  }

  @Get(':id/versions')
  getVersions(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notesService.getVersions(user.sub, id);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.notesService.restoreVersion(user.sub, id, versionId);
  }

  @Get(':id/shares')
  getShares(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notesService.getShares(user.sub, id);
  }

  @Post(':id/shares')
  @HttpCode(201)
  shareNote(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.notesService.shareNote(user.sub, id, dto.email, dto.permission);
  }

  @Patch(':id/shares/:shareId')
  @HttpCode(200)
  async updateSharePermission(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('shareId') shareId: string,
    @Body() dto: UpdateSharePermissionDto,
  ) {
    const targetUserId = await this.notesService.updateSharePermission(user.sub, id, shareId, dto.permission);
    this.notesGateway.emitPermissionChanged(id, targetUserId, dto.permission);
  }

  @Delete(':id/shares/:shareId')
  @HttpCode(204)
  async revokeShare(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('shareId') shareId: string,
  ) {
    const targetUserId = await this.notesService.revokeShare(user.sub, id, shareId);
    this.notesGateway.emitShareRevoked(id, targetUserId);
  }
}
