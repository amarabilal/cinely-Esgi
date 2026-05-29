import { TotpService } from './totp.service';

describe('TotpService', () => {
  let service: TotpService;

  beforeEach(() => {
    service = new TotpService();
  });

  describe('generateSecret', () => {
    it('génère un secret Base32 de longueur fixe', () => {
      const secret = service.generateSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(secret.length).toBeGreaterThanOrEqual(32);
    });

    it('génère des secrets uniques', () => {
      const a = service.generateSecret();
      const b = service.generateSecret();
      expect(a).not.toBe(b);
    });
  });

  describe('buildUri', () => {
    it("construit une URI otpauth valide", () => {
      const uri = service.buildUri('JBSWY3DPEHPK3PXP', 'test@example.com');
      expect(uri).toMatch(/^otpauth:\/\/totp\//);
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });
  });

  describe('hotp — vecteurs RFC 6238', () => {
    // Secret RFC 4226 : "12345678901234567890" en ASCII
    const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    const vectors: Array<{ counter: number; expected: string }> = [
      { counter: 0, expected: '755224' },
      { counter: 1, expected: '287082' },
      { counter: 2, expected: '359152' },
      { counter: 3, expected: '969429' },
      { counter: 4, expected: '338314' },
      { counter: 5, expected: '254676' },
    ];

    vectors.forEach(({ counter, expected }) => {
      it(`counter=${counter} → ${expected}`, () => {
        // Accès à la méthode privée via cast
        const code = (service as any).hotp(RFC_SECRET, counter);
        expect(code).toBe(expected);
      });
    });
  });

  describe('verify', () => {
    it('accepte un code valide généré pour le step courant', () => {
      const secret = service.generateSecret();
      const step = Math.floor(Date.now() / 30000);
      const code = (service as any).hotp(secret, step);
      expect(service.verify(secret, code)).toBe(true);
    });

    it('accepte un code du step précédent (tolérance -1)', () => {
      const secret = service.generateSecret();
      const step = Math.floor(Date.now() / 30000);
      const code = (service as any).hotp(secret, step - 1);
      expect(service.verify(secret, code)).toBe(true);
    });

    it('accepte un code du step suivant (tolérance +1)', () => {
      const secret = service.generateSecret();
      const step = Math.floor(Date.now() / 30000);
      const code = (service as any).hotp(secret, step + 1);
      expect(service.verify(secret, code)).toBe(true);
    });

    it('rejette un code aléatoire', () => {
      const secret = service.generateSecret();
      expect(service.verify(secret, '000000')).toBe(false);
    });

    it('rejette un code du step -3 (hors tolérance)', () => {
      const secret = service.generateSecret();
      const step = Math.floor(Date.now() / 30000);
      const code = (service as any).hotp(secret, step - 3);
      expect(service.verify(secret, code)).toBe(false);
    });
  });

  describe('b32Encode / b32Decode', () => {
    it('encode et décode de façon réversible', () => {
      const original = Buffer.from('Hello TOTP 12345');
      const encoded = (service as any).b32Encode(original);
      const decoded = (service as any).b32Decode(encoded);
      expect(decoded.toString('hex')).toBe(original.toString('hex'));
    });

    it("l'encodage ne contient que des caractères Base32 valides", () => {
      const buf = Buffer.from('test');
      const encoded = (service as any).b32Encode(buf);
      expect(encoded).toMatch(/^[A-Z2-7]+$/);
    });
  });
});
