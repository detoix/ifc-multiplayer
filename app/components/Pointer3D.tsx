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
      // Smoothly interpolate position with slower lerp for less jitter
      groupRef.current.position.lerp(new THREE.Vector3(...position), 0.08);
      
      // Orient towards the look direction using CURRENT position (not target position)
      // This prevents orientation drift during position interpolation
      const target = groupRef.current.position.clone().add(new THREE.Vector3(...direction));
      groupRef.current.lookAt(target);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Camera/Head representation - 2x larger */}
      <mesh>
        <boxGeometry args={[2.4, 1.6, 3.2]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      
      {/* Lens/Direction indicator - 2x larger */}
      <mesh position={[0, 0, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.8, 16]} />
        <meshStandardMaterial color="black" />
      </mesh>

      {/* Direction arrow/ray - 2x larger */}
      <mesh position={[0, 0, 6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Arrow tip - 2x larger */}
      <mesh position={[0, 0, 10.4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.6, 1.6, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Frustum visualization (transparent cone) - 2x larger */}
      <mesh position={[0, 0, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[3.0, 8, 4, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} wireframe />
      </mesh>
      
      {/* Label */}
      <Html
        position={[0, 1.2, 0]}
        center
        transform={false}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            background: color,
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '14px',
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
