import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToMany, JoinTable,
} from 'typeorm';
import { Tag } from '../../../tags/domain/entities/tag.entity';

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'folder_id', nullable: true })
  folderId: string | null;

  @Column({ default: '' })
  title: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ name: 'is_favorite', default: false })
  isFavorite: boolean;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'public_token', nullable: true })
  publicToken: string | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  @ManyToMany(() => Tag, { eager: true, cascade: false })
  @JoinTable({
    name: 'note_tags',
    joinColumn: { name: 'note_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags: Tag[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
