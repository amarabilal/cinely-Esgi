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

  @Post('suggest-tags')
  @ApiOperation({ summary: 'Generate tag suggestions from note content (Claude Haiku)' })
  async suggestTags(@Body() dto: { content: string; existingTags: string[] }) {
    const tags = await this.aiService.suggestTags(dto.content, dto.existingTags || []);
    return { tags };
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Generate a text summary from note content (Claude Haiku)' })
  async summarize(@Body() dto: { content: string }) {
    const summary = await this.aiService.summarize(dto.content);
    return { summary };
  }
}
