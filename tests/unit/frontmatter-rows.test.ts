import { describe, expect, it } from 'vitest'
import { fromRows, invalidJson, newRow, toRows } from '../../app/utils/frontmatter-rows'

const photo = {
  title: 'The sound of falling water',
  tags: ['Landscape', 'Nature'],
  draft: false,
  camera_settings: { camera: 'X-M5', iso: 100 },
  gallery: [{ src: 'a.jpg' }],
}

describe('frontmatter rows', () => {
  it('flattens nested objects into dotted keys with inferred kinds', () => {
    expect(toRows(photo).map(r => [r.key, r.kind])).toEqual([
      ['title', 'text'],
      ['tags', 'list'],
      ['draft', 'boolean'],
      ['camera_settings.camera', 'text'],
      ['camera_settings.iso', 'number'],
      ['gallery', 'json'],
    ])
  })

  it('round-trips back to the same object', () => {
    expect(fromRows(toRows(photo))).toEqual(photo)
  })

  it('skips rows without a key and coerces values by kind', () => {
    const rows = toRows({ iso: 100 })
    rows[0]!.value = '200' as unknown as number
    const empty = newRow('text')
    const flag = { ...newRow('boolean'), key: 'featured', value: 'true' as unknown as boolean }
    expect(fromRows([...rows, empty, flag])).toEqual({ iso: 200, featured: true })
  })

  it('flags invalid JSON values', () => {
    expect(invalidJson({ ...newRow('json'), value: '{oops' })).toBe(true)
    expect(invalidJson({ ...newRow('json'), value: '[1]' })).toBe(false)
  })
})
