import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health')
  async health() {
    let dbStatus = 'connected';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'disconnected';
    }
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      db: dbStatus,
      version: '1.0.0',
    };
  }
}
