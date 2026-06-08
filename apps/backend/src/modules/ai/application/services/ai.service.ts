import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly openai: OpenAI;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async onModuleInit() {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
      this.logger.log('pgvector extension ready');
    } catch {
      this.logger.warn('pgvector extension not available — semantic search disabled');
    }
  }

  async suggestTitle(content: string): Promise<string> {
    const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system:
        'Tu es un assistant qui génère des titres courts et précis pour des notes. ' +
        'Réponds uniquement avec le titre, sans guillemets, sans ponctuation finale et en 8 mots maximum.',
      messages: [{ role: 'user', content: `Génère un titre pour cette note :\n\n${plain}` }],
    });
    const block = message.content[0];
    return block.type === 'text' ? block.text.trim() : '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: plain,
    });
    return response.data[0].embedding;
  }
}
