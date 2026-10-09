// Post-traitement : rendu HDR multiéchantillonné → bloom → tone mapping → étalonnage + vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uHurt: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uHurt;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d2 = dot(c, c);
      // aberration chromatique légère sur les bords
      vec2 off = c * d2 * 0.018;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      // virage partiel : ombres violettes, lumières chaudes
      vec3 shadowTint = vec3(0.075, 0.035, 0.14);
      col += shadowTint * pow(clamp(1.0 - l, 0.0, 1.0), 3.0) * 0.9;
      col = mix(col, col * vec3(1.05, 0.99, 0.93), smoothstep(0.5, 1.0, l));
      // saturation et contraste en S
      col = mix(vec3(l), col, 1.14);
      col = clamp(col, 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.32);
      // vignette violette
      float v = smoothstep(0.95, 0.28, length(c * vec2(1.0, 1.15)) * 1.32);
      col *= mix(vec3(0.16, 0.08, 0.26), vec3(1.0), v);
      // coup reçu : bords magenta
      col = mix(col, vec3(1.0, 0.16, 0.5), uHurt * (1.0 - v) * 0.75);
      // grain
      col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.028;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Garde-fou : un seul NaN ou infini dans la scène HDR suffit, une fois étalé par le bloom,
// à noircir tout l'écran sur certains GPU. On le remplace par du noir et on borne le HDR.
const SanitizeShader = {
  name: 'SanitizeShader',
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c));
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, 32.0), 1.0);
    }`,
};

export class Post {
  /** Faux si le post-traitement a été désactivé (`?safe` ou écran noir détecté) : rendu direct. */
  enabled = !new URLSearchParams(location.search).has('safe');
  private checks = 0;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;

  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, msaa: number) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const pr = renderer.getPixelRatio();
    // Cible HDR seulement si le GPU sait y rendre ; sinon 8 bits (bloom moins doux, mais une image).
    const ext = renderer.extensions;
    const hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    const rt = new THREE.WebGLRenderTarget(Math.floor(w * pr), Math.floor(h * pr), {
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: msaa,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.55, 0.96);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number, pr: number): void {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    (this.grade.uniforms.uRes.value as THREE.Vector2).set(w * pr, h * pr);
  }

  render(time: number, hurt: number): void {
    this.grade.uniforms.uTime.value = time;
    this.grade.uniforms.uHurt.value = hurt;
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render();
    // Le fond de la scène n'est jamais noir pur : une image entièrement noire après quelques
    // frames signale un post-traitement que ce GPU ne supporte pas. On bascule en rendu direct.
    if (this.checks < 3 && ++this.frame % 30 === 0) {
      this.checks++;
      if (this.isBlack()) {
        console.warn('[post] image noire détectée : post-traitement désactivé');
        this.enabled = false;
      }
    }
  }

  private frame = 0;

  private isBlack(): boolean {
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.7], [0.5, 0.15], [0.3, 0.8]] as const) {
      gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (px[0] + px[1] + px[2] > 6) return false;
    }
    return true;
  }
}
