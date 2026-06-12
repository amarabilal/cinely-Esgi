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

  async queryNotebook(
    sources: { id: string; title: string; content: string }[],
    history: { role: 'user' | 'assistant'; content: string }[],
    query: string,
  ): Promise<{ answer: string; citations: { noteId: string; noteTitle: string; snippet: string }[] }> {
    const sourcesXml = sources
      .map((s, index) => {
        const plainContent = s.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `<source id="${index + 1}" dbId="${s.id}">\n<title>${s.title}</title>\n<content>${plainContent}</content>\n</source>`;
      })
      .join('\n\n');

    const systemPrompt = `You are Deep Research, a helpful AI assistant.
Your task is to answer the user's question using ONLY the provided sources.
Do not use any external knowledge. If the answer cannot be found in the sources, say so politely.

Here are the sources:
${sourcesXml}

You MUST output your response in JSON format matching this schema:
{
  "answer": "Your answer text here. Insert citations like [1] or [2] matching the source id attributes.",
  "citations": [
    {
      "noteId": "the dbId of the cited source note",
      "noteTitle": "the title of the cited source note",
      "snippet": "the exact sentence or phrase from the source content that supports your statement"
    }
  ]
}
Ensure the JSON is valid and only outputs the JSON object. Do not include any markdown code blocks (like \`\`\`json) or other text surrounding the JSON.`;

    const messages: any[] = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));
    messages.push({ role: 'user', content: query });

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages,
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text.trim() : '';

    try {
      const cleaned = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return {
        answer: text,
        citations: [],
      };
    }
  }

  async generateNotebookGuide(
    sources: { id: string; title: string; content: string }[],
    type: 'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table',
  ): Promise<{ title: string; content: string }> {
    const sourcesXml = sources
      .map((s, index) => {
        const plainContent = s.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `<source id="${index + 1}">\n<title>${s.title}</title>\n<content>${plainContent}</content>\n</source>`;
      })
      .join('\n\n');

    let guideInstruction = '';
    let defaultTitle = '';
    if (type === 'briefing') {
      defaultTitle = 'Briefing Document';
      guideInstruction =
        'Create a detailed Briefing Document. It should synthesize all source materials into a coherent narrative with clear sections, bullet points, and key insights. Do not add any conversational remarks, respond with markdown content only.';
    } else if (type === 'faq') {
      defaultTitle = 'FAQ Document';
      guideInstruction =
        'Create a Frequently Asked Questions (FAQ) document based on the sources. List important questions a reader might ask and provide detailed answers extracted from the sources. Respond with markdown content only.';
    } else if (type === 'study-guide') {
      defaultTitle = 'Study Guide';
      guideInstruction =
        'Create a comprehensive Study Guide. It must contain:\n1. Key Terms and Definitions\n2. Core Concepts Summaries\n3. A brief 5-question Review Quiz with answers at the bottom. Respond with markdown content only.';
    } else if (type === 'timeline') {
      defaultTitle = 'Timeline Document';
      guideInstruction =
        'Extract all events, dates, and historical/chronological references from the sources and organize them into a clean, chronological timeline table or list. Respond with markdown content only.';
    } else if (type === 'audio') {
      defaultTitle = 'Audio Overview Script';
      guideInstruction =
        'Create a dialogue script for an Audio Overview podcast between two hosts, "Host 1 (Male)" and "Host 2 (Female)", discussing the core topics of the source notes. They should have a natural, conversational, engaging, and clear interaction, explaining complex ideas simply. Respond with markdown content only (using bold host names).';
    } else if (type === 'flashcards') {
      defaultTitle = 'Flashcards Study Set';
      guideInstruction =
        'Create a set of Flashcards for active recall based on the sources. Format each flashcard as:\n### Card [Number]\n**Front (Question/Term):** [Question or term]\n**Back (Answer/Definition):** [Answer or definition]\n\nCreate at least 8 flashcards. Respond with markdown content only.';
    } else if (type === 'quiz') {
      defaultTitle = 'Practice Quiz';
      guideInstruction =
        'Create a multiple-choice practice quiz based on the sources. Generate 5 questions with options A, B, C, D, and list the correct answers with explanations at the very bottom. Respond with markdown content only.';
    } else if (type === 'slide-deck') {
      defaultTitle = 'Slide Deck Outline';
      guideInstruction =
        'Create a Slide Deck outline based on the source materials. Organize it slide-by-slide, with a Title Slide and at least 6 content slides containing bulleted talking points. Respond with markdown content only.';
    } else if (type === 'mind-map') {
      defaultTitle = 'Mind Map Outline';
      guideInstruction =
        'Create a structured Mind Map concept outline based on the sources. Use nested bullet points to show hierarchy, associations, and conceptual nodes. Respond with markdown content only.';
    } else if (type === 'report') {
      defaultTitle = 'Research Analysis Report';
      guideInstruction =
        'Create a detailed Research Analysis Report based on the source notes. Include an Executive Summary, Key Findings, Detailed Analysis, and Conclusion. Respond with markdown content only.';
    } else if (type === 'data-table') {
      defaultTitle = 'Structured Data Table';
      guideInstruction =
        'Extract key facts, statistics, entities, or numeric data from the sources and display them in a beautifully formatted markdown table. Respond with markdown content only.';
    }

    const systemPrompt = `You are Deep Research, an expert education assistant.
Your task is to generate a guide based ONLY on the provided sources.
Do not use any external knowledge.

Sources:
${sourcesXml}

Instructions:
${guideInstruction}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      system: systemPrompt,
      messages: [{ role: 'user', content: `Generate the ${defaultTitle}` }],
      max_tokens: 4000,
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text.trim() : '';

    return {
      title: `${defaultTitle} - ${new Date().toLocaleDateString()}`,
      content: text,
    };
  }
}
