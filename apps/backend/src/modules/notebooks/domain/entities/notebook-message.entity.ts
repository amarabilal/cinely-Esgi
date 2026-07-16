import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Notebook } from './notebook.entity';

@Entity('notebook_messages')
export class NotebookMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notebook_id' })
  notebookId: string;

  @ManyToOne(() => Notebook, (notebook) => notebook.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notebook_id' })
  notebook: Notebook;

  @Column()
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  citations: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
