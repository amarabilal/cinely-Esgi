import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleService } from './google.service';
import { User } from '../auth/domain/entities/user.entity';
import { AuthService } from '../auth/application/services/auth.service';

describe('GoogleService.getLoginAuthUrl', () => {
  let service: GoogleService;
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://cinely.fr/api/google/callback';
    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(GoogleService);
  });

  // Keep the suite hermetic: jest workers reuse a process across test files, so
  // leaving GOOGLE_* set could leak into a later spec.
  afterAll(() => {
    process.env = savedEnv;
  });

  const stateOf = (url: string) => new URL(url).searchParams.get('state');

  it('uses state "login" for the web flow (no platform)', () => {
    expect(stateOf(service.getLoginAuthUrl())).toBe('login');
  });

  it('uses state "login|mobile" when platform is mobile', () => {
    expect(stateOf(service.getLoginAuthUrl('mobile'))).toBe('login|mobile');
  });

  it('falls back to the web state for any other platform value', () => {
    expect(stateOf(service.getLoginAuthUrl('ios'))).toBe('login');
  });
});
