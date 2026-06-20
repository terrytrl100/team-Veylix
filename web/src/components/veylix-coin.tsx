"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                    */
/* ------------------------------------------------------------------ */
function makeDisk(count: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 0.88;
    const a = Math.random() * Math.PI * 2;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.02);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
}

function makeRim(count: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos.push(Math.cos(a) * 0.92, Math.sin(a) * 0.92, (Math.random() - 0.5) * 0.02);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
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
  return g;
}

/* ------------------------------------------------------------------ */
/*  Scene                                                               */
/* ------------------------------------------------------------------ */
function CoinGroup() {
  const groupRef = useRef<THREE.Group>(null!);

  const diskGeo = useMemo(() => makeDisk(3500), []);
  const rimGeo  = useMemo(() => makeRim(700), []);
  const vGeo    = useMemo(() => makeVLetter(1800), []);

  const shared = {
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    transparent: true,
  } as const;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.18;
    groupRef.current.rotation.x = Math.sin(t * 0.22) * 0.06;
  });

  return (
    <group ref={groupRef}>
      <points geometry={diskGeo}>
        <pointsMaterial {...shared} color="#5b80c8" size={0.007} opacity={0.55} />
      </points>
      <points geometry={rimGeo}>
        <pointsMaterial {...shared} color="#a8c8ff" size={0.011} opacity={0.90} />
      </points>
      <points geometry={vGeo}>
        <pointsMaterial {...shared} color="#cce0ff" size={0.018} opacity={0.95} />
      </points>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas                                                              */
/* ------------------------------------------------------------------ */
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
