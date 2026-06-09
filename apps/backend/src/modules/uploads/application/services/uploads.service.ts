import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../../domain/entities/attachment.entity';

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  create(file: UploadFile, ownerId: string): Promise<Attachment> {
    return this.attachmentRepository.save({
      mimeType: file.mimetype,
      size: file.size,
      data: file.buffer,
      ownerId,
    });
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }
}
