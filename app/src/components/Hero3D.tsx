import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Real-3D backdrop for the landing radar: a wireframe sphere ("the world"),
// two tilted great-circle orbit rings, and a slow starfield of nearby-people
// points, all in the chart palette. Sits behind the SVG dial, pointer-events
// none, and parallaxes gently against the mouse.

const BLUE = '#1866DE'
const LINE = '#C3CFC6'
const INK3 = '#94A499'

function Globe() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock, pointer }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 0.06
    // gentle mouse parallax
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, pointer.y * 0.18, 0.05)
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, pointer.x * 0.1, 0.05)
  })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[2.1, 24, 16]} />
        <meshBasicMaterial color={LINE} wireframe transparent opacity={0.16} />
      </mesh>
      <OrbitRing radius={2.7} tilt={1.15} speed={0.12} color={BLUE} dot />
      <OrbitRing radius={3.1} tilt={0.6} speed={-0.08} color={INK3} />
      <PeoplePoints />
    </group>
  )
}

function OrbitRing({ radius, tilt, speed, color, dot = false }: {
  radius: number; tilt: number; speed: number; color: string; dot?: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * speed
  })
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius])
  return (
    <group rotation-x={tilt}>
      <group ref={ref}>
        {/* three.js line (not SVG) — renders as a thin 3D stroke */}
        <primitive object={new THREE.Line(ring, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }))} />
        {dot && (
          <mesh position={[radius, 0, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )}
      </group>
    </group>
  )
}

/** Sparse points drifting on the sphere's surface — people out there. */
function PeoplePoints() {
  const geo = useMemo(() => {
    const positions = new Float32Array(60 * 3)
    for (let i = 0; i < 60; i++) {
      // deterministic pseudo-random spherical distribution
      const u = ((i * 137.508) % 360) / 360
      const v = ((i * 61.803) % 180) / 180
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * 2.1
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * 2.1
      positions[i * 3 + 2] = Math.cos(phi) * 2.1
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])
  return (
    <points geometry={geo}>
      <pointsMaterial color={BLUE} size={0.05} transparent opacity={0.45} sizeAttenuation />
    </points>
  )
}

export default function Hero3D({ className = '' }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 8.5], fov: 42 }}>
        <Suspense fallback={null}>
          <Globe />
        </Suspense>
      </Canvas>
    </div>
  )
}
