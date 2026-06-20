"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ── Shaders ────────────────────────────────────────────────────────── */
const vert = /* glsl */ `
  attribute float aRand;
  uniform float uTime;
  uniform float uSize;
  uniform vec2  uResolution;

  varying float vBright;

  void main() {
    // each particle pulses at its own rate
    vBright = sin(uTime * 0.7 + aRand * 6.2832) * 0.5 + 0.5;

    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
    gl_Position  = projectionMatrix * mvPos;
    // igloo-style perspective-correct size
    gl_PointSize = uSize / length(mvPos.xyz) * (uResolution.y / 1300.0);
  }
`;

const frag = /* glsl */ `
  uniform vec3  uColor;
  uniform float uAlpha;

  varying float vBright;

  void main() {
    vec2  co   = gl_PointCoord - 0.5;
    float dist = length(co);
    if (dist > 0.5) discard;

    // reconstruct sphere normal from point coord
    vec2  uv = co * 2.0;
    float z  = sqrt(max(0.0, 1.0 - dot(uv, uv)));
    vec3  n  = normalize(vec3(uv, z));

    // directional light from top-right-front
    float diff = max(0.0, dot(n, normalize(vec3(0.4, 0.7, 1.0))));

    // soft circular falloff
    float alpha = pow(1.0 - dist * 2.0, 1.5);

    // base + diffuse highlight + per-particle pulse
    vec3 color = uColor * (0.5 + diff * 0.9 + vBright * 0.35);

    gl_FragColor = vec4(color, alpha * uAlpha);
  }
`;

/* ── Geometry helpers ────────────────────────────────────────────────── */
function withRand(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) r[i] = Math.random();
  geo.setAttribute("aRand", new THREE.BufferAttribute(r, 1));
  return geo;
}

function makeDisk(count: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 0.88;
    const a = Math.random() * Math.PI * 2;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.02);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  return withRand(g);
}

function makeRim(count: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos.push(Math.cos(a) * 0.92, Math.sin(a) * 0.92, (Math.random() - 0.5) * 0.02);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  return withRand(g);
}

function makeVLetter(count: number): THREE.BufferGeometry {
  const pos: number[] = [];
  let tries = 0;
  while (pos.length / 3 < count && tries < count * 8) {
    tries++;
    const t   = Math.random();
    const arm = Math.random() > 0.5;
    let x = arm ? -0.38 + t * 0.38 : 0.38 - t * 0.38;
    let y = 0.42 - t * 0.88;
    x += (Math.random() - 0.5) * 0.055;
    y += (Math.random() - 0.5) * 0.055;
    if (x * x + y * y < 0.82) pos.push(x, y, 0.055 + Math.random() * 0.015);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  return withRand(g);
}

/* ── Scene ───────────────────────────────────────────────────────────── */
function CoinGroup() {
  const groupRef = useRef<THREE.Group>(null!);
  const { size } = useThree();

  const diskGeo = useMemo(() => makeDisk(3500), []);
  const rimGeo  = useMemo(() => makeRim(700), []);
  const vGeo    = useMemo(() => makeVLetter(1800), []);

  const makeMat = (color: string, uSize: number, uAlpha: number) =>
    new THREE.ShaderMaterial({
      vertexShader:   vert,
      fragmentShader: frag,
      uniforms: {
        uTime:       { value: 0 },
        uSize:       { value: uSize },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uColor:      { value: new THREE.Color(color) },
        uAlpha:      { value: uAlpha },
      },
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      transparent: true,
    });

  // disk: dim blue body | rim: bright edge | V: crystal white-blue
  const diskMat = useMemo(() => makeMat("#5b80c8", 22, 0.55), []);
  const rimMat  = useMemo(() => makeMat("#a8c8ff", 32, 0.90), []);
  const vMat    = useMemo(() => makeMat("#cce0ff", 50, 0.95), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.18;
    groupRef.current.rotation.x = Math.sin(t * 0.22) * 0.06;

    diskMat.uniforms.uTime.value = t;
    rimMat.uniforms.uTime.value  = t;
    vMat.uniforms.uTime.value    = t;

    diskMat.uniforms.uResolution.value.set(size.width, size.height);
    rimMat.uniforms.uResolution.value.set(size.width, size.height);
    vMat.uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <group ref={groupRef}>
      <points geometry={diskGeo} material={diskMat} />
      <points geometry={rimGeo}  material={rimMat} />
      <points geometry={vGeo}    material={vMat} />
    </group>
  );
}

/* ── Canvas ──────────────────────────────────────────────────────────── */
export function VeylixCoin() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.0], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <CoinGroup />
    </Canvas>
  );
}
