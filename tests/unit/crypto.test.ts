import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from '../../server/utils/crypto'

const secret = 'a-very-secret-key-that-is-long-enough-123'

describe('token encryption', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encrypt('gho_token', secret)
    const b = encrypt('gho_token', secret)
    expect(a).not.toBe(b)
    expect(decrypt(a, secret)).toBe('gho_token')
  })

  it('rejects tampered payloads and wrong keys', () => {
    const payload = encrypt('gho_token', secret)
    const [iv, tag, data] = payload.split('.')
    const flipped = `${iv}.${tag}.${data!.slice(0, -2)}AA`
    expect(() => decrypt(flipped, secret)).toThrow()
    expect(() => decrypt(payload, `${secret}-other`)).toThrow()
  })

  it('requires a long enough key', () => {
    expect(() => encrypt('x', 'short')).toThrow(/32 characters/)
  })
})
