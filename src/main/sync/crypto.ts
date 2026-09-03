import crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

export function generatePairingCode(): string {
  // Generate a random 6-digit code formatted as "123 456"
  const val = crypto.randomInt(100000, 999999);
  return `${val.toString().slice(0, 3)} ${val.toString().slice(3)}`;
}

export function generateRandomSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function deriveSharedKey(sharedSecret: string, salt: string = 'xclip-lan-sync-v1'): Buffer {
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(sharedSecret, 'utf-8'),
    Buffer.from(salt, 'utf-8'),
    Buffer.from('aes-256-gcm-key', 'utf-8'),
    32
  );
  return Buffer.from(derived);
}

export function encryptPayload(data: any, sharedSecret: string): EncryptedPayload {
  const key = deriveSharedKey(sharedSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const json = JSON.stringify(data);
  let ciphertext = cipher.update(json, 'utf-8', 'base64');
  ciphertext += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    auth_tag: authTag,
  };
}

export function decryptPayload(payload: EncryptedPayload, sharedSecret: string): any {
  const key = deriveSharedKey(sharedSecret);
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.auth_tag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');

  return JSON.parse(decrypted);
}
