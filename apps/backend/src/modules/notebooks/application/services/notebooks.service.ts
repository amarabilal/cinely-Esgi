import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notebook } from '../../domain/entities/notebook.entity';
import { NotebookMessage } from '../../domain/entities/notebook-message.entity';
import { Note } from '../../../notes/domain/entities/note.entity';
import { AiService } from '../../../ai/application/services/ai.service';

@Injectable()
export class NotebooksService {
  constructor(
    @InjectRepository(Notebook)
    private readonly notebookRepository: Repository<Notebook>,
    @InjectRepository(NotebookMessage)
    private readonly messageRepository: Repository<NotebookMessage>,
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    private readonly aiService: AiService,
  ) {}

  async findAll(userId: string): Promise<Notebook[]> {
    return this.notebookRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Notebook> {
    const notebook = await this.notebookRepository.findOne({
      where: { id, userId },
      relations: ['notes', 'notes.tags'],
    });
    if (!notebook) {
      throw new NotFoundException('Notebook not found');
    }
    return notebook;
  }

  async create(userId: string, title: string): Promise<Notebook> {
    const notebook = this.notebookRepository.create({
      userId,
      title: title || 'Untitled Notebook',
      notes: [],
    });
    return this.notebookRepository.save(notebook);
  }

  async update(userId: string, id: string, title: string): Promise<Notebook> {
    const notebook = await this.findOne(userId, id);
    notebook.title = title;
    return this.notebookRepository.save(notebook);
  }

  async remove(userId: string, id: string): Promise<void> {
    const notebook = await this.findOne(userId, id);
    await this.notebookRepository.remove(notebook);
  }

  async addNote(userId: string, id: string, noteId: string): Promise<Notebook> {
    const notebook = await this.findOne(userId, id);
    
    // Verify user owns the note or it exists (we query by noteId)
    // Note: for shared notes, check permissions if needed, but standard check is that user can access the note.
    const note = await this.noteRepository.findOne({
      where: { id: noteId, isDeleted: false },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Check if already added
    if (notebook.notes.some(n => n.id === noteId)) {
      return notebook;
    }

    notebook.notes.push(note);
    return this.notebookRepository.save(notebook);
  }

  async removeNote(userId: string, id: string, noteId: string): Promise<Notebook> {
    const notebook = await this.findOne(userId, id);
    notebook.notes = notebook.notes.filter(n => n.id !== noteId);
    return this.notebookRepository.save(notebook);
  }

  async getMessages(userId: string, notebookId: string): Promise<NotebookMessage[]> {
    // Check ownership of notebook first
    await this.findOne(userId, notebookId);
    return this.messageRepository.find({
      where: { notebookId },
      order: { createdAt: 'ASC' },
    });
  }

  async chat(
    userId: string,
    notebookId: string,
    query: string,
    activeSourceIds?: string[],
  ): Promise<{ userMessage: NotebookMessage; assistantMessage: NotebookMessage }> {
    const notebook = await this.findOne(userId, notebookId);
    if (!query || !query.trim()) {
      throw new BadRequestException('Query cannot be empty');
    }

    // Filter notes that will serve as sources
    let sources = notebook.notes;
    if (activeSourceIds && activeSourceIds.length > 0) {
      sources = sources.filter(n => activeSourceIds.includes(n.id));
    }

    if (sources.length === 0) {
      throw new BadRequestException('At least one source note must be selected');
    }

    // Load recent message history for context (last 15 messages)
    const dbMessages = await this.messageRepository.find({
      where: { notebookId },
      order: { createdAt: 'DESC' },
      take: 15,
    });
    const history = dbMessages
      .reverse()
      .map(m => ({ role: m.role, content: m.content }));

    // Request answer from AiService
    const aiResult = await this.aiService.queryNotebook(
      sources.map(s => ({ id: s.id, title: s.title, content: s.content })),
      history,
      query,
    );

    // Save User message
    const userMessage = this.messageRepository.create({
      notebookId,
      role: 'user',
      content: query,
    });
    await this.messageRepository.save(userMessage);

    // Save Assistant message
    const assistantMessage = this.messageRepository.create({
      notebookId,
      role: 'assistant',
      content: aiResult.answer,
      citations: aiResult.citations && aiResult.citations.length > 0
        ? JSON.stringify(aiResult.citations)
        : null,
    });
    await this.messageRepository.save(assistantMessage);

    return { userMessage, assistantMessage };
  }

  async generateGuide(
    userId: string,
    notebookId: string,
    type: 'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table',
    activeSourceIds?: string[],
  ): Promise<{ title: string; content: string }> {
    const notebook = await this.findOne(userId, notebookId);
    let sources = notebook.notes;
    if (activeSourceIds && activeSourceIds.length > 0) {
      sources = sources.filter(n => activeSourceIds.includes(n.id));
    }

    if (sources.length === 0) {
      throw new BadRequestException('At least one source note must be selected');
    }

    return this.aiService.generateNotebookGuide(
      sources.map(s => ({ id: s.id, title: s.title, content: s.content })),
      type,
    );
  }
}
