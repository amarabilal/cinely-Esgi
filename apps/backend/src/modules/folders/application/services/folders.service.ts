import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IFolderRepository, FOLDER_REPOSITORY } from '../../domain/repositories/folder.repository.interface';
import { CreateFolderDto, UpdateFolderDto } from '../dto/folder.dto';

@Injectable()
export class FoldersService {
  constructor(
    @Inject(FOLDER_REPOSITORY) private readonly folderRepository: IFolderRepository,
  ) {}

  findAll(userId: string) {
    return this.folderRepository.findAll(userId);
  }

  create(userId: string, dto: CreateFolderDto) {
    return this.folderRepository.save({
      userId,
      name: dto.name,
      parentId: dto.parentId ?? null,
    });
  }

  async update(userId: string, id: string, dto: UpdateFolderDto) {
    const folder = await this.folderRepository.findById(userId, id);
    if (!folder) throw new NotFoundException('Folder not found');
    await this.folderRepository.update(userId, id, { name: dto.name });
    return this.folderRepository.findById(userId, id);
  }

  async remove(userId: string, id: string) {
    const folder = await this.folderRepository.findById(userId, id);
    if (!folder) throw new NotFoundException('Folder not found');
    await this.folderRepository.delete(userId, id);
  }
}
