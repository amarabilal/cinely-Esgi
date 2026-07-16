import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/services/auth.service';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import type { Response, Request } from 'express';

describe('AuthController (native refresh)', () => {
  let controller: AuthController;
  const authService: any = {
    refresh: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' }),
  };
  const jwtService = { verify: jest.fn() };

  beforeEach(async () => {
    authService.refresh.mockClear();
    jwtService.verify.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: jwtService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(AuthController);
  });

  function mockRes() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  }

  it('reads the refresh token from the cookie (web) and does NOT echo it in the body', async () => {
    const req = { cookies: { refreshToken: 'cookie-rt' }, headers: {}, body: {} } as unknown as Request;
    const res = mockRes();
    const out = await controller.refresh(req, res, {});
    expect(authService.refresh).toHaveBeenCalledWith('cookie-rt');
    expect(out).toEqual({ accessToken: 'AT' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'RT', expect.any(Object));
  });

  it('reads the refresh token from the body and echoes it back for native clients', async () => {
    const req = {
      cookies: {},
      headers: { 'x-client-platform': 'capacitor' },
      body: { refreshToken: 'body-rt' },
    } as unknown as Request;
    const res = mockRes();
    const out = await controller.refresh(req, res, { refreshToken: 'body-rt' });
    expect(authService.refresh).toHaveBeenCalledWith('body-rt');
    expect(out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
  });

  describe('google exchange', () => {
    it('exchanges a valid code for both tokens', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1', purpose: 'google-exchange' });
      authService.issueTokensForUser = jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' });
      const res = mockRes();
      const out = await controller.googleExchange({ code: 'c' }, res);
      expect(authService.issueTokensForUser).toHaveBeenCalledWith('u1');
      expect(out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
    });

    it('rejects a code with the wrong purpose (e.g. a real access token)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1', email: 'a@b.c' });
      await expect(controller.googleExchange({ code: 'c' }, mockRes())).rejects.toThrow();
    });

    it('rejects an expired or tampered code', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(controller.googleExchange({ code: 'c' }, mockRes())).rejects.toThrow();
    });
  });
});
