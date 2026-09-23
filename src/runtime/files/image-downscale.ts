export interface ImageDownscaleOptions {
  enabled: boolean
  thresholdEdge: number
  thresholdPixels: number
  maxEdge: number
  maxPixels: number
  quality: number
}

export interface ImageSize {
  width: number
  height: number
}

export interface DecodedImage extends ImageSize {
  source: unknown
}

export interface ImageDownscaleDeps {
  decode: (file: File) => Promise<DecodedImage | undefined>
  encode: (image: DecodedImage, size: ImageSize, type: string, quality: number) => Promise<Blob | undefined>
  release: (image: DecodedImage) => void
  readHeader: (file: File, byteLength: number) => Promise<Uint8Array>
}

const DEFAULTS: ImageDownscaleOptions = {
  enabled: true,
  thresholdEdge: 2560,
  thresholdPixels: 20000000,
  maxEdge: 2560,
  maxPixels: 20000000,
  quality: 0.85,
}

const DOWNSCALABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const WEBP_HEADER_BYTES = 21

const WEBP_ANIMATION_FLAG = 0x02

export function resolveImageDownscaleOptions(...overrides: (Partial<ImageDownscaleOptions> | undefined)[]): ImageDownscaleOptions {
  const resolved = { ...DEFAULTS }
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override || {})) {
      if (value !== undefined) {
        resolved[key as keyof ImageDownscaleOptions] = value as never
      }
    }
  }
  return resolved
}

export function isDownscalableImageType(type: string | undefined): boolean {
  return !!type && DOWNSCALABLE_TYPES.includes(type.toLowerCase())
}

export function isAnimatedWebpHeader(bytes: Uint8Array): boolean {
  if (bytes.length < WEBP_HEADER_BYTES) {
    return false
  }
  const fourcc = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4))
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WEBP' || fourcc(12) !== 'VP8X') {
    return false
  }
  return (bytes[20]! & WEBP_ANIMATION_FLAG) !== 0
}

export function getDownscaleTarget(size: ImageSize, options: ImageDownscaleOptions): ImageSize | undefined {
  const longestEdge = Math.max(size.width, size.height)
  const pixels = size.width * size.height
  if (longestEdge <= options.thresholdEdge && pixels <= options.thresholdPixels) {
    return undefined
  }

  const scale = Math.min(options.maxEdge / longestEdge, Math.sqrt(options.maxPixels / pixels))
  if (scale >= 1) {
    return undefined
  }

  const round = (value: number) => Math.max(1, Math.min(options.maxEdge, Math.round(value * scale)))
  let width = round(size.width)
  let height = round(size.height)
  if (width * height > options.maxPixels) {
    width = Math.max(1, Math.floor(size.width * scale))
    height = Math.max(1, Math.floor(size.height * scale))
  }
  return { width, height }
}

export async function downscaleImageFile(file: File, options: ImageDownscaleOptions, deps: ImageDownscaleDeps): Promise<File> {
  if (!options.enabled || !isDownscalableImageType(file.type)) {
    return file
  }

  try {
    if (file.type.toLowerCase() === 'image/webp' && isAnimatedWebpHeader(await deps.readHeader(file, WEBP_HEADER_BYTES))) {
      return file
    }
  }
  catch {
    return file
  }

  let image: DecodedImage | undefined
  try {
    image = await deps.decode(file)
    if (!image) {
      return file
    }
    const target = getDownscaleTarget(image, options)
    if (!target) {
      return file
    }
    const blob = await deps.encode(image, target, file.type, options.quality)
    if (!blob || blob.size >= file.size) {
      return file
    }
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified })
  }
  catch {
    return file
  }
  finally {
    if (image) {
      deps.release(image)
    }
  }
}

async function drawAndEncode(bitmap: ImageBitmap, size: ImageSize, type: string, quality: number): Promise<Blob | undefined> {
  if (typeof OffscreenCanvas === 'function') {
    const offscreen = new OffscreenCanvas(size.width, size.height)
    const offscreenContext = offscreen.getContext('2d')
    if (offscreenContext) {
      offscreenContext.imageSmoothingQuality = 'high'
      offscreenContext.drawImage(bitmap, 0, 0, size.width, size.height)
      return await offscreen.convertToBlob({ type, quality })
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  return await new Promise<Blob | undefined>(resolve => canvas.toBlob(blob => resolve(blob || undefined), type, quality))
}

export function createBrowserImageDownscaleDeps(): ImageDownscaleDeps {
  return {
    async readHeader(file, byteLength) {
      return new Uint8Array(await file.slice(0, byteLength).arrayBuffer())
    },
    async decode(file) {
      if (typeof createImageBitmap !== 'function') {
        return undefined
      }
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { width: bitmap.width, height: bitmap.height, source: bitmap }
    },
    async encode(image, size, type, quality) {
      const bitmap = image.source as ImageBitmap
      let resized: ImageBitmap | undefined
      try {
        resized = await createImageBitmap(bitmap, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' })
      }
      catch {
        resized = undefined
      }
      try {
        return await drawAndEncode(resized || bitmap, size, type, quality)
      }
      finally {
        resized?.close()
      }
    },
    release(image) {
      (image.source as ImageBitmap | undefined)?.close?.()
    },
  }
}
