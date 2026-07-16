import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToMany, JoinTable, OneToMany
} from 'typeorm';
import { Note } from '../../../notes/domain/entities/note.entity';
import { NotebookMessage } from './notebook-message.entity';

@Entity('notebooks')
export class Notebook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @ManyToMany(() => Note, { eager: true, cascade: false })
  @JoinTable({
    name: 'notebook_notes',
    joinColumn: { name: 'notebook_id' },
    inverseJoinColumn: { name: 'note_id' },
  })
  notes: Note[];

  @OneToMany(() => NotebookMessage, (message) => message.notebook, { cascade: true })
  messages: NotebookMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
