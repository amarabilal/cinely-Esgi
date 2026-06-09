import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { Attachment } from '../../domain/entities/attachment.entity';

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: 'att-1',
  mimeType: 'image/png',
  size: 1234,
  data: Buffer.from('fake-png-bytes'),
  ownerId: 'user-1',
  createdAt: new Date(),
  ...overrides,
});

const mockRepo = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
});

describe('UploadsService', () => {
  let service: UploadsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: getRepositoryToken(Attachment), useFactory: mockRepo },
      ],
    }).compile();

    service = moduleRef.get(UploadsService);
    repo = moduleRef.get(getRepositoryToken(Attachment));
  });

  describe('create', () => {
    it('persists mimeType/size/ownerId/data and returns the saved entity with an id', async () => {
      const buffer = Buffer.from('fake-png-bytes');
      const saved = makeAttachment({ data: buffer });
      repo.save.mockResolvedValue(saved);

      const result = await service.create(
        { buffer, mimetype: 'image/png', size: 1234 },
        'user-1',
      );

      expect(repo.save).toHaveBeenCalledWith({
        mimeType: 'image/png',
        size: 1234,
        data: buffer,
        ownerId: 'user-1',
      });
      expect(result).toBe(saved);
      expect(result.id).toBe('att-1');
    });
  });

  describe('findOne', () => {
    it('returns the attachment when found', async () => {
      const att = makeAttachment();
      repo.findOne.mockResolvedValue(att);

      const result = await service.findOne('att-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'att-1' } });
      expect(result).toBe(att);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
