import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notebook } from './domain/entities/notebook.entity';
import { NotebookMessage } from './domain/entities/notebook-message.entity';
import { Note } from '../notes/domain/entities/note.entity';
import { AiModule } from '../ai/ai.module';
import { NotebooksService } from './application/services/notebooks.service';
import { NotebooksController } from './infrastructure/controllers/notebooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notebook, NotebookMessage, Note]),
    AiModule,
  ],
  providers: [NotebooksService],
  controllers: [NotebooksController],
  exports: [NotebooksService],
})
export class NotebooksModule {}
