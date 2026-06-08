import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { AiService } from '../../application/services/ai.service';
import { SuggestTitleDto } from '../../application/dto/suggest-title.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggest-title')
  @ApiOperation({ summary: 'Generate a title suggestion from note content (Claude Haiku)' })
  async suggestTitle(@Body() dto: SuggestTitleDto) {
    const title = await this.aiService.suggestTitle(dto.content);
    return { title };
  }
}
