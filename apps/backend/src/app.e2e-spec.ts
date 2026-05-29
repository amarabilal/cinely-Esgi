import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

jest.setTimeout(30000);

describe('API fonctionnelle (Supertest)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshCookie: string;
  let noteId: string;
  let tagId: string;
  let shareId: string;
  let tempToken: string;

  const TEST_USER = {
    email: `e2e_${Date.now()}@test.com`,
    password: 'Test@1234!Secure',
    firstName: 'E2E',
    lastName: 'Test',
  };

  const SECOND_USER = {
    email: `e2e2_${Date.now()}@test.com`,
    password: 'Test@1234!Secure',
    firstName: 'Second',
    lastName: 'User',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth : register → login → refresh → logout ───────────────
  describe('Flux authentification complet', () => {
    it('POST /api/auth/register → 201 avec accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      accessToken = res.body.accessToken;
      refreshCookie = res.headers['set-cookie']?.[0] ?? '';
      expect(refreshCookie).toContain('refreshToken');
    });

    it('POST /api/auth/login → 200 avec accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      accessToken = res.body.accessToken;
    });

    it('GET /api/auth/me → 200 avec profil utilisateur', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('email', TEST_USER.email);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('POST /api/auth/refresh → 200 avec nouveau accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      accessToken = res.body.accessToken;
      const newCookie = res.headers['set-cookie']?.[0];
      if (newCookie) refreshCookie = newCookie;
    });

    it('POST /api/auth/login → 401 avec mauvais mot de passe', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: 'wrongpass' })
        .expect(401);
    });

    it("POST /api/auth/forgot-password → 200 même si email inconnu (silent fail)", async () => {
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);
    });
  });

  // ── Notes CRUD ───────────────────────────────────────────────
  describe('CRUD Notes', () => {
    it('POST /api/notes → 201 crée une note', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'E2E Note', content: '<p>Hello World</p>' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('E2E Note');
      noteId = res.body.id;
    });

    it('GET /api/notes → 200 liste les notes', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/notes/:id → 200 retourne la note', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(noteId);
    });

    it('PUT /api/notes/:id → 200 met à jour le titre', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title', content: '<p>Updated</p>' })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
    });

    it('GET /api/notes/search?q=Updated → 200 trouve la note', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes/search?q=Updated')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/notes/:id → 404 pour une note d'un autre utilisateur", async () => {
      // Register second user
      const res2 = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(SECOND_USER);
      const token2 = res2.body.accessToken;

      await request(app.getHttpServer())
        .get(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });

    it('GET /api/notes/stats → 200 retourne les statistiques', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalNotes');
      expect(res.body).toHaveProperty('recentNotes');
    });
  });

  // ── Tags ─────────────────────────────────────────────────────
  describe('Tags sur notes', () => {
    it('POST /api/tags → 201 crée un tag', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Tag', color: '#ef4444' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      tagId = res.body.id;
    });

    it('POST /api/notes/:id/tags/:tagId → 200 ajoute le tag', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/notes/${noteId}/tags/${tagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.tags.some((t: any) => t.id === tagId)).toBe(true);
    });

    it('DELETE /api/notes/:id/tags/:tagId → 200 retire le tag', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/notes/${noteId}/tags/${tagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.tags.some((t: any) => t.id === tagId)).toBe(false);
    });
  });

  // ── Partage de note ───────────────────────────────────────────
  describe('Partage de note', () => {
    let token2: string;

    beforeAll(async () => {
      const res2 = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SECOND_USER.email, password: SECOND_USER.password });
      token2 = res2.body.accessToken;
    });

    it("POST /api/notes/:id/shares → 201 partage en lecture", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/notes/${noteId}/shares`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: SECOND_USER.email, permission: 'READ' })
        .expect(201);
    });

    it('GET /api/notes/shared → 200 partagé voit la note', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes/shared')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body.some((n: any) => n.id === noteId)).toBe(true);
    });

    it('PUT /api/notes/:id → 403 ou 404 si partagé READ essaie de modifier', async () => {
      await request(app.getHttpServer())
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'Hack', content: '<p>x</p>' })
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('GET /api/notes/:id/shares → 200 liste les partages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/notes/${noteId}/shares`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      shareId = res.body[0]?.id;
    });

    it('DELETE /api/notes/:id/shares/:shareId → 204 révoque le partage', async () => {
      await request(app.getHttpServer())
        .delete(`/api/notes/${noteId}/shares/${shareId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it("GET /api/notes/:id → 404 après révocation", async () => {
      await request(app.getHttpServer())
        .get(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });
  });

  // ── Versioning ────────────────────────────────────────────────
  describe('Versioning', () => {
    it('GET /api/notes/:id/versions → 200 retourne les versions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/notes/${noteId}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Health ────────────────────────────────────────────────────
  describe('Health', () => {
    it('GET /api/health → 200 status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('db', 'connected');
    });
  });

  // ── Logout ───────────────────────────────────────────────────
  describe('Logout', () => {
    let freshCookie: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      freshCookie = res.headers['set-cookie']?.[0] ?? '';
    });

    it('POST /api/auth/logout → 204 révoque la session', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', freshCookie)
        .expect(204);
    });

    it('POST /api/auth/refresh → 401 après logout (token révoqué)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', freshCookie)
        .expect(401);
    });
  });
});
