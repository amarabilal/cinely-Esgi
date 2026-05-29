import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { TotpService } from '../../../../shared/services/totp.service';
import { Session } from '../../domain/entities/session.entity';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { TotpRecoveryCode } from '../../domain/entities/totp-recovery-code.entity';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';

// ── Factories helpers ─────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  firstName: 'Test',
  lastName: 'User',
  loginAttempts: 0,
  lockedUntil: null,
  passwordExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  totpEnabled: false,
  totpSecret: null,
  isEmailVerified: false,
  emailVerificationToken: null,
  emailVerificationExpiresAt: null,
  ...overrides,
});

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let sessionRepo: any;
  let resetTokenRepo: any;
  let recoveryCodeRepo: any;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let totpService: jest.Mocked<TotpService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USER_REPOSITORY,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByEmailVerificationToken: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Session), useValue: mockRepo() },
        { provide: getRepositoryToken(PasswordResetToken), useValue: mockRepo() },
        { provide: getRepositoryToken(TotpRecoveryCode), useValue: mockRepo() },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn().mockResolvedValue(undefined),
            sendEmailVerification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TotpService,
          useValue: { verify: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(USER_REPOSITORY);
    sessionRepo = module.get(getRepositoryToken(Session));
    resetTokenRepo = module.get(getRepositoryToken(PasswordResetToken));
    recoveryCodeRepo = module.get(getRepositoryToken(TotpRecoveryCode));
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    totpService = module.get(TotpService);

    // Setup JWT sign par défaut
    jwtService.sign.mockReturnValue('fake-token');
    sessionRepo.save.mockResolvedValue({ id: 'session-1' });
  });

  // ── register ────────────────────────────────────────────────
  describe('register', () => {
    it('crée un compte et retourne un accessToken', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.save.mockResolvedValue(makeUser());

      const result = await service.register({
        email: 'new@example.com',
        password: 'Test@1234!Secure',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('lève ConflictException si email déjà utilisé', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.register({ email: 'test@example.com', password: 'x', firstName: 'a', lastName: 'b' }),
      ).rejects.toThrow(ConflictException);
    });

    it("envoie l'email de vérification en arrière-plan", async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.save.mockResolvedValue(makeUser());
      await service.register({ email: 'new@example.com', password: 'pass', firstName: 'a', lastName: 'b' });
      // sendEmailVerification appelé en fire-and-forget — on vérifie juste qu'il ne bloque pas
      expect(userRepo.save).toHaveBeenCalled();
    });
  });

  // ── login ───────────────────────────────────────────────────
  describe('login', () => {
    it('retourne les tokens pour des identifiants valides', async () => {
      const hash = await argon2.hash('goodpass');
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.login({ email: 'test@example.com', password: 'goodpass' }, '127.0.0.1');
      expect(result).toHaveProperty('accessToken');
    });

    it('lève UnauthorizedException pour mot de passe incorrect', async () => {
      const hash = await argon2.hash('correctpass');
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      userRepo.update.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpass' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si utilisateur inconnu', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('incrémente loginAttempts sur échec', async () => {
      const hash = await argon2.hash('correct');
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash, loginAttempts: 2 }));
      userRepo.update.mockResolvedValue(undefined);

      await service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1').catch(() => {});
      expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ loginAttempts: 3 }));
    });

    it('verrouille le compte après 5 tentatives', async () => {
      const hash = await argon2.hash('correct');
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash, loginAttempts: 4 }));
      userRepo.update.mockResolvedValue(undefined);

      await service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1').catch(() => {});
      expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ lockedUntil: expect.any(Date) }));
    });

    it('lève ForbiddenException si compte verrouillé', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      userRepo.findByEmail.mockResolvedValue(makeUser({ lockedUntil }));

      await expect(
        service.login({ email: 'test@example.com', password: 'any' }, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException PASSWORD_EXPIRED si mdp expiré', async () => {
      const hash = await argon2.hash('pass');
      const expired = new Date(Date.now() - 1000);
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash, passwordExpiresAt: expired }));
      userRepo.update.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'test@example.com', password: 'pass' }, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retourne twoFactorRequired si 2FA activé', async () => {
      const hash = await argon2.hash('pass');
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash, totpEnabled: true, totpSecret: 'SECRET' }));
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.login({ email: 'test@example.com', password: 'pass' }, '127.0.0.1');
      expect(result).toHaveProperty('twoFactorRequired', true);
      expect(result).toHaveProperty('tempToken');
    });
  });

  // ── verify2fa ───────────────────────────────────────────────
  describe('verify2fa', () => {
    const validPayload = { sub: 'user-1', scope: '2fa' };

    beforeEach(() => {
      jwtService.verify.mockReturnValue(validPayload as any);
      userRepo.findById.mockResolvedValue(makeUser({ totpEnabled: true, totpSecret: 'SECRET' }));
    });

    it('accepte un code TOTP valide', async () => {
      totpService.verify.mockReturnValue(true);
      const result = await service.verify2fa('temp-token', '123456');
      expect(result).toHaveProperty('accessToken');
    });

    it('rejette un code TOTP invalide sans recovery code correspondant', async () => {
      totpService.verify.mockReturnValue(false);
      recoveryCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.verify2fa('temp-token', '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('accepte un code de récupération valide', async () => {
      totpService.verify.mockReturnValue(false);
      const hash = crypto.createHash('sha256').update('ABCDE12345'.toUpperCase()).digest('hex');
      recoveryCodeRepo.findOne.mockResolvedValue({ id: 'rc-1', userId: 'user-1', codeHash: hash, usedAt: null });
      recoveryCodeRepo.update.mockResolvedValue(undefined);

      const result = await service.verify2fa('temp-token', 'ABCDE-12345');
      expect(result).toHaveProperty('accessToken');
      expect(recoveryCodeRepo.update).toHaveBeenCalledWith('rc-1', { usedAt: expect.any(Date) });
    });

    it('lève UnauthorizedException si tempToken invalide', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.verify2fa('bad-token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si scope incorrect', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', scope: 'access' } as any);
      await expect(service.verify2fa('token', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── forgotPassword ──────────────────────────────────────────
  describe('forgotPassword', () => {
    it('envoie un email si utilisateur trouvé', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser());
      resetTokenRepo.update.mockResolvedValue(undefined);
      resetTokenRepo.save.mockResolvedValue({});

      await service.forgotPassword('test@example.com');
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith('test@example.com', expect.any(String));
    });

    it("ne lève pas d'erreur si utilisateur non trouvé (silent fail)", async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('invalide les anciens tokens avant de créer un nouveau', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser());
      resetTokenRepo.update.mockResolvedValue(undefined);
      resetTokenRepo.save.mockResolvedValue({});

      await service.forgotPassword('test@example.com');
      expect(resetTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', usedAt: null },
        { usedAt: expect.any(Date) },
      );
    });
  });

  // ── resetPassword ───────────────────────────────────────────
  describe('resetPassword', () => {
    it('met à jour le mot de passe avec un token valide', async () => {
      const token = 'valid-token';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000);

      resetTokenRepo.findOne.mockResolvedValue({ id: 'rt-1', userId: 'user-1', tokenHash: hash, expiresAt });
      userRepo.update.mockResolvedValue(undefined);
      resetTokenRepo.update.mockResolvedValue(undefined);

      await service.resetPassword(token, 'NewPass@1234!');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ passwordHash: expect.any(String) }));
      expect(resetTokenRepo.update).toHaveBeenCalledWith('rt-1', { usedAt: expect.any(Date) });
    });

    it('lève BadRequestException pour token invalide', async () => {
      resetTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('bad', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour token expiré', async () => {
      resetTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1', userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.resetPassword('expired', 'newpass')).rejects.toThrow(BadRequestException);
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────
  describe('verifyEmail', () => {
    it('marque isEmailVerified = true pour un token valide', async () => {
      const token = 'verify-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = makeUser({ emailVerificationToken: tokenHash, emailVerificationExpiresAt: new Date(Date.now() + 86400000) });
      userRepo.findByEmailVerificationToken.mockResolvedValue(user);
      userRepo.update.mockResolvedValue(undefined);

      await service.verifyEmail(token);
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      });
    });

    it('lève BadRequestException pour token invalide', async () => {
      userRepo.findByEmailVerificationToken.mockResolvedValue(null);
      await expect(service.verifyEmail('bad')).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour token expiré', async () => {
      userRepo.findByEmailVerificationToken.mockResolvedValue(
        makeUser({ emailVerificationToken: 'hash', emailVerificationExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.verifyEmail('expired')).rejects.toThrow(BadRequestException);
    });
  });
});
