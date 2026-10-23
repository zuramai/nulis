import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(secret: string) {
  if (!secret || secret.length < 32)
    throw new Error('NUXT_ENCRYPTION_KEY must be at least 32 characters')
  return createHash('sha256').update(secret).digest()
}

/** AES-256-GCM; output is `iv.tag.ciphertext` in base64url. */
export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.')
}

export function decrypt(payload: string, secret: string): string {
  const [iv, tag, data] = payload.split('.').map(part => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !data)
    throw new Error('Malformed encrypted payload')
  const decipher = createDecipheriv('aes-256-gcm', key(secret), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
