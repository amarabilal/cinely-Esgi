import {
  Controller, Get, Post, Param, Res,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { UploadsService } from '../../application/services/uploads.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://cinely.fr';
const ONE_YEAR_SECONDS = 31536000;

interface MemoryFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const imageFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
  }
};

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an image (max 5 MB, png/jpeg/webp/gif)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async upload(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: MemoryFile,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const att = await this.uploadsService.create(
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size },
      user.sub,
    );
    return { id: att.id, url: `${PUBLIC_BASE_URL}/api/uploads/${att.id}` };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Serve an uploaded image (public)' })
  async serve(@Param('id') id: string, @Res() res: Response) {
    const att = await this.uploadsService.findOne(id);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
    res.end(att.data);
  }
}
