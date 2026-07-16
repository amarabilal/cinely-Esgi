import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { Note } from '../notes/domain/entities/note.entity';
import type { Response } from 'express';

describe('GoogleController (mobile sign-in)', () => {
  let controller: GoogleController;
  const googleService = {
    getLoginAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=x'),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('CODE'), verify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: GoogleService, useValue: googleService },
        { provide: JwtService, useValue: jwtService },
        { provide: getRepositoryToken(Note), useValue: {} },
      ],
    }).compile();
    controller = moduleRef.get(GoogleController);
  });

  function mockRes() {
    return { redirect: jest.fn(), cookie: jest.fn() } as unknown as Response;
  }

  it('asks for the plain web login URL when no platform is given', async () => {
    await controller.loginRedirect(undefined as unknown as string, mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith(undefined);
  });

  it('passes platform=mobile through to the service', async () => {
    await controller.loginRedirect('mobile', mockRes());
    expect(googleService.getLoginAuthUrl).toHaveBeenCalledWith('mobile');
  });
});
