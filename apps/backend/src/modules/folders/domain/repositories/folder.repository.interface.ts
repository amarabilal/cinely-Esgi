import { Folder } from '../entities/folder.entity';

export const FOLDER_REPOSITORY = 'FOLDER_REPOSITORY';

export interface IFolderRepository {
  findAll(userId: string): Promise<Folder[]>;
  findById(userId: string, id: string): Promise<Folder | null>;
  save(folder: Partial<Folder>): Promise<Folder>;
  update(userId: string, id: string, partial: Partial<Folder>): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}
