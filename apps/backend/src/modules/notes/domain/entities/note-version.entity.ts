import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('note_versions')
export class NoteVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id' })
  noteId: string;

  @Column({ default: '' })
  title: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ name: 'version_number' })
  versionNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
