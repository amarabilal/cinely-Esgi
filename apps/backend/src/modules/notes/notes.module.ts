import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Note } from './domain/entities/note.entity';
import { NoteVersion } from './domain/entities/note-version.entity';
import { NoteShare } from './domain/entities/note-share.entity';
import { Tag } from '../tags/domain/entities/tag.entity';
import { User } from '../auth/domain/entities/user.entity';
import { Folder } from '../folders/domain/entities/folder.entity';
import { NOTE_REPOSITORY } from './domain/repositories/note.repository.interface';
import { NoteTypeOrmRepository } from './infrastructure/repositories/note.typeorm.repository';
import { NotesService } from './application/services/notes.service';
import { NotesController } from './infrastructure/controllers/notes.controller';
import { NotesGateway } from './infrastructure/gateways/notes.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Note, NoteVersion, NoteShare, Tag, User, Folder])],
  providers: [
    NotesService,
    NotesGateway,
    { provide: NOTE_REPOSITORY, useClass: NoteTypeOrmRepository },
  ],
  controllers: [NotesController],
})
export class NotesModule {}
