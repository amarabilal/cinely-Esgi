import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../../domain/entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async findByNoteId(noteId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { noteId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(userId: string, noteId: string, content: string, parentId?: string): Promise<Comment> {
    const comment = this.commentRepository.create({
      userId,
      noteId,
      content,
      parentId: parentId || null,
    });
    
    const saved = await this.commentRepository.save(comment);
    // Reload to populate the user relation
    return this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    }) as Promise<Comment>;
  }

  async delete(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new NotFoundException('You are not authorized to delete this comment');
    }
    await this.commentRepository.remove(comment);
  }
}
