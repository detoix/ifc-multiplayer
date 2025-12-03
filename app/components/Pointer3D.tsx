import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

interface Pointer3DProps {
  position: [number, number, number];
  direction: [number, number, number];
  label: string;
  color: string;
}

export const Pointer3D = ({ position, direction, label, color }: Pointer3DProps) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      // Smoothly interpolate position
      groupRef.current.position.lerp(new THREE.Vector3(...position), 0.2);
      
      // Orient towards the look direction
      const target = new THREE.Vector3(...position).add(new THREE.Vector3(...direction));
      groupRef.current.lookAt(target);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Camera/Head representation */}
      <mesh>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      
      {/* Lens/Direction indicator */}
      <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
        <meshStandardMaterial color="black" />
      </mesh>

      {/* Frustum visualization (transparent cone) */}
      <mesh position={[0, 0, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.5, 4, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} wireframe />
      </mesh>
      
      {/* Label */}
      <Html
        position={[0, 0.4, 0]}
        center
        distanceFactor={10}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            background: color,
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
};
