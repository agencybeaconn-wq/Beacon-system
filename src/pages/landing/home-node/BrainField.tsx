/**
 * BrainField — cérebro 3D procedural em nuvem de nano-quadrados (ref. Dala).
 *
 * P1: geometria 3D REAL — dois hemisférios sobre elipsoide anatômico com
 * fissura central no topo, dobras (giros) como relevo serpenteando a
 * SUPERFÍCIE 3D, cerebelo estriado atrás/embaixo e tronco descendo.
 * Rotação 3D contínua + inclinação seguindo o mouse, projeção em
 * perspectiva, luz direcional + rim. Nano-quadrados vazados.
 *
 * Atos de scroll preservados: direita -> desconstrói/remonta esquerda ->
 * rede neural. Fixo atrás do site; prefers-reduced-motion = frame estático.
 */
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Geometry } from 'ogl';
import brainCloud from './brain-cloud.json';

// ─── nuvem de superfície do cérebro humano ──────────────────────────────────
// Origem: modelo 3D "human-brain" de Yash_Dandavate (Sketchfab, CC BY 4.0).
// Pré-processado offline: 36k pontos amostrados POR ÁREA NA SUPERFÍCIE da
// malha (nada de interior), normais reais e "cavity" (crista vs sulco) medido
// contra o envelope suave — é o cavity que desenha os giros.
// Eixos já em espaço de tela: x = frente(-)/trás(+), y = cima/baixo,
// z = profundidade. Empacotado Int16/Int8/Uint8 em base64.
function decodeB64(s: string) {
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
}

function buildBrainCloud() {
    const src = brainCloud as { n: number; pos: string; nrm: string; br: string; hu?: string };
    const posB = decodeB64(src.pos);
    const pos = new Int16Array(posB.buffer, posB.byteOffset, src.n * 3);
    const nrmB = decodeB64(src.nrm);
    const nrm = new Int8Array(nrmB.buffer, nrmB.byteOffset, src.n * 3);
    const br = decodeB64(src.br);
    const hu = decodeB64((src as any).hu || '');
    const trr = decodeB64((src as any).tr || '');

    const pts: { p: [number, number, number]; n: [number, number, number]; bright: number; hue: number; tier: number; seed: number }[] = [];
    for (let i = 0; i < src.n; i++) {
        pts.push({
            p: [pos[i * 3] / 32000, pos[i * 3 + 1] / 32000, pos[i * 3 + 2] / 32000],
            n: [nrm[i * 3] / 127, nrm[i * 3 + 1] / 127, nrm[i * 3 + 2] / 127],
            bright: br[i] / 255,
            hue: hu.length ? hu[i] : 0,
            tier: trr.length ? trr[i] : 0,
            seed: Math.random(),
        });
    }
    return pts;
}

const vertexBrain = `
attribute vec3 position;
attribute vec3 aNormal;
attribute vec3 aDir;
attribute vec2 aWeb;
attribute float aKind;
attribute float aRand;
attribute float aShape;
attribute float aBright;
attribute float aHue;
attribute float aTier;

uniform float uTime;
uniform float uFlip;
uniform float uWeb;
uniform float uAspect;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform vec2 uTilt;
uniform float uPx;
uniform float uOffX;
uniform float uOffY;
uniform float uScaleMul;

varying float vHue;
varying float vTier;
varying float vCav;     // 0 = fundo do sulco, 1 = crista
varying float vLight;   // difusa + rim + especular
varying float vRot;
varying float vRand;
varying float vFres;    // contorno (fresnel) — fecha a silhueta
varying float vDepth;   // 0 = perto, 1 = longe (névoa atmosférica)
varying float vFade;    // desconstrução / rede neural

void main() {
  vec3 p = position;
  vec3 n = aNormal;

  // pose 3/4: de frente o bastante pra ler a fissura entre os hemisférios
  float yaw = 0.72 + sin(uTime * 0.18) * 0.09 + uTilt.x;
  float pitch = 0.24 + sin(uTime * 0.13 + 1.0) * 0.05 + uTilt.y;
  float cy = cos(yaw), sy = sin(yaw);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  n = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
  float cxp = cos(pitch), sxp = sin(pitch);
  p = vec3(p.x, cxp * p.y - sxp * p.z, sxp * p.y + cxp * p.z);
  n = vec3(n.x, cxp * n.y - sxp * n.z, sxp * n.y + cxp * n.z);

  float mirror = smoothstep(0.34, 0.66, uFlip);
  p.x = mix(p.x, -p.x, mirror);
  n.x = mix(n.x, -n.x, mirror);

  // ILUMINAÇÃO: chave quente-neutra do alto-esquerda-frente + preenchimento frio
  vec3 keyDir = normalize(vec3(-0.45, 0.62, 0.65));
  vec3 fillDir = normalize(vec3(0.75, -0.15, 0.35));
  float key = max(dot(n, keyDir), 0.0);
  float fill = max(dot(n, fillDir), 0.0) * 0.30;
  float rim = pow(clamp(1.0 - abs(n.z), 0.0, 1.0), 3.0) * 0.55;
  float spec = pow(max(dot(n, normalize(keyDir + vec3(0.0, 0.0, 1.0))), 0.0), 22.0) * 0.6;
  // oclusão de fenda: fundo de sulco recebe menos luz (é o que DESENHA os giros)
  float ao = mix(0.30, 1.0, smoothstep(0.15, 0.75, aBright));
  float fres = pow(clamp(1.0 - abs(n.z), 0.0, 1.0), 1.25);
  vLight = ((0.22 + 1.05 * pow(key, 1.15) + fill) * ao + rim + spec) * mix(0.66, 1.0, fres) + fres * 0.45;
  vFres = fres;

  float breath = 1.0 + 0.012 * sin(uTime * 0.5 + aRand * 6.28);
  p *= 0.72 * 1.42 * uScaleMul * breath;

  float scatter = sin(3.14159265 * clamp(uFlip, 0.0, 1.0));
  scatter = scatter * scatter;
  p += aDir * scatter * (0.55 + 0.65 * aRand);

  float persp = 1.0 / (1.0 + p.z * 0.12);
  vec2 clip = vec2(p.x * persp / uAspect, p.y * persp + uOffY);
  clip.x += mix(uOffX, -uOffX, uFlip);
  // micro-parallax: profundidade responde ao tilt do mouse (frente move mais)
  clip += vec2(uTilt.x, -uTilt.y) * (-p.z) * 0.055;

  vec2 webPos = aWeb;
  webPos.x += 0.012 * sin(uTime * 0.4 + aRand * 70.0);
  webPos.y += 0.012 * cos(uTime * 0.35 + aRand * 90.0);
  float webE = smoothstep(0.0, 1.0, uWeb);
  clip = mix(clip, webPos, webE);

  vec2 d = vec2((clip.x - uMouse.x) * uAspect, clip.y - uMouse.y);
  float dist = length(d);
  float force = exp(-dist * dist * 16.0) * 0.09 * uMouseActive;
  clip += (d / max(dist, 0.001)) * force * vec2(1.0 / uAspect, 1.0);

  // Z real no clip: é ele que faz a traseira ficar ESCONDIDA atrás da frente
  float zc = clamp(-p.z * 0.42, -0.95, 0.95);
  gl_Position = vec4(clip, zc, 1.0);

  // cubos: crista maior, sulco menor (variação que ajuda a desenhar o relevo)
  float keepP = 0.52 + 0.48 * pow(fres, 1.15);
  float dropped = step(keepP, fract(aRand * 7.13)) * aTier; // dobras nunca somem
  float sz = (0.97 + 0.06 * aRand) * mix(1.0, 0.66, aTier) * (1.0 - dropped);
  float webSize = mix(1.0, aKind > 0.5 ? 1.05 : 0.6, webE);
  gl_PointSize = uPx * sz * persp * webSize;

  vCav = aBright;
  vHue = aHue;
  vTier = aTier;
  vDepth = clamp(0.5 - p.z * 0.55, 0.0, 1.0);
  vRot = atan(n.y, n.x) + (aRand - 0.5) * 0.30; // glifo segue o fluxo da superfície
  vRand = aRand;
  float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aRand * 1.5) + aRand * 30.0);
  vFade = mix(1.0 - scatter * 0.55, (aKind > 0.5 ? 0.9 * tw : 0.10), webE);
  vLight *= 0.96 + 0.08 * sin(uTime * (0.7 + aRand * 0.9) + aRand * 44.0); // twinkle 8%
}
`;

// Fragment do cérebro: cubo isométrico SÓLIDO (3 faces sombreadas + arestas),
// paleta fria (azul-noite -> aço -> branco-gelo, realce violeta na aresta) e
// alpha-discard, que é o que permite o depth buffer ocluir a traseira.
const fragBrain = `
precision highp float;

varying float vHue;
varying float vTier;
varying float vCav;
varying float vLight;
varying float vRot;
varying float vRand;
varying float vFres;
varying float vDepth;
varying float vFade;

float segd(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
float inQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  float s1 = cross2(b - a, p - a);
  float s2 = cross2(c - b, p - b);
  float s3 = cross2(d - c, p - c);
  float s4 = cross2(a - d, p - d);
  return (min(min(s1, s2), min(s3, s4)) >= 0.0 || max(max(s1, s2), max(s3, s4)) <= 0.0) ? 1.0 : 0.0;
}

void main() {
  if (vFade < 0.06) discard;

  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float ca = cos(vRot), sa = sin(vRot);
  vec2 q = mat2(ca, -sa, sa, ca) * uv * 0.66;

  vec2 v0 = vec2(0.537, 0.310), v1 = vec2(0.0, 0.62), v2 = vec2(-0.537, 0.310);
  vec2 v3 = vec2(-0.537, -0.310), v4 = vec2(0.0, -0.62), v5 = vec2(0.537, -0.310);
  vec2 c0 = vec2(0.0);

  float fTop = inQuad(q, c0, v0, v1, v2);
  float fLeft = inQuad(q, c0, v2, v3, v4);
  float fRight = inQuad(q, c0, v4, v5, v0);
  float body = max(fTop, max(fLeft, fRight));
  if (body < 0.5) discard;                 // fora do cubo: nada (depth limpo)

  float dm = 1e3;
  dm = min(dm, segd(q, v0, v1)); dm = min(dm, segd(q, v1, v2));
  dm = min(dm, segd(q, v2, v3)); dm = min(dm, segd(q, v3, v4));
  dm = min(dm, segd(q, v4, v5)); dm = min(dm, segd(q, v5, v0));
  dm = min(dm, segd(q, c0, v1)); dm = min(dm, segd(q, c0, v3)); dm = min(dm, segd(q, c0, v5));
  float edge = smoothstep(0.135, 0.045, dm);

  // faces do cubo: topo claro, esquerda média, direita escura
  float face = fTop > 0.5 ? 1.0 : (fLeft > 0.5 ? 0.62 : 0.38);

  // PALETA POR FITA (como a referência): cada patch tem um matiz;
  // sulco sempre azul-noite, crista acende na cor do patch
  vec3 deep = vec3(0.045, 0.060, 0.115);
  vec3 h0 = vec3(0.95, 0.97, 1.00);   // branco-gelo
  vec3 h1 = vec3(0.45, 0.68, 1.20);   // azul-aço saturado
  vec3 h2 = vec3(0.88, 0.58, 1.25);   // violeta saturado
  vec3 h3 = vec3(0.16, 0.26, 0.62);   // azul profundo (recua)
  vec3 h4 = vec3(0.45, 0.95, 0.88);  // mint frio
  vec3 hueCol; float hueLum;
  if (vHue < 0.17)      { hueCol = h0; hueLum = 1.28; }  // gelo = papel do dourado
  else if (vHue < 0.5)  { hueCol = h1; hueLum = 1.00; }
  else if (vHue < 0.84) { hueCol = h2; hueLum = 0.95; }
  else                  { hueCol = h4; hueLum = 1.10; }
  hueCol *= hueLum;
  hueCol *= 0.90 + 0.20 * fract(vRand * 5.7); // vida por cubo sem quebrar a região
  float c = smoothstep(0.10, 0.80, vCav);
  vec3 col = mix(deep, hueCol * 1.12, pow(c, 1.15));

  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(grey), col, mix(0.35, 1.0, vFres)); // interior dessaturado
  col = mix(col, vec3(grey * 0.5), vTier * 0.75);     // preenchimento: apagado e cinza
  col *= min(vLight, 1.32) * face;
  col = mix(col, vec3(0.99, 0.99, 1.0), vFres * 0.10); // borda mantém o matiz saturado
  col += vec3(0.34, 0.30, 0.55) * edge * 0.30 * (0.4 + 0.6 * c);  // aresta com toque violeta
  col = mix(col, vec3(0.045, 0.055, 0.085), vDepth * 0.55);        // névoa: fundo recua
  if (vRand > 0.975) col += vec3(0.10, 0.13, 0.20);                 // faíscas raras

  float aGlyph = max(0.16, edge);
  col *= mix(0.72, 1.35, edge); // aresta acesa, face fantasma
  gl_FragColor = vec4(col, aGlyph * vFade);
}
`;

// plexo interno — mesmas transformações 3D do cérebro
const vertexPlexus = `
attribute vec3 position;
attribute float aSeed;

uniform float uTime;
uniform float uFlip;
uniform float uWeb;
uniform float uAspect;
uniform vec2 uTilt;
uniform float uOffX;
uniform float uOffY;
uniform float uScaleMul;

varying float vA;
varying float vSeed;

void main() {
  vec3 p = position;
  float yaw = 0.72 + sin(uTime * 0.18) * 0.09 + uTilt.x;
  float pitch = 0.24 + sin(uTime * 0.13 + 1.0) * 0.05 + uTilt.y;
  float cy = cos(yaw), sy = sin(yaw);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  float cxp = cos(pitch), sxp = sin(pitch);
  p = vec3(p.x, cxp * p.y - sxp * p.z, sxp * p.y + cxp * p.z);

  float mirror = smoothstep(0.34, 0.66, uFlip);
  p.x = mix(p.x, -p.x, mirror);

  float breath = 1.0 + 0.014 * sin(uTime * 0.5 + aSeed * 6.28);
  p *= 0.72 * 1.42 * uScaleMul * breath;

  float persp = 1.0 / (1.0 + p.z * 0.22);
  vec2 clip = vec2(p.x * persp / uAspect, p.y * persp + uOffY);
  clip.x += mix(uOffX, -uOffX, uFlip);
  gl_Position = vec4(clip, 0.0, 1.0);

  float scatter = sin(3.14159265 * clamp(uFlip, 0.0, 1.0));
  float pulse = 0.6 + 0.4 * sin(uTime * 0.9 + aSeed * 17.0);
  vA = 0.34 * pulse * (1.0 - scatter * scatter) * (1.0 - smoothstep(0.0, 0.6, uWeb)) * persp;
  vSeed = aSeed;
}
`;

const vertexAmbient = `
attribute vec3 position;
attribute float aRand;
attribute float aShape;
attribute float aBright;

uniform float uTime;
uniform float uAspect;
uniform float uPx;
uniform float uScrollY;

varying float vAlpha;
varying float vShape;
varying float vRot;
varying float vRand;
varying float vBright;
varying float vLight;

void main() {
  vec3 p = position;
  p.x += 0.09 * sin(uTime * 0.16 + aRand * 60.0);
  p.y += 0.09 * cos(uTime * 0.13 + aRand * 47.0);
  p.y += uScrollY * (0.05 + aRand * 0.07);
  p.y = mod(p.y + 1.3, 2.6) - 1.3;

  gl_Position = vec4(p.x / uAspect, p.y, 0.0, 1.0);
  gl_PointSize = uPx * (0.55 + 5.0 * aRand * aRand * aRand);

  vAlpha = mix(0.16, 0.80, aBright);
  vShape = aShape;
  vRot = aRand * 6.2831 + uTime * (0.15 + aRand * 0.55) * (aRand > 0.5 ? 1.0 : -1.0);
  vRand = aRand;
  vBright = aBright;
  vLight = 1.0;
}
`;

const fragPoints = `
precision highp float;

varying float vAlpha;
varying float vShape;
varying float vRot;
varying float vRand;
varying float vBright;
varying float vLight;

float sdTri(vec2 p) {
  const float k = 1.7320508;
  p.x = abs(p.x) - 0.5;
  p.y = p.y + 0.5 / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -1.0, 0.0);
  return -length(p) * sign(p.y);
}

float segd(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

// dentro de um quadrilátero convexo (faces do cubo isométrico)
float inQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  float s1 = cross2(b - a, p - a);
  float s2 = cross2(c - b, p - b);
  float s3 = cross2(d - c, p - c);
  float s4 = cross2(a - d, p - d);
  float mn = min(min(s1, s2), min(s3, s4));
  float mx = max(max(s1, s2), max(s3, s4));
  return (mn >= 0.0 || mx <= 0.0) ? 1.0 : 0.0;
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float ca = cos(vRot), sa = sin(vRot);
  vec2 ruv = mat2(ca, -sa, sa, ca) * uv;
  float a;
  float faceShade = 1.0;

  if (vShape < 0.5) {
    // mini CUBO wireframe (projeção isométrica: hexágono + 3 arestas internas)
    vec2 v0 = vec2(0.537, 0.310), v1 = vec2(0.0, 0.62), v2 = vec2(-0.537, 0.310);
    vec2 v3 = vec2(-0.537, -0.310), v4 = vec2(0.0, -0.62), v5 = vec2(0.537, -0.310);
    vec2 c0 = vec2(0.0);
    float dm = 1e3;
    dm = min(dm, segd(ruv, v0, v1)); dm = min(dm, segd(ruv, v1, v2));
    dm = min(dm, segd(ruv, v2, v3)); dm = min(dm, segd(ruv, v3, v4));
    dm = min(dm, segd(ruv, v4, v5)); dm = min(dm, segd(ruv, v5, v0));
    dm = min(dm, segd(ruv, c0, v1)); dm = min(dm, segd(ruv, c0, v3)); dm = min(dm, segd(ruv, c0, v5));
    // faces sólidas: topo claro, esquerda média, direita escura (cubo lê como cubo)
    float fTop = inQuad(ruv, c0, v0, v1, v2);
    float fLeft = inQuad(ruv, c0, v2, v3, v4);
    float fRight = inQuad(ruv, c0, v4, v5, v0);
    float body = max(fTop, max(fLeft, fRight));
    float edge = smoothstep(0.075, 0.022, dm);
    faceShade = fTop > 0.5 ? 1.0 : (fLeft > 0.5 ? 0.50 : 0.28);
    faceShade = mix(faceShade, 1.3, edge);
    a = max(body * 0.14, edge); // vazado, coerente com o cérebro
  } else {
    float d = sdTri(ruv * 1.15);
    a = smoothstep(0.16, 0.02, abs(d + 0.14));
  }

  vec3 col = mix(vec3(0.30, 0.33, 0.40), vec3(0.97, 0.98, 1.0), pow(vBright, 1.4));
  col *= vLight * faceShade;
  col += vec3(0.03, 0.045, 0.085) * (1.0 - vBright);
  if (vRand > 0.96) col *= 1.55;

  gl_FragColor = vec4(col, a * vAlpha);
}
`;

const vertexLines = `
attribute vec3 position;
attribute float aSeed;

uniform float uTime;
uniform float uWeb;

varying float vA;
varying float vSeed;

void main() {
  vec2 p = position.xy;
  p.x += 0.012 * sin(uTime * 0.4 + aSeed * 70.0);
  p.y += 0.012 * cos(uTime * 0.35 + aSeed * 90.0);
  gl_Position = vec4(p, 0.0, 1.0);
  float pulse = 0.65 + 0.35 * sin(uTime * 1.1 + aSeed * 12.0);
  vA = smoothstep(0.0, 1.0, uWeb) * 0.75 * pulse;
  vSeed = aSeed;
}
`;

const fragLines = `
precision highp float;
varying float vA;
varying float vSeed;
void main() {
  vec3 col = mix(vec3(0.65, 0.70, 0.80), vec3(0.92, 0.94, 1.0), fract(vSeed * 7.0));
  gl_FragColor = vec4(col, vA);
}
`;

function buildWebGraph() {
    const hubs: { x: number; y: number; w: number; seed: number }[] = [];
    const K = 24;
    let guard = 0;
    while (hubs.length < K && guard < 4000) {
        guard++;
        const x = (Math.random() * 2 - 1) * 0.92;
        const y = (Math.random() * 2 - 1) * 0.46 + Math.sin(x * 2.3) * 0.12;
        const w = 0.35 + Math.random() * Math.random() * 2.2;
        const minD = 0.13 + w * 0.03;
        if (hubs.every(h => (h.x - x) ** 2 + (h.y - y) ** 2 > minD * minD)) {
            hubs.push({ x, y, w, seed: Math.random() });
        }
    }
    const edges: [number, number][] = [];
    for (let i = 1; i < hubs.length; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < i; j++) {
            const d = (hubs[i].x - hubs[j].x) ** 2 + (hubs[i].y - hubs[j].y) ** 2;
            if (d < bd) { bd = d; best = j; }
        }
        edges.push([i, best]);
    }
    for (let i = 0; i < hubs.length; i++) {
        if (Math.random() < 0.5) {
            const j = Math.floor(Math.random() * hubs.length);
            const d = (hubs[i].x - hubs[j].x) ** 2 + (hubs[i].y - hubs[j].y) ** 2;
            if (j !== i && d < 0.55) edges.push([i, j]);
        }
    }
    return { hubs, edges };
}

interface BrainFieldProps {
    className?: string;
}

export default function BrainField({ className = '' }: BrainFieldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const renderer = new Renderer({ alpha: true, dpr: Math.min(window.devicePixelRatio || 1, 1.75) });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        container.appendChild(gl.canvas);
        gl.canvas.style.width = '100%';
        gl.canvas.style.height = '100%';

        let raf = 0;
        let disposed = false;
        let brainMesh: any = null, ambientMesh: any = null, linesMesh: any = null, plexusMesh: any = null;
        let brainProgram: any = null, ambientProgram: any = null, linesProgram: any = null, plexusProgram: any = null;

        const state = {
            flip: 0, flipTarget: 0,
            web: 0, webTarget: 0,
            mouse: [10, 10] as [number, number],
            mouseActive: 0, mouseActiveTarget: 0,
            tilt: [0, 0] as [number, number],
            tiltTarget: [0, 0] as [number, number],
            scrollY: 0,
        };

        function layout() {
            const aspect = container.clientWidth / container.clientHeight;
            const narrow = aspect < 1.5;
            return {
                aspect,
                offX: narrow ? 0.30 : 0.60,
                offY: narrow ? 0.34 : -0.02,
                scaleMul: narrow ? 0.60 : 1.0,
            };
        }

        function resize() {
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        window.addEventListener('resize', resize);
        resize();

        {
            const cloud = buildBrainCloud();
            const { hubs, edges } = buildWebGraph();
            const totalW = hubs.reduce((s, h) => s + h.w, 0);
            const cum: number[] = [];
            let acc = 0;
            for (const h of hubs) { acc += h.w / totalW; cum.push(acc); }
            const pickHub = () => {
                const r = Math.random();
                for (let i = 0; i < cum.length; i++) if (r <= cum[i]) return hubs[i];
                return hubs[hubs.length - 1];
            };

            const pos: number[] = [], nor: number[] = [], dir: number[] = [], web: number[] = [], kind: number[] = [];
            const rand: number[] = [], shape: number[] = [], bright: number[] = [], hueA: number[] = [], tierA: number[] = [];
            const anchors: { x: number; y: number; z: number; seed: number }[] = [];

            for (const pt of cloud) {
                const [x, y, z] = pt.p;
                pos.push(x, y, z);
                nor.push(...pt.n);

                const dl = Math.hypot(x, y) || 1;
                dir.push(
                    (x / dl) * 0.6 + (Math.random() * 2 - 1) * 0.8,
                    (y / dl) * 0.6 + (Math.random() * 2 - 1) * 0.8,
                    (Math.random() * 2 - 1) * 0.5
                );

                if (Math.random() < 0.80) {
                    const h2 = pickHub();
                    const ang = Math.random() * Math.PI * 2;
                    const rad = Math.abs((Math.random() + Math.random()) / 2 - 0.5) * (0.045 + h2.w * 0.035);
                    web.push(h2.x + Math.cos(ang) * rad, h2.y + Math.sin(ang) * rad * 0.85);
                    kind.push(1);
                } else {
                    web.push((Math.random() * 2 - 1) * 1.02, (Math.random() * 2 - 1) * 0.55);
                    kind.push(0);
                }

                rand.push(pt.seed);
                shape.push(Math.random() < 0.12 ? 1 : 0);
                bright.push(pt.bright);
                hueA.push((pt as any).hue / 3);
                tierA.push((pt as any).tier);

                if (pt.bright > 0.5 && Math.random() < 0.06 && anchors.length < 290) {
                    anchors.push({ x, y, z, seed: pt.seed });
                }
            }

            const geometry = new Geometry(gl, {
                position: { size: 3, data: new Float32Array(pos) },
                aNormal: { size: 3, data: new Float32Array(nor) },
                aDir: { size: 3, data: new Float32Array(dir) },
                aWeb: { size: 2, data: new Float32Array(web) },
                aKind: { size: 1, data: new Float32Array(kind) },
                aRand: { size: 1, data: new Float32Array(rand) },
                aShape: { size: 1, data: new Float32Array(shape) },
                aBright: { size: 1, data: new Float32Array(bright) },
                aHue: { size: 1, data: new Float32Array(hueA) },
                aTier: { size: 1, data: new Float32Array(tierA) },
            });

            const lay = layout();
            brainProgram = new Program(gl, {
                vertex: vertexBrain,
                fragment: fragBrain,
                uniforms: {
                    uTime: { value: 0 },
                    uFlip: { value: 0 },
                    uWeb: { value: 0 },
                    uAspect: { value: lay.aspect },
                    uMouse: { value: [10, 10] },
                    uMouseActive: { value: 0 },
                    uTilt: { value: [0, 0] },
                    uPx: { value: 0 },
                    uOffX: { value: lay.offX },
                    uOffY: { value: lay.offY },
                    uScaleMul: { value: lay.scaleMul },
                },
                transparent: true,
                depthTest: true,
                depthWrite: true,
            });
            // OCLUSÃO REAL: o depth buffer esconde a traseira atrás da frente —
            // é isso que faz a lateral, os giros e a divisória lerem como forma.
            brainProgram.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            brainMesh = new Mesh(gl, { geometry, program: brainProgram, mode: gl.POINTS });

            // plexo interno (P2 — já wired, refinamos depois da aprovação do P1)
            const ppos: number[] = [], pseed: number[] = [];
            for (const a of anchors) {
                const ds = anchors
                    .filter(b => b !== a)
                    .map(b => ({ b, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
                    .sort((u, v) => u.d - v.d);
                // 2 vizinhos (estrutura) + 45% de chance de 1 arco MÉDIO cruzando o vale
                for (const { b } of ds.slice(0, 2)) {
                    ppos.push(a.x, a.y, a.z, b.x, b.y, b.z);
                    pseed.push(a.seed, b.seed);
                }
                if (Math.random() < 0.45) {
                    const mid = ds.filter(o => o.d > 0.012 && o.d < 0.05);
                    if (mid.length) {
                        const { b } = mid[Math.floor(Math.random() * mid.length)];
                        ppos.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        pseed.push(a.seed, b.seed);
                    }
                }
            }
            const pgeo = new Geometry(gl, {
                position: { size: 3, data: new Float32Array(ppos) },
                aSeed: { size: 1, data: new Float32Array(pseed) },
            });
            plexusProgram = new Program(gl, {
                vertex: vertexPlexus,
                fragment: fragLines,
                uniforms: {
                    uTime: { value: 0 },
                    uFlip: { value: 0 },
                    uWeb: { value: 0 },
                    uAspect: { value: lay.aspect },
                    uTilt: { value: [0, 0] },
                    uOffX: { value: lay.offX },
                    uOffY: { value: lay.offY },
                    uScaleMul: { value: lay.scaleMul },
                },
                transparent: true,
                depthTest: false,
                depthWrite: false,
            });
            plexusMesh = new Mesh(gl, { geometry: pgeo, program: plexusProgram, mode: gl.LINES });

            const lpos: number[] = [], lseed: number[] = [];
            for (const [ia, ib] of edges) {
                const A2 = hubs[ia], B2 = hubs[ib];
                lpos.push(A2.x, A2.y, 0, B2.x, B2.y, 0);
                lseed.push(A2.seed, B2.seed);
            }
            const lgeo = new Geometry(gl, {
                position: { size: 3, data: new Float32Array(lpos) },
                aSeed: { size: 1, data: new Float32Array(lseed) },
            });
            linesProgram = new Program(gl, {
                vertex: vertexLines,
                fragment: fragLines,
                uniforms: { uTime: { value: 0 }, uWeb: { value: 0 } },
                transparent: true,
                depthTest: false,
            });
            linesMesh = new Mesh(gl, { geometry: lgeo, program: linesProgram, mode: gl.LINES });

            const N_AMB = 460;
            const apos: number[] = [], arand: number[] = [], ashape: number[] = [], abright: number[] = [];
            for (let i = 0; i < N_AMB; i++) {
                const big = i < 52;
                apos.push((Math.random() * 2 - 1) * 1.95, (Math.random() * 2 - 1) * 1.3, 0);
                arand.push(big ? 0.82 + Math.random() * 0.18 : Math.random() * 0.75);
                ashape.push(big ? (Math.random() < 0.65 ? 1 : 0) : (Math.random() < 0.3 ? 1 : 0));
                abright.push(big ? 0.7 + Math.random() * 0.3 : Math.random());
            }
            const ageo = new Geometry(gl, {
                position: { size: 3, data: new Float32Array(apos) },
                aRand: { size: 1, data: new Float32Array(arand) },
                aShape: { size: 1, data: new Float32Array(ashape) },
                aBright: { size: 1, data: new Float32Array(abright) },
            });
            ambientProgram = new Program(gl, {
                vertex: vertexAmbient,
                fragment: fragPoints,
                uniforms: {
                    uTime: { value: 0 },
                    uAspect: { value: lay.aspect },
                    uPx: { value: 0 },
                    uScrollY: { value: 0 },
                },
                transparent: true,
                depthTest: false,
            });
            ambientMesh = new Mesh(gl, { geometry: ageo, program: ambientProgram, mode: gl.POINTS });
        }

        function syncUniforms(t: number) {
            const lay = layout();
            const px = container.clientHeight * 0.0170 * renderer.dpr;
            if (brainProgram) {
                const u = brainProgram.uniforms;
                u.uTime.value = t;
                u.uFlip.value = state.flip;
                u.uWeb.value = state.web;
                u.uAspect.value = lay.aspect;
                u.uMouse.value = state.mouse;
                u.uMouseActive.value = state.mouseActive;
                u.uTilt.value = state.tilt;
                u.uPx.value = px;
                u.uOffX.value = lay.offX;
                u.uOffY.value = lay.offY;
                u.uScaleMul.value = lay.scaleMul;
            }
            if (plexusProgram) {
                const u = plexusProgram.uniforms;
                u.uTime.value = t;
                u.uFlip.value = state.flip;
                u.uWeb.value = state.web;
                u.uAspect.value = lay.aspect;
                u.uTilt.value = state.tilt;
                u.uOffX.value = lay.offX;
                u.uOffY.value = lay.offY;
                u.uScaleMul.value = lay.scaleMul;
            }
            if (linesProgram) {
                linesProgram.uniforms.uTime.value = t;
                linesProgram.uniforms.uWeb.value = state.web;
            }
            if (ambientProgram) {
                ambientProgram.uniforms.uTime.value = t;
                ambientProgram.uniforms.uAspect.value = lay.aspect;
                ambientProgram.uniforms.uPx.value = px * 0.60;
                ambientProgram.uniforms.uScrollY.value = state.scrollY / container.clientHeight;
            }
        }

        function syncGlow() {
            const g = glowRef.current;
            if (!g) return;
            const xPct = 50 + (0.5 - state.flip) * 2 * 24;
            const xFinal = xPct + (50 - xPct) * state.web;
            const yPct = 40 + state.web * 8;
            const int = 0.105 * (1 - state.web * 0.45);
            g.style.background =
                `radial-gradient(52% 68% at ${xFinal.toFixed(1)}% ${yPct.toFixed(1)}%, rgba(214,222,240,${int.toFixed(3)}), transparent 70%)`;
        }

        function renderAll() {
            if (ambientMesh) renderer.render({ scene: ambientMesh });
            if (plexusMesh && state.web < 0.95) renderer.render({ scene: plexusMesh, clear: false });
            if (linesMesh && state.web > 0.02) renderer.render({ scene: linesMesh, clear: false });
            if (brainMesh) renderer.render({ scene: brainMesh, clear: false });
        }

        let visible = true;
        const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
        io.observe(container);

        function loop(now: number) {
            raf = requestAnimationFrame(loop);
            if (disposed || !visible || document.hidden) return;
            const t = now * 0.001;

            state.flip += (state.flipTarget - state.flip) * 0.05;
            state.web += (state.webTarget - state.web) * 0.05;
            state.mouseActive += (state.mouseActiveTarget - state.mouseActive) * 0.06;
            state.tilt[0] += (state.tiltTarget[0] - state.tilt[0]) * 0.04;
            state.tilt[1] += (state.tiltTarget[1] - state.tilt[1]) * 0.04;

            syncUniforms(t);
            syncGlow();
            renderAll();
        }

        function onScroll() {
            const h = window.innerHeight;
            state.scrollY = window.scrollY;
            state.flipTarget = Math.max(0, Math.min(1, window.scrollY / (h * 1.3)));
            state.webTarget = Math.max(0, Math.min(1, (window.scrollY - h * 1.9) / (h * 1.1)));
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        function onMouseMove(e: MouseEvent) {
            const w = container.clientWidth, h = container.clientHeight;
            const mx = (e.clientX / w) * 2 - 1;
            const my = -((e.clientY / h) * 2 - 1);
            state.mouse = [mx, my];
            state.mouseActiveTarget = 1;
            // o cérebro INCLINA acompanhando o mouse (3D de verdade)
            state.tiltTarget = [mx * 0.22, -my * 0.11];
        }
        function onMouseLeave() { state.mouseActiveTarget = 0; state.tiltTarget = [0, 0]; }
        window.addEventListener('mousemove', onMouseMove);
        document.documentElement.addEventListener('mouseleave', onMouseLeave);

        if (reduced) { syncUniforms(0.001); syncGlow(); renderAll(); }
        else raf = requestAnimationFrame(loop);

        return () => {
            disposed = true;
            if (raf) cancelAnimationFrame(raf);
            io.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('mousemove', onMouseMove);
            document.documentElement.removeEventListener('mouseleave', onMouseLeave);
            if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
    }, []);

    return (
        <>
            <div ref={glowRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
            <div
                ref={containerRef}
                className={className}
                style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}
            />
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'radial-gradient(115% 115% at 50% 42%, transparent 58%, rgba(0,0,0,.55) 100%)',
            }} />
        </>
    );
}
