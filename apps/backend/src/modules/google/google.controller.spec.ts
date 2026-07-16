import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleController, GoogleCallbackController } from './google.controller';
import { GoogleService } from './google.service';
import { Note } from '../notes/domain/entities/note.entity';
import type { Response } from 'express';

describe('GoogleController (mobile sign-in)', () => {
  let controller: GoogleCallbackController;
  let loginController: GoogleController;
  const googleService = {
    getLoginAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=x'),
    handleLoginCallback: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', userId: 'u1' }),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('CODE'), verify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GoogleController, GoogleCallbackController],
      providers: [
        { provide: GoogleService, useValue: googleService },
        { provide: JwtService, useValue: jwtService },
        { provide: getRepositoryToken(Note), useValue: {} },
      ],
    }).compile();
    controller = moduleRef.get(GoogleCallbackController);
    loginController = moduleRef.get(GoogleController);
  });

  function mockRes() {
    return { redirect: jest.fn(), cookie: jest.fn() } as unknown as Response;
  }

  it('asks for the plain web login URL when no platform is given', async () => {
    await loginController.loginRedirect(undefined as unknown as string, mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith(undefined);
  });

  it('passes platform=mobile through to the service', async () => {
    await loginController.loginRedirect('mobile', mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith('mobile');
  });

  it('web sign-in still sets the refresh cookie and redirects to the frontend', async () => {
    process.env.FRONTEND_URL = 'https://cinely.fr';
    const res = mockRes();
    await controller.callback('code', 'login', res);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'RT', expect.any(Object));
    expect(res.redirect).toHaveBeenCalledWith('https://cinely.fr/login?google_login=success&token=AT');
  });

  it('mobile sign-in deep-links an exchange code and sets no cookie', async () => {
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 'u1', purpose: 'google-exchange' },
      expect.objectContaining({ expiresIn: '60s' }),
    );
    expect(res.redirect).toHaveBeenCalledWith('cinely://auth?google_login=success&code=CODE');
  });

  it('never puts a refresh token in the deep link', async () => {
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect((res.redirect as jest.Mock).mock.calls[0][0]).not.toContain('RT');
  });

  it('deep-links an error when the mobile callback fails', async () => {
    googleService.handleLoginCallback.mockRejectedValueOnce(new Error('boom'));
    const res = mockRes();
    await controller.callback('code', 'login|mobile', res);
    expect(res.redirect).toHaveBeenCalledWith('cinely://auth?google_login=error&message=boom');
  });
});
