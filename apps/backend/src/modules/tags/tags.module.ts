import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './domain/entities/tag.entity';
import { TAG_REPOSITORY } from './domain/repositories/tag.repository.interface';
import { TagTypeOrmRepository } from './infrastructure/repositories/tag.typeorm.repository';
import { TagsService } from './application/services/tags.service';
import { TagsController } from './infrastructure/controllers/tags.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  providers: [
    TagsService,
    { provide: TAG_REPOSITORY, useClass: TagTypeOrmRepository },
  ],
  controllers: [TagsController],
})
export class TagsModule {}
