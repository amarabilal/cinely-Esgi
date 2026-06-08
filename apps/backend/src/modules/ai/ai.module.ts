import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './application/services/ai.service';
import { AiController } from './infrastructure/controllers/ai.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
