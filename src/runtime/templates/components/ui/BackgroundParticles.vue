<template>
  <div
    id="particles-container"
    ref="particlesContainer"
  >
    <canvas ref="canvasElement" />
  </div>
</template>

<script setup lang="ts">
// effect from https://codepen.io/DedaloD/pen/PoJGKOb
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

const particlesContainer = useTemplateRef('particlesContainer')
const canvasElement = ref()

type ParticleCanvasContext =
  { gl: WebGLRenderingContext, isWebGL2: false } |
  { gl: WebGL2RenderingContext, isWebGL2: true } |
  undefined

type ParticleRenderingContext = WebGL2RenderingContext | WebGLRenderingContext
type ParticleWebGLMeta = {
  formatRGBA: { internalFormat: GLenum, format: GLenum } | null
  formatRG: { internalFormat: GLenum, format: GLenum } | null
  formatR: { internalFormat: GLenum, format: GLenum } | null
  halfFloatTexType: number
  supportLinearFiltering: boolean
}

type ParticleWebGLWithMeta = {
  gl: ParticleRenderingContext
  ext: ParticleWebGLMeta
}

class ParticleCanvasMetaFactory {
  private readonly canvas: HTMLCanvasElement
  private readonly context: ParticleCanvasContext
  private readonly meta: ParticleWebGLWithMeta

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.context = this.getRenderingContext()
    this.meta = this.getMetaFromContext(this.context)
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    this.canvas = canvas
  }

  getCanvas() {
    return this.canvas
  }

  getMeta() {
    return this.meta
  }

  private getRenderingContext(): ParticleCanvasContext {
    const ops = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
    }

    const gl2: RenderingContext | WebGL2RenderingContext | null = this.canvas.getContext('webgl2', ops)
    const gl: RenderingContext | WebGLRenderingContext | null = this.canvas.getContext('webgl', ops)

    if (gl2 && gl2 instanceof WebGL2RenderingContext) {
      return {
        gl: gl2,
        isWebGL2: true,
      }
    }
    if (gl && gl instanceof WebGLRenderingContext) {
      return {
        gl,
        isWebGL2: false,
      }
    }
  }

  private isRenderTextureFormatSupported(gl: ParticleRenderingContext, internalFormat: number, format: number, type: number): boolean {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      4,
      4,
      0,
      format,
      type,
      null,
    )

    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    )

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    return status === gl.FRAMEBUFFER_COMPLETE
  }

  private getSupportedFormat(
    gl: ParticleRenderingContext,
    internalFormat: GLenum,
    format: GLenum,
    type: number): null | { internalFormat: GLenum, format: GLenum } {
    if (!this.isRenderTextureFormatSupported(gl, internalFormat, format, type)) {
      if (!(gl instanceof WebGL2RenderingContext)) {
        return null
      }
      switch (internalFormat) {
        case gl.R16F:
          return this.getSupportedFormat(gl, gl.RG16F, gl.RG, type)
        case gl.RG16F:
          return this.getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type)
        default:
          return null
      }
    }

    return {
      internalFormat,
      format,
    }
  }

  private getWebGLMeta(gl: WebGLRenderingContext): ParticleWebGLMeta {
    const halfFloat = gl.getExtension('OES_texture_half_float')
    if (!halfFloat) {
      throw Error('Cannot get half float extension')
    }
    const supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear')
    const halfFloatTexType = halfFloat.HALF_FLOAT_OES

    const formatRGBA = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
    const formatRG = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
    const formatR = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)

    return {
      formatRGBA,
      formatRG,
      formatR,
      halfFloatTexType,
      supportLinearFiltering,
    }
  }

  private getWebGL2Meta(gl: WebGL2RenderingContext): ParticleWebGLMeta {
    gl.getExtension('EXT_color_buffer_float')
    const supportLinearFiltering = !!gl.getExtension('OES_texture_float_linear')
    const halfFloatTexType = gl.HALF_FLOAT

    const formatRGBA = this.getSupportedFormat(
      gl,
      gl.RGBA16F,
      gl.RGBA,
      halfFloatTexType,
    )
    const formatRG = this.getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType)
    const formatR = this.getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType)
    return {
      formatRGBA,
      formatRG,
      formatR,
      halfFloatTexType,
      supportLinearFiltering,
    }
  }

  private getMetaFromContext(context: ParticleCanvasContext): ParticleWebGLWithMeta {
    if (!context) {
      throw Error('Cannot get meta from context. Context is undefined.')
    }
    const { gl, isWebGL2 } = context
    gl.clearColor(0.0, 0.0, 0.0, 0)

    return {
      gl,
      ext: isWebGL2 ? this.getWebGL2Meta(gl) : this.getWebGLMeta(gl),
    }
  }
}

class PointerPrototype {
  public id: number = -1
  public x: number = 0
  public y: number = 0
  public dx: number = 0
  public dy: number = 0
  public down: boolean = false
  public moved: boolean = false
  public color: [number, number, number] = [30, 0, 300]
}

class GLProgram {
  public uniforms: {
    [key: string]: WebGLUniformLocation | null
  }

  private program: WebGLProgram
  private gl: ParticleRenderingContext

  constructor(gl: ParticleRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
    this.gl = gl

    this.uniforms = {}
    this.program = gl.createProgram()

    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw gl.getProgramInfoLog(this.program)

    const uniformCount = gl.getProgramParameter(
      this.program,
      gl.ACTIVE_UNIFORMS,
    )
    for (let i = 0; i < uniformCount; i++) {
      const uniformName = gl.getActiveUniform(this.program, i)?.name
      if (!uniformName) {
        continue
      }
      this.uniforms[uniformName] = gl.getUniformLocation(
        this.program,
        uniformName,
      )
    }
  }

  bind() {
    this.gl.useProgram(this.program)
  }
}

type ParticleEffectConfig = {
  TEXTURE_DOWNSAMPLE: number
  DENSITY_DISSIPATION: number
  VELOCITY_DISSIPATION: number
  PRESSURE_DISSIPATION: number
  PRESSURE_ITERATIONS: number
  CURL: number
  SPLAT_RADIUS: number
}

type ParticleShaders = {
  divergenceShader: WebGLShader
  vorticityShader: WebGLShader
  displayShader: WebGLShader
  advectionManualFilteringShader: WebGLShader
  pressureShader: WebGLShader
  gradientSubtractShader: WebGLShader
  clearShader: WebGLShader
  curlShader: WebGLShader
  baseVertexShader: WebGLShader
  splatShader: WebGLShader
  advectionShader: WebGLShader
}

type ParticlePrograms = {
  advectionProgram: GLProgram
  divergenceProgram: GLProgram
  clearProgram: GLProgram
  splatProgram: GLProgram
  displayProgram: GLProgram
  curlProgram: GLProgram
  pressureProgram: GLProgram
  vorticityProgram: GLProgram
  gradientSubtractProgram: GLProgram
}

type FBOType = [WebGLTexture, WebGLFramebuffer, GLenum]
type DoubleFBOType = {
  read: FBOType
  write: FBOType
  swap(): void
}

class ParticleProgram {
  private config: ParticleEffectConfig
  // pointers are for the mouse cursor, or on touch for each touch point
  private pointers: PointerPrototype[] = [new PointerPrototype()]
  private glMeta: ParticleWebGLWithMeta
  private shaders: ParticleShaders
  private textureWidth: number = 0
  private textureHeight: number = 0
  private density?: DoubleFBOType
  private velocity?: DoubleFBOType
  private divergence?: FBOType
  private curl?: FBOType
  private pressure?: DoubleFBOType
  private programs: ParticlePrograms
  private readonly blit: (destination: WebGLFramebuffer | null) => void
  private stopped: boolean = false
  private lastTime: number = 0
  private readonly canvas: HTMLCanvasElement
  private container?: HTMLElement
  private splatStack: number[] = []

  constructor(config: ParticleEffectConfig, glMeta: ParticleWebGLWithMeta, canvas: HTMLCanvasElement) {
    this.config = config
    this.glMeta = glMeta
    this.canvas = canvas
    this.shaders = this.getShaders()
    this.initFrameBuffers()
    this.programs = this.createPrograms()
    this.blit = this.createBlitFn()

    this.updateAnimation = this.updateAnimation.bind(this)
    this.mousemove = this.mousemove.bind(this)
    this.touchmove = this.touchmove.bind(this)
    this.touchstart = this.touchstart.bind(this)
    this.touchend = this.touchend.bind(this)
    this.mouseleave = this.mouseleave.bind(this)
  }

  private getShaders(): ParticleShaders {
    const { gl } = this.glMeta

    const baseVertexShader = this.compileShader(
      gl.VERTEX_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`,
    )

    const clearShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`,
    )

    const displayShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`,
    )

    const splatShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`,
    )

    const advectionManualFilteringShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (in sampler2D sam, in vec2 p) {
        vec4 st;
        st.xy = floor(p - 0.5) + 0.5;
        st.zw = st.xy + 1.0;
        vec4 uv = st * texelSize.xyxy;
        vec4 a = texture2D(sam, uv.xy);
        vec4 b = texture2D(sam, uv.zy);
        vec4 c = texture2D(sam, uv.xw);
        vec4 d = texture2D(sam, uv.zw);
        vec2 f = p - st.xy;
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main () {
        vec2 coord = gl_FragCoord.xy - dt * texture2D(uVelocity, vUv).xy;
        gl_FragColor = dissipation * bilerp(uSource, coord);
        gl_FragColor.a = 1.0;
    }
`,
    )

    const advectionShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform float dt;
    uniform float dissipation;

    void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        gl_FragColor = dissipation * texture2D(uSource, coord);
        gl_FragColor.a = 1.0;
    }
`,
    )

    const divergenceShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;

    vec2 sampleVelocity (in vec2 uv) {
        vec2 multiplier = vec2(1.0, 1.0);
        if (uv.x < 0.0) { uv.x = 0.0; multiplier.x = -1.0; }
        if (uv.x > 1.0) { uv.x = 1.0; multiplier.x = -1.0; }
        if (uv.y < 0.0) { uv.y = 0.0; multiplier.y = -1.0; }
        if (uv.y > 1.0) { uv.y = 1.0; multiplier.y = -1.0; }
        return multiplier * texture2D(uVelocity, uv).xy;
    }

    void main () {
        float L = sampleVelocity(vL).x;
        float R = sampleVelocity(vR).x;
        float T = sampleVelocity(vT).y;
        float B = sampleVelocity(vB).y;
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`,
    )

    const curlShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
    }
`,
    )

    const vorticityShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = vec2(abs(T) - abs(B), 0.0);
        force *= 1.0 / length(force + 0.00001) * curl * C;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
    }
`,
    )

    const pressureShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    vec2 boundary (in vec2 uv) {
        uv = min(max(uv, 0.0), 1.0);
        return uv;
    }

    void main () {
        float L = texture2D(uPressure, boundary(vL)).x;
        float R = texture2D(uPressure, boundary(vR)).x;
        float T = texture2D(uPressure, boundary(vT)).x;
        float B = texture2D(uPressure, boundary(vB)).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`,
    )

    const gradientSubtractShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      `
    precision highp float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    vec2 boundary (in vec2 uv) {
        uv = min(max(uv, 0.0), 1.0);
        return uv;
    }

    void main () {
        float L = texture2D(uPressure, boundary(vL)).x;
        float R = texture2D(uPressure, boundary(vR)).x;
        float T = texture2D(uPressure, boundary(vT)).x;
        float B = texture2D(uPressure, boundary(vB)).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`,
    )

    return {
      baseVertexShader,
      clearShader,
      displayShader,
      splatShader,
      advectionManualFilteringShader,
      advectionShader,
      divergenceShader,
      curlShader,
      vorticityShader,
      pressureShader,
      gradientSubtractShader,
    }
  }

  private compileShader(type: GLenum, source: string) {
    const { gl } = this.glMeta
    const shader = gl.createShader(type)
    if (!shader) {
      throw Error(`Cannot create shader type ${type}`)
    }

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(shader)
    }

    return shader
  }

  private initFrameBuffers() {
    const { gl, ext } = this.glMeta

    this.textureWidth = gl.drawingBufferWidth >> this.config.TEXTURE_DOWNSAMPLE
    this.textureHeight = gl.drawingBufferHeight >> this.config.TEXTURE_DOWNSAMPLE

    const texType = ext.halfFloatTexType
    const rgba = ext.formatRGBA
    const rg = ext.formatRG
    const r = ext.formatR

    if (rgba) {
      this.density = this.createDoubleFBO(
        2,
        rgba.internalFormat,
        rgba.format,
        texType,
        ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST,
      )
    }

    if (rg) {
      this.velocity = this.createDoubleFBO(
        0,
        rg.internalFormat,
        rg.format,
        texType,
        ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST,
      )
    }

    if (r) {
      this.divergence = this.createFBO(
        4,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      )
      this.curl = this.createFBO(
        5,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      )
      this.pressure = this.createDoubleFBO(
        6,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      )
    }
  }

  private createFBO(texId: GLenum, internalFormat: GLenum, format: GLenum, type: GLenum, param: GLint): FBOType {
    const { gl } = this.glMeta
    const w = this.textureWidth
    const h = this.textureHeight

    gl.activeTexture(gl.TEXTURE0 + texId)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      w,
      h,
      0,
      format,
      type,
      null,
    )

    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    )
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)

    return [texture, fbo, texId]
  }

  private createDoubleFBO(texId: GLenum, internalFormat: GLenum, format: GLenum, type: GLenum, param: GLint): DoubleFBOType {
    let fbo1 = this.createFBO(texId, internalFormat, format, type, param)
    let fbo2 = this.createFBO(texId + 1, internalFormat, format, type, param)

    return {
      get read() {
        return fbo1
      },
      get write() {
        return fbo2
      },
      swap() {
        const temp = fbo1
        fbo1 = fbo2
        fbo2 = temp
      },
    }
  }

  private createPrograms() {
    const { gl, ext } = this.glMeta
    const clearProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.clearShader)
    const displayProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.displayShader)
    const splatProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.splatShader)
    const advectionProgram = new GLProgram(
      gl,
      this.shaders.baseVertexShader,
      ext.supportLinearFiltering
        ? this.shaders.advectionShader
        : this.shaders.advectionManualFilteringShader,
    )
    const divergenceProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.divergenceShader)
    const curlProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.curlShader)
    const vorticityProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.vorticityShader)
    const pressureProgram = new GLProgram(gl, this.shaders.baseVertexShader, this.shaders.pressureShader)
    const gradientSubtractProgram = new GLProgram(
      gl,
      this.shaders.baseVertexShader,
      this.shaders.gradientSubtractShader,
    )
    return {
      clearProgram,
      displayProgram,
      splatProgram,
      advectionProgram,
      divergenceProgram,
      curlProgram,
      vorticityProgram,
      pressureProgram,
      gradientSubtractProgram,
    }
  }

  private createBlitFn() {
    const { gl } = this.glMeta
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
      gl.STATIC_DRAW,
    )
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2, 0, 2, 3]),
      gl.STATIC_DRAW,
    )
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(0)

    return (destination: WebGLFramebuffer | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination)
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    }
  }

  private updateAnimation() {
    if (this.stopped) {
      return
    }

    const { gl } = this.glMeta

    // todo: check why we seem to need to resize canvas on every animation frame...
    this.resizeCanvas()

    const dt = Math.min((Date.now() - this.lastTime) / 1000, 0.016)
    this.lastTime = Date.now()

    gl.viewport(0, 0, this.textureWidth, this.textureHeight)

    const nextSplatCount = this.splatStack.pop()
    nextSplatCount && this.multipleSplats(nextSplatCount)

    if (this.velocity) {
      this.programs.advectionProgram.bind()
      gl.uniform2f(
        this.programs.advectionProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.advectionProgram.uniforms.uVelocity, this.velocity.read[2])
      gl.uniform1i(this.programs.advectionProgram.uniforms.uSource, this.velocity.read[2])
      gl.uniform1f(this.programs.advectionProgram.uniforms.dt, dt)
      gl.uniform1f(
        this.programs.advectionProgram.uniforms.dissipation,
        this.config.VELOCITY_DISSIPATION,
      )
      this.blit(this.velocity.write[1])
      this.velocity.swap()

      if (this.density) {
        gl.uniform1i(this.programs.advectionProgram.uniforms.uVelocity, this.velocity.read[2])
        gl.uniform1i(this.programs.advectionProgram.uniforms.uSource, this.density.read[2])
        gl.uniform1f(
          this.programs.advectionProgram.uniforms.dissipation,
          this.config.DENSITY_DISSIPATION,
        )
        this.blit(this.density.write[1])
        this.density.swap()
      }
    }

    for (let i = 0; i < this.pointers.length; i++) {
      const pointer = this.pointers[i]
      if (pointer.moved) {
        this.splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color)
        pointer.moved = false
      }
    }

    if (this.velocity && this.curl) {
      this.programs.curlProgram.bind()
      gl.uniform2f(
        this.programs.curlProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.curlProgram.uniforms.uVelocity, this.velocity.read[2])
      this.blit(this.curl[1])
    }

    if (this.velocity && this.curl) {
      this.programs.vorticityProgram.bind()
      gl.uniform2f(
        this.programs.vorticityProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.vorticityProgram.uniforms.uVelocity, this.velocity.read[2])
      gl.uniform1i(this.programs.vorticityProgram.uniforms.uCurl, this.curl[2])
      gl.uniform1f(this.programs.vorticityProgram.uniforms.curl, this.config.CURL)
      gl.uniform1f(this.programs.vorticityProgram.uniforms.dt, dt)
      this.blit(this.velocity.write[1])
      this.velocity.swap()
    }

    if (this.velocity && this.divergence) {
      this.programs.divergenceProgram.bind()
      gl.uniform2f(
        this.programs.divergenceProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.divergenceProgram.uniforms.uVelocity, this.velocity.read[2])
      this.blit(this.divergence[1])
    }

    if (this.pressure) {
      this.programs.clearProgram.bind()
      const pressureTexId = this.pressure.read[2]
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      gl.bindTexture(gl.TEXTURE_2D, this.pressure.read[0])
      gl.uniform1i(this.programs.clearProgram.uniforms.uTexture, pressureTexId)
      gl.uniform1f(this.programs.clearProgram.uniforms.value, this.config.PRESSURE_DISSIPATION)
      this.blit(this.pressure.write[1])
      this.pressure.swap()
    }

    if (this.divergence && this.pressure) {
      this.programs.pressureProgram.bind()
      gl.uniform2f(
        this.programs.pressureProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.pressureProgram.uniforms.uDivergence, this.divergence[2])
      const pressureTexId = this.pressure.read[2]
      gl.uniform1i(this.programs.pressureProgram.uniforms.uPressure, pressureTexId)
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
        gl.bindTexture(gl.TEXTURE_2D, this.pressure.read[0])
        this.blit(this.pressure.write[1])
        this.pressure.swap()
      }
    }

    if (this.pressure && this.velocity) {
      this.programs.gradientSubtractProgram.bind()
      gl.uniform2f(
        this.programs.gradientSubtractProgram.uniforms.texelSize,
        1.0 / this.textureWidth,
        1.0 / this.textureHeight,
      )
      gl.uniform1i(this.programs.gradientSubtractProgram.uniforms.uPressure, this.pressure.read[2])
      gl.uniform1i(this.programs.gradientSubtractProgram.uniforms.uVelocity, this.velocity.read[2])
      this.blit(this.velocity.write[1])
      this.velocity.swap()
    }

    if (this.density) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      this.programs.displayProgram.bind()
      gl.uniform1i(this.programs.displayProgram.uniforms.uTexture, this.density.read[2])
      this.blit(null)
    }

    !this.stopped && requestAnimationFrame(this.updateAnimation)
  }

  private resizeCanvas() {
    if (
      this.canvas.width !== this.canvas.clientWidth
      || this.canvas.height !== this.canvas.clientHeight
    ) {
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
      this.initFrameBuffers()
    }
  }

  private splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
    if (!this.velocity || !this.density) {
      return
    }
    const { gl } = this.glMeta
    this.programs.splatProgram.bind()
    gl.uniform1i(this.programs.splatProgram.uniforms.uTarget, this.velocity.read[2])
    gl.uniform1f(
      this.programs.splatProgram.uniforms.aspectRatio,
      this.canvas.width / this.canvas.height,
    )
    gl.uniform2f(
      this.programs.splatProgram.uniforms.point,
      x / this.canvas.width,
      1.0 - y / this.canvas.height,
    )
    gl.uniform3f(this.programs.splatProgram.uniforms.color, dx, -dy, 1.0)
    gl.uniform1f(this.programs.splatProgram.uniforms.radius, this.config.SPLAT_RADIUS)
    this.blit(this.velocity.write[1])
    this.velocity.swap()

    gl.uniform1i(this.programs.splatProgram.uniforms.uTarget, this.density.read[2])
    gl.uniform3f(
      this.programs.splatProgram.uniforms.color,
      color[0] * 0.3,
      color[1] * 0.3,
      color[2] * 0.3,
    )
    this.blit(this.density.write[1])
    this.density.swap()
  }

  private mousemove(e: MouseEvent) {
    if (!this.container) {
      return
    }
    const yOffset = this.container.getBoundingClientRect().top
    const eventClientY = e.clientY - yOffset
    this.pointers[0].moved = this.pointers[0].down
    this.pointers[0].dx = (e.clientX - this.pointers[0].x) * 10.0
    this.pointers[0].dy = (eventClientY - this.pointers[0].y) * 10.0
    this.pointers[0].x = e.clientX
    this.pointers[0].y = eventClientY

    this.pointers[0].down = true
    this.pointers[0].color = [
      Math.random() + 0.2,
      Math.random() + 0.2,
      Math.random() + 0.2,
    ]
  }

  private touchmove(e: TouchEvent) {
    const touches = e.targetTouches
    for (let i = 0; i < touches.length; i++) {
      const pointer = this.pointers[i]
      pointer.moved = pointer.down
      pointer.dx = (touches[i].clientX - pointer.x) * 10.0
      pointer.dy = (touches[i].clientY - pointer.y) * 10.0
      pointer.x = touches[i].clientX
      pointer.y = touches[i].clientY
    }
  }

  private touchstart(e: TouchEvent) {
    const touches = e.targetTouches
    for (let i = 0; i < touches.length; i++) {
      if (i >= this.pointers.length) this.pointers.push(new PointerPrototype())

      this.pointers[i].id = touches[i].identifier
      this.pointers[i].down = true
      this.pointers[i].x = touches[i].clientX
      this.pointers[i].y = touches[i].clientY
      this.pointers[i].color = [
        Math.random() + 0.2,
        Math.random() + 0.2,
        Math.random() + 0.2,
      ]
    }
  }

  private touchend(e: TouchEvent) {
    const touches = e.changedTouches
    for (let i = 0; i < touches.length; i++)
      for (let j = 0; j < this.pointers.length; j++)
        if (touches[i].identifier === this.pointers[j].id) this.pointers[j].down = false
  }

  private mouseleave() {
    this.pointers[0].down = false
  }

  private multipleSplats(amount: number) {
    this.initFrameBuffers()
    for (let i = 0; i < amount; i++) {
      const color: [number, number, number] = [
        Math.random() * 10,
        Math.random() * 10,
        Math.random() * 10,
      ]
      const x = this.canvas.width * Math.random()
      const y = this.canvas.height * Math.random()
      const dx = 1000 * (Math.random() - 0.5)
      const dy = 1000 * (Math.random() - 0.5)
      this.splat(x, y, dx, dy, color)
    }
  }

  stop() {
    this.stopped = true
    const { gl } = this.glMeta

    const layout = document.body
    layout.removeEventListener('mousemove', this.mousemove)
    layout.removeEventListener('touchmove', this.touchmove)
    layout.removeEventListener('touchstart', this.touchstart)
    layout.removeEventListener('touchend', this.touchend)
    // layout.removeEventListener('mousedown', this.click)
    window.removeEventListener('mouseleave', this.mouseleave)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  start(container: HTMLElement) {
    this.container = container
    this.stopped = false
    this.lastTime = Date.now()
    requestAnimationFrame(this.updateAnimation)

    const layout = document.body
    layout.addEventListener('mousemove', this.mousemove)
    layout.addEventListener('touchmove', this.touchmove, { passive: true })
    layout.addEventListener('touchstart', this.touchstart, { passive: true })
    layout.addEventListener('touchend', this.touchend)
    // layout.addEventListener('mousedown', this.click)
    window.addEventListener('mouseleave', this.mouseleave)

    this.multipleSplats(Math.round(Math.random() * 20) + 5)
  }
}

let particles: ParticleProgram | undefined

onMounted(() => {
  const metaFactory = new ParticleCanvasMetaFactory(canvasElement.value)

  const config: ParticleEffectConfig = {
    TEXTURE_DOWNSAMPLE: 2,
    DENSITY_DISSIPATION: 0.98,
    VELOCITY_DISSIPATION: 0.99,
    PRESSURE_DISSIPATION: 0.8,
    PRESSURE_ITERATIONS: 25,
    CURL: 35,
    SPLAT_RADIUS: 0.002,
  }

  particles = new ParticleProgram(config, metaFactory.getMeta(), metaFactory.getCanvas())
  if (particlesContainer.value) particles.start(particlesContainer.value)
})
onBeforeUnmount(() => {
  particles?.stop()
})
</script>

<style>
#particles-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
