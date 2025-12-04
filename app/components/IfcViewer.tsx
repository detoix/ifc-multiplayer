"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import type { Group } from "three";
import * as THREE from "three";
import { Pointer3D } from "./Pointer3D";
import type { PresenceMap } from "../lib/usePresence";

const IfcModel = ({ url }: { url: string }) => {
  const [scene, setScene] = useState<Group | null>(null);

  useEffect(() => {
    if (!url) return;
    console.log("Starting IFC load for:", url);

    const loader = new IFCLoader();
    // Ensure WASM path is correct using absolute URL to avoid relative path issues
    const wasmPath = typeof window !== 'undefined' ? `${window.location.origin}/wasm/` : "/wasm/";
    loader.ifcManager.setWasmPath(wasmPath);
    
    loader.load(
      url,
      (g: any) => {
        console.log("IFC loaded successfully", g);
        
        // Calculate bounding box to understand model size
        const bbox = new THREE.Box3().setFromObject(g);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        console.log("Model bounding box size:", size);
        console.log("Model center:", bbox.getCenter(new THREE.Vector3()));
        
        g.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        setScene(g);
      },
      (progress: ProgressEvent) => {
         // console.log("Loading progress:", progress);
      },
      (err: unknown) => {
        console.error("IFC load error", err);
      }
    );

    return () => {
      // Cleanup if needed, though disposing the manager might be too aggressive if we want to reuse it
      // loader.ifcManager.dispose(); 
      setScene(null);
    };
  }, [url]);

  if (!scene) return null;
  return <primitive object={scene} />;
};

const CameraTracker = ({ onUpdate }: { onUpdate: (pos: [number, number, number], dir: [number, number, number]) => void }) => {
  const { camera } = useThree();
  const lastUpdate = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastUpdate.current > 50) { // Throttle to ~20fps
      lastUpdate.current = now;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      onUpdate([camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z]);
    }
  });
  return null;
};

export const IfcViewer = ({ fileUrl, pointers, onCameraUpdate }: { 
  fileUrl: string | null;
  pointers: PresenceMap;
  onCameraUpdate: (pos: [number, number, number], dir: [number, number, number]) => void;
}) => {
  const canvasRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="canvas-shell" ref={canvasRef}>
      <Canvas 
        shadows 
        dpr={[1, 1.5]}
      >
        <PerspectiveCamera makeDefault position={[20, 20, 20]} fov={50} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} castShadow intensity={1} />
        
        <CameraTracker onUpdate={onCameraUpdate} />
        
        {Object.entries(pointers).map(([id, pointer]) => (
           <Pointer3D 
             key={id} 
             position={pointer.position} 
             direction={pointer.direction}
             label={pointer.label} 
             color={pointer.color} 
           />
        ))}

        <Suspense fallback={null}>
          <Center>
            {fileUrl ? <IfcModel url={fileUrl} /> : null}
          </Center>
          <Environment preset="city" />
        </Suspense>
        <Grid args={[100, 100]} cellColor="#1f2937" sectionColor="#334155" fadeDistance={50} />
        <OrbitControls enableDamping makeDefault />
      </Canvas>
      {!fileUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: 14
          }}
        >
          Drop an IFC to start rendering.
        </div>
      ) : null}
    </div>
  );
};
