// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import {
  downscaleImageFile,
  getDownscaleTarget,
  isAnimatedWebpHeader,
  isDownscalableImageType,
  resolveImageDownscaleOptions,
} from '#cwa/files/image-downscale'
import type { DecodedImage, ImageDownscaleDeps } from '#cwa/files/image-downscale'

function webpHeader({ fourcc = 'WEBP', chunk = 'VP8 ', flags = 0x00, riff = 'RIFF' } = {}) {
  const bytes = new Uint8Array(21)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      bytes[offset + i] = text.charCodeAt(i)
    }
  }
  write(0, riff)
  write(8, fourcc)
  write(12, chunk)
  bytes[20] = flags
  return bytes
}

function createDeps(overrides: Partial<ImageDownscaleDeps> = {}): ImageDownscaleDeps {
  return {
    decode: vi.fn(async () => ({ width: 8000, height: 6000, source: 'bitmap' } as DecodedImage)),
    encode: vi.fn(async () => new Blob(['small'], { type: 'image/jpeg' })),
    release: vi.fn(),
    readHeader: vi.fn(async () => webpHeader()),
    ...overrides,
  }
}

function createFile(type: string, name = 'photo.jpg', size = 5000) {
  return new File(['x'.repeat(size)], name, { type, lastModified: 1234567890 })
}

describe('resolveImageDownscaleOptions', () => {
  test('returns the built-in defaults when nothing is configured', () => {
    expect(resolveImageDownscaleOptions()).toEqual({
      enabled: true,
      thresholdEdge: 2560,
      thresholdPixels: 20000000,
      maxEdge: 2560,
      maxPixels: 20000000,
      quality: 0.85,
    })
  })

  test('a module default replaces only the values it sets', () => {
    expect(resolveImageDownscaleOptions({ maxEdge: 1920 })).toEqual({
      enabled: true,
      thresholdEdge: 2560,
      thresholdPixels: 20000000,
      maxEdge: 1920,
      maxPixels: 20000000,
      quality: 0.85,
    })
  })

  test('a per-call option overrides the module default', () => {
    const resolved = resolveImageDownscaleOptions({ maxEdge: 1920, quality: 0.7 }, { maxEdge: 4096 })
    expect(resolved.maxEdge).toBe(4096)
    expect(resolved.quality).toBe(0.7)
  })

  test('a per-call option can switch it off for one field while it is on globally', () => {
    expect(resolveImageDownscaleOptions({ enabled: true }, { enabled: false }).enabled).toBe(false)
  })

  test('a module default can switch it off globally', () => {
    expect(resolveImageDownscaleOptions({ enabled: false }).enabled).toBe(false)
  })

  test('an undefined value does not replace a configured one', () => {
    expect(resolveImageDownscaleOptions({ maxEdge: 1920 }, { maxEdge: undefined }).maxEdge).toBe(1920)
  })
})

describe('isDownscalableImageType', () => {
  test.each(['image/jpeg', 'image/png', 'image/webp'])('%s can be re-encoded', (type) => {
    expect(isDownscalableImageType(type)).toBe(true)
  })

  test.each(['image/svg+xml', 'image/gif', 'image/avif', 'application/pdf', 'video/mp4', '', undefined])('%s is left alone', (type) => {
    expect(isDownscalableImageType(type)).toBe(false)
  })

  test('the type is matched without regard to case', () => {
    expect(isDownscalableImageType('IMAGE/JPEG')).toBe(true)
  })
})

describe('isAnimatedWebpHeader', () => {
  test('a VP8X header with the ANIM flag set is animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ chunk: 'VP8X', flags: 0x02 }))).toBe(true)
  })

  test('a VP8X header with other flags but not ANIM is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ chunk: 'VP8X', flags: 0x10 }))).toBe(false)
  })

  test('a plain lossy webp is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ chunk: 'VP8 ' }))).toBe(false)
  })

  test('a lossless webp is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ chunk: 'VP8L' }))).toBe(false)
  })

  test('a RIFF container that is not webp is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ fourcc: 'AVI ', chunk: 'VP8X', flags: 0x02 }))).toBe(false)
  })

  test('a file that is not RIFF at all is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ riff: '\u0089PNG', chunk: 'VP8X', flags: 0x02 }))).toBe(false)
  })

  test('a header too short to hold the flags byte is not animated', () => {
    expect(isAnimatedWebpHeader(webpHeader({ chunk: 'VP8X', flags: 0x02 }).subarray(0, 20))).toBe(false)
  })
})

describe('getDownscaleTarget', () => {
  const options = resolveImageDownscaleOptions()

  test('an image inside both thresholds is not resized', () => {
    expect(getDownscaleTarget({ width: 1600, height: 1200 }, options)).toBeUndefined()
  })

  test('an image exactly on the edge threshold is not resized', () => {
    expect(getDownscaleTarget({ width: 2560, height: 1440 }, options)).toBeUndefined()
  })

  test('a landscape photo over the edge threshold keeps its aspect ratio', () => {
    expect(getDownscaleTarget({ width: 8000, height: 6000 }, options)).toEqual({ width: 2560, height: 1920 })
  })

  test('a portrait photo is scaled on its longest edge', () => {
    expect(getDownscaleTarget({ width: 6000, height: 8000 }, options)).toEqual({ width: 1920, height: 2560 })
  })

  test('a panorama is scaled by its long edge, not squared off', () => {
    expect(getDownscaleTarget({ width: 20000, height: 1000 }, options)).toEqual({ width: 2560, height: 128 })
  })

  test('an extreme aspect ratio never produces a zero edge', () => {
    expect(getDownscaleTarget({ width: 30000, height: 2 }, options)).toEqual({ width: 2560, height: 1 })
  })

  test('the pixel rule triggers and binds when the edge rule is relaxed', () => {
    const relaxed = resolveImageDownscaleOptions({ thresholdEdge: 40000, maxEdge: 40000 })
    const target = getDownscaleTarget({ width: 8000, height: 6000 }, relaxed)!
    expect(target.width * target.height).toBeLessThanOrEqual(20000000)
    expect(target.width / target.height).toBeCloseTo(8000 / 6000, 2)
    expect(target.width).toBeGreaterThan(5000)
  })

  test('an image under the pixel threshold with a relaxed edge rule is left alone', () => {
    const relaxed = resolveImageDownscaleOptions({ thresholdEdge: 40000, maxEdge: 40000 })
    expect(getDownscaleTarget({ width: 4000, height: 3000 }, relaxed)).toBeUndefined()
  })

  test('an image that qualifies on the threshold but already fits the target is not resized', () => {
    const lowThreshold = resolveImageDownscaleOptions({ thresholdPixels: 1000000, maxPixels: 20000000, thresholdEdge: 4000, maxEdge: 4000 })
    expect(getDownscaleTarget({ width: 1500, height: 1000 }, lowThreshold)).toBeUndefined()
  })
})

describe('downscaleImageFile', () => {
  const options = resolveImageDownscaleOptions()

  test('an image over the threshold is replaced by the re-encoded blob, keeping name, type and timestamp', async () => {
    const deps = createDeps()
    const file = createFile('image/jpeg')
    const result = await downscaleImageFile(file, options, deps)
    expect(result).not.toBe(file)
    expect(result.name).toBe('photo.jpg')
    expect(result.type).toBe('image/jpeg')
    expect(result.lastModified).toBe(1234567890)
    expect(result.size).toBe(5)
    expect(deps.encode).toHaveBeenCalledWith(
      { width: 8000, height: 6000, source: 'bitmap' },
      { width: 2560, height: 1920 },
      'image/jpeg',
      0.85,
    )
    expect(deps.release).toHaveBeenCalledOnce()
  })

  test('a png is re-encoded as a png so transparency survives', async () => {
    const deps = createDeps({ encode: vi.fn(async () => new Blob(['tiny'], { type: 'image/png' })) })
    const result = await downscaleImageFile(createFile('image/png', 'logo.png'), options, deps)
    expect(result.type).toBe('image/png')
    expect(deps.encode).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'image/png', 0.85)
  })

  test('the configured quality is passed to the encoder', async () => {
    const deps = createDeps()
    await downscaleImageFile(createFile('image/jpeg'), resolveImageDownscaleOptions({ quality: 0.6 }), deps)
    expect(deps.encode).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'image/jpeg', 0.6)
  })

  test('the original is uploaded when the re-encoded file is not smaller', async () => {
    const deps = createDeps({ encode: vi.fn(async () => new Blob(['x'.repeat(5000)], { type: 'image/png' })) })
    const file = createFile('image/png', 'palette.png')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.release).toHaveBeenCalledOnce()
  })

  test('an image already inside the thresholds is uploaded untouched and never re-encoded', async () => {
    const deps = createDeps({ decode: vi.fn(async () => ({ width: 1000, height: 800, source: 'bitmap' })) })
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.encode).not.toHaveBeenCalled()
    expect(deps.release).toHaveBeenCalledOnce()
  })

  test('nothing is decoded when downscaling is switched off', async () => {
    const deps = createDeps()
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, resolveImageDownscaleOptions({ enabled: false }), deps)).toBe(file)
    expect(deps.decode).not.toHaveBeenCalled()
  })

  test.each(['image/svg+xml', 'image/gif', 'application/pdf'])('%s is uploaded untouched and never decoded', async (type) => {
    const deps = createDeps()
    const file = createFile(type, 'asset')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.decode).not.toHaveBeenCalled()
  })

  test('an animated webp is uploaded untouched and never decoded', async () => {
    const deps = createDeps({ readHeader: vi.fn(async () => webpHeader({ chunk: 'VP8X', flags: 0x02 })) })
    const file = createFile('image/webp', 'loop.webp')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.decode).not.toHaveBeenCalled()
  })

  test('only the webp header bytes are read to detect animation', async () => {
    const deps = createDeps()
    const file = createFile('image/webp', 'still.webp')
    await downscaleImageFile(file, options, deps)
    expect(deps.readHeader).toHaveBeenCalledWith(file, 21)
  })

  test('a still webp is downscaled', async () => {
    const deps = createDeps()
    const result = await downscaleImageFile(createFile('image/webp', 'still.webp'), options, deps)
    expect(result.type).toBe('image/webp')
    expect(deps.decode).toHaveBeenCalledOnce()
  })

  test('the header is not read for a type that cannot be animated', async () => {
    const deps = createDeps()
    await downscaleImageFile(createFile('image/jpeg'), options, deps)
    expect(deps.readHeader).not.toHaveBeenCalled()
  })

  test('the original is uploaded when the image cannot be decoded', async () => {
    const deps = createDeps({ decode: vi.fn(async () => undefined) })
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.encode).not.toHaveBeenCalled()
  })

  test('the original is uploaded when the encoder produces nothing', async () => {
    const deps = createDeps({ encode: vi.fn(async () => undefined) })
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
  })

  test('a decode failure uploads the original instead of rejecting', async () => {
    const deps = createDeps({ decode: vi.fn(async () => {
      throw new Error('no canvas')
    }) })
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
  })

  test('an encode failure uploads the original and still releases the image', async () => {
    const deps = createDeps({ encode: vi.fn(async () => {
      throw new Error('tainted canvas')
    }) })
    const file = createFile('image/jpeg')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.release).toHaveBeenCalledOnce()
  })

  test('a header read failure falls back to uploading the original webp', async () => {
    const deps = createDeps({ readHeader: vi.fn(async () => {
      throw new Error('unreadable')
    }) })
    const file = createFile('image/webp', 'still.webp')
    expect(await downscaleImageFile(file, options, deps)).toBe(file)
    expect(deps.decode).not.toHaveBeenCalled()
  })
})
