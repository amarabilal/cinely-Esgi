import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  initializeApp, cert, applicationDefault, getApps,
} from 'firebase-admin/app';
import { getMessaging, BatchResponse } from 'firebase-admin/messaging';
import { DeviceToken } from '../../domain/entities/device-token.entity';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// FCM error codes that mean a token is dead and should be pruned.
const STALE_TOKEN_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** True once firebase-admin has been initialized with valid credentials. */
  private isConfigured = false;
  /** Guards against repeated init attempts. */
  private initialized = false;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  /**
   * Upsert a device token by its (unique) token value: if a row already exists
   * for this token, update its owner/platform; otherwise insert a new row.
   * Avoids duplicate rows for the same physical device token.
   */
  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    const existing = await this.deviceTokenRepository.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      await this.deviceTokenRepository.save(existing);
      return;
    }
    await this.deviceTokenRepository.save({ userId, token, platform });
  }

  /** Delete the device token row matching this token (e.g. on logout/unregister). */
  async removeToken(token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ token });
  }

  /**
   * Best-effort push to all of a user's registered devices.
   * No-ops (logs only) when FCM is not configured or the user has no tokens.
   * NEVER throws — a push failure must not break the calling flow.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      this.ensureInitialized();
      if (!this.isConfigured) {
        this.logger.log(`FCM not configured — skipping push to user ${userId}`);
        return;
      }

      const devices = await this.deviceTokenRepository.find({ where: { userId } });
      const tokens = devices.map((d) => d.token);
      if (tokens.length === 0) {
        this.logger.log(`No device tokens for user ${userId} — skipping push`);
        return;
      }

      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });

      await this.pruneStaleTokens(tokens, response);
    } catch (err) {
      // Swallow: pushes are best-effort and must never break the caller.
      this.logger.error(
        `Failed to send push to user ${userId}: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  /**
   * Remove tokens FCM reported as unregistered/invalid so we stop targeting
   * dead devices. Failures here are logged and swallowed.
   */
  private async pruneStaleTokens(tokens: string[], response: BatchResponse): Promise<void> {
    const stale: string[] = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = (res.error as { code?: string } | undefined)?.code;
        if (code && STALE_TOKEN_ERROR_CODES.includes(code)) {
          stale.push(tokens[idx]);
        }
      }
    });
    for (const token of stale) {
      try {
        await this.deviceTokenRepository.delete({ token });
        this.logger.log('Pruned stale device token');
      } catch (err) {
        this.logger.error(`Failed to prune stale token: ${(err as Error)?.message ?? err}`);
      }
    }
  }

  /**
   * Lazily initialize firebase-admin exactly once.
   * Credentials, in order of preference:
   *   1. FCM_SERVICE_ACCOUNT — full service-account JSON as a string.
   *   2. GOOGLE_APPLICATION_CREDENTIALS — path handled by applicationDefault().
   * If neither is present (or init fails), FCM stays DISABLED and sends no-op.
   */
  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Respect an app initialized elsewhere (avoid double init).
      if (getApps().length > 0) {
        this.isConfigured = true;
        return;
      }

      const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT;
      if (serviceAccountJson) {
        initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
        this.isConfigured = true;
        this.logger.log('FCM initialized from FCM_SERVICE_ACCOUNT');
        return;
      }

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp({ credential: applicationDefault() });
        this.isConfigured = true;
        this.logger.log('FCM initialized from GOOGLE_APPLICATION_CREDENTIALS');
        return;
      }

      this.isConfigured = false;
      this.logger.warn('FCM credentials not set — push notifications disabled (no-op).');
    } catch (err) {
      this.isConfigured = false;
      this.logger.error(
        `FCM initialization failed — push notifications disabled: ${(err as Error)?.message ?? err}`,
      );
    }
  }
}
