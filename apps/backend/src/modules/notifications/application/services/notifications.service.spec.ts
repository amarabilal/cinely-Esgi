import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { DeviceToken } from '../../domain/entities/device-token.entity';
import { Notification } from '../../domain/entities/notification.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    // Ensure FCM is NOT configured for these tests.
    delete process.env.FCM_SERVICE_ACCOUNT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(DeviceToken), useValue: mockRepo() },
        { provide: getRepositoryToken(Notification), useValue: mockRepo() },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
    repo = moduleRef.get(getRepositoryToken(DeviceToken));
  });

  describe('registerToken', () => {
    it('inserts a new token when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (entity) => entity);

      await service.registerToken('user-1', 'tok-abc', 'android');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { token: 'tok-abc' } });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', token: 'tok-abc', platform: 'android' }),
      );
    });

    it('updates userId/platform when the token already exists', async () => {
      repo.findOne.mockResolvedValue({ id: 'd-1', userId: 'old-user', token: 'tok-abc', platform: 'ios' });
      repo.save.mockImplementation(async (entity) => entity);

      await service.registerToken('user-2', 'tok-abc', 'android');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'd-1', userId: 'user-2', token: 'tok-abc', platform: 'android' }),
      );
    });
  });

  describe('removeToken', () => {
    it('deletes by token', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeToken('tok-abc');

      expect(repo.delete).toHaveBeenCalledWith({ token: 'tok-abc' });
    });
  });

  describe('sendToUser (FCM not configured)', () => {
    it('does not throw and never looks up tokens when FCM is disabled', async () => {
      await expect(
        service.sendToUser('user-1', { title: 'Hi', body: 'There' }),
      ).resolves.toBeUndefined();

      // No-op path: should short-circuit before touching the repo.
      expect((service as any).isConfigured).toBe(false);
      expect(repo.find).not.toHaveBeenCalled();
    });
  });
});
