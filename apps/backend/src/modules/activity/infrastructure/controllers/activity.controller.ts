import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { ActivityService } from '../../application/services/activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get global activity audit logs for current user' })
  findAll(
    @CurrentUser() user: { sub: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.activityService.findAll(
      user.sub,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }
}
