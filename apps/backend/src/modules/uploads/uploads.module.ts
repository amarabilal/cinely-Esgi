import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './domain/entities/attachment.entity';
import { UploadsService } from './application/services/uploads.service';
import { UploadsController } from './infrastructure/controllers/uploads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  providers: [UploadsService],
  controllers: [UploadsController],
})
export class UploadsModule {}
