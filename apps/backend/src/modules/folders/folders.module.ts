import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from './domain/entities/folder.entity';
import { FOLDER_REPOSITORY } from './domain/repositories/folder.repository.interface';
import { FolderTypeOrmRepository } from './infrastructure/repositories/folder.typeorm.repository';
import { FoldersService } from './application/services/folders.service';
import { FoldersController } from './infrastructure/controllers/folders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Folder])],
  providers: [
    FoldersService,
    { provide: FOLDER_REPOSITORY, useClass: FolderTypeOrmRepository },
  ],
  controllers: [FoldersController],
})
export class FoldersModule {}
