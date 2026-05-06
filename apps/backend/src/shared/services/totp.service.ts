import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const APP_NAME = 'NoteApp';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return this.b32Encode(crypto.randomBytes(20));
  }

  buildUri(secret: string, email: string): string {
    const label = encodeURIComponent(`${APP_NAME}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=SHA1&digits=6&period=30`;
  }

  async generateQrDataUrl(uri: string): Promise<string> {
    return QRCode.toDataURL(uri);
  }

  verify(secret: string, token: string, window = 1): boolean {
    const step = Math.floor(Date.now() / 30000);
    for (let i = -window; i <= window; i++) {
      if (this.hotp(secret, step + i) === token) return true;
    }
    return false;
  }

  private hotp(secret: string, counter: number): string {
    const key = this.b32Decode(secret);
    const msg = Buffer.alloc(8);
    let c = counter;
    for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
    const h = crypto.createHmac('sha1', key).update(msg).digest();
    const o = h[19] & 0xf;
    const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1_000_000).padStart(6, '0');
  }

  private b32Encode(buf: Buffer): string {
    let bits = 0, val = 0, out = '';
    for (const b of buf) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { bits -= 5; out += BASE32[(val >> bits) & 0x1f]; }
    }
    if (bits > 0) out += BASE32[(val << (5 - bits)) & 0x1f];
    return out;
  }

  private b32Decode(str: string): Buffer {
    const s = str.toUpperCase().replace(/=+$/, '');
    let bits = 0, val = 0;
    const out: number[] = [];
    for (const c of s) {
      const i = BASE32.indexOf(c);
      if (i < 0) continue;
      val = (val << 5) | i; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); }
    }
    return Buffer.from(out);
  }
}
