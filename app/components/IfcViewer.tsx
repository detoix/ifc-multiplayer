"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera, Stage } from "@react-three/drei";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import type { Group } from "three";
import * as THREE from "three";
import { Pointer3D } from "./Pointer3D";
import type { PresenceMap, SelectionMap, PointerPayload } from "../lib/usePresence";

const IfcModel = ({ url, onStoriesLoaded, selectedStory, onSelectionChange, selections }: { 
  url: string, 
  onStoriesLoaded: (stories: any[]) => void, 
  selectedStory: any | null,
  onSelectionChange: (id: number | null, props?: any) => void,
  selections: SelectionMap
}) => {
  const [displayModel, setDisplayModel] = useState<THREE.Object3D | null>(null);
  const modelRef = useRef<any>(null);
  const loaderRef = useRef<IFCLoader | null>(null);
  const storiesRef = useRef<any[]>([]);
  const { scene: threeScene } = useThree();
  const activeSelectionSubsetsRef = useRef<{ customID: string; material: THREE.Material }[]>([]);

  // Handle multiplayer selections
  useEffect(() => {
    if (!url) return;
    console.log("Starting IFC load for:", url);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath("/wasm/");
    loaderRef.current = loader;
    
    const loadModel = async () => {
      try {
        const model = await loader.loadAsync(url) as any;
        console.log("IFC loaded successfully", model);
        modelRef.current = model;
        
        // Setup shadows
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        setDisplayModel(model);

        // Extract stories
        const ifcProject = await loader.ifcManager.getSpatialStructure(model.modelID);
        const stories: any[] = [];
        
        const findStories = (node: any) => {
          if (node.type === "IFCBUILDINGSTOREY") {
            stories.push(node);
          }
          if (node.children) {
            node.children.forEach(findStories);
          }
        };
        
        findStories(ifcProject);

        // Get elevations for sorting
        const storiesWithElevation = await Promise.all(stories.map(async (story) => {
          const props = await loader.ifcManager.getItemProperties(model.modelID, story.expressID);
          const elevation = props.Elevation?.value || 0;
          const name = props.Name?.value || story.Name?.value || `Story ${story.expressID}`;
          const longName = props.LongName?.value;
          return { ...story, elevation, name: longName || name, modelID: model.modelID };
        }));

        // Sort descending (highest first) so bottom story is at bottom of list
        storiesWithElevation.sort((a, b) => b.elevation - a.elevation);
        storiesRef.current = storiesWithElevation;
        onStoriesLoaded(storiesWithElevation);

      } catch (err) {
        console.error("IFC load error", err);
      }
    };

    loadModel();

    return () => {
      try {
        // Clean up any story-level subset when model unmounts
        if (loaderRef.current && modelRef.current) {
          loaderRef.current.ifcManager.removeSubset(modelRef.current.modelID, undefined, "storey-subset");
        }
      } catch (e) {
        // ignore
      }
      setDisplayModel(null);
      modelRef.current = null;
    };
  }, [url]);

  // Handle story (level) isolation based on selectedStory
  useEffect(() => {
    const loader = loaderRef.current;
    const model = modelRef.current;
    if (!loader || !model) return;

    const modelID = model.modelID;

    if (!selectedStory) {
      // Show whole building
      model.visible = true;
      try {
        loader.ifcManager.removeSubset(modelID, undefined, "storey-subset");
      } catch (e) {
        // ignore if it doesn't exist
      }
      return;
    }

    // Hide full model and show only selected storey as a subset
    model.visible = false;

    try {
      loader.ifcManager.createSubset({
        modelID,
        ids: [selectedStory.expressID],
        scene: threeScene,
        removePrevious: true,
        customID: "storey-subset"
      });
    } catch (e) {
      console.error("Failed to create storey subset", e);
    }
  }, [selectedStory, threeScene]);

  // Handle multiplayer selections (one active selection per user)
  useEffect(() => {
      const loader = loaderRef.current;
      const model = modelRef.current;
      if (!loader || !model) return;

      console.log("[IfcModel] selections map", selections);

      // Clear all previously active selection subsets so we never
      // accumulate stale highlights across updates.
      activeSelectionSubsetsRef.current.forEach(({ customID, material }) => {
        try {
          console.log("[IfcModel] removeSubset", { customID, materialUUID: material.uuid });
          loader.ifcManager.removeSubset(model.modelID, material, customID);
        } catch (e) {
          // Ignore removal errors; subset may already be gone
        }
      });
      activeSelectionSubsetsRef.current = [];

      const userIds = Object.keys(selections);

      userIds.forEach((userId) => {
        const sel = selections[userId];
        const customID = `select-${userId}`;

        console.log("[IfcModel] createSubset", {
          userId,
          customID,
          expressId: sel?.expressId,
          color: sel?.color
        });

        if (!sel || !sel.expressId) {
          return;
        }

        const material = new THREE.MeshLambertMaterial({
          color: sel.color,
          depthTest: false,
          transparent: true,
          opacity: 0.5
        });

        try {
          loader.ifcManager.createSubset({
            modelID: model.modelID,
            ids: [sel.expressId],
            material,
            scene: threeScene,
            removePrevious: true,
            customID
          });

          activeSelectionSubsetsRef.current.push({ customID, material });
        } catch (e) {
          // If the underlying IFC model is no longer registered
          // (e.g. during rapid file changes), avoid crashing the app.
          console.warn("[IfcModel] Failed to create selection subset", e);
        }
      });
  }, [selections, threeScene]);

  const handleClick = async (event: any) => {
    // Only handle primary button clicks
    if (event.button !== 0) return;

    // Check if we hit the model
    const intersection = event.intersections.find((i: any) => i.object === event.object);
    if (!intersection) {
        return;
    }

    const loader = loaderRef.current;
    if (!loader) return;

    // Get express ID
    const index = intersection.faceIndex;
    if (index === undefined) return;

    const modelId = event.object.modelID;
    if (modelId === undefined) return;

    const expressId = loader.ifcManager.getExpressId(
      event.object.geometry, 
      index
    );

    if (expressId !== undefined) {
       console.log("Selected ID:", expressId);
       
       // Get properties
       const props = await loader.ifcManager.getItemProperties(modelId, expressId);
       onSelectionChange(expressId, props);
    }
  };

  if (!displayModel) return null;
  return (
    <group>
        <primitive 
            object={displayModel} 
            onClick={(e: any) => {
                e.stopPropagation();
                handleClick(e);
            }}
        />
    </group>
  );
};

// ... (CameraTracker remains the same) ...


const CameraTracker = ({ onUpdate }: { onUpdate: (pos: [number, number, number], dir: [number, number, number]) => void }) => {
  const { camera } = useThree();
  const lastUpdate = useRef(0);
  const lastPos = useRef(new THREE.Vector3());
  const lastDir = useRef(new THREE.Vector3());

  useFrame(() => {
    const now = performance.now();
    
    // Force immediate update on first frame
    const isFirstUpdate = lastUpdate.current === 0;
    if (!isFirstUpdate && now - lastUpdate.current < 200) return; // Throttle to ~5fps

    const currentPos = camera.position;
    const currentDir = new THREE.Vector3();
    camera.getWorldDirection(currentDir);

    // Check if changed significantly
    // Distance squared 0.25 means sqrt(0.25) = 0.5 units
    // Direction squared 0.05 means roughly 12 degrees
    if (
      currentPos.distanceToSquared(lastPos.current) < 0.25 &&
      currentDir.distanceToSquared(lastDir.current) < 0.05
    ) {
      return;
    }

    lastUpdate.current = now;
    lastPos.current.copy(currentPos);
    lastDir.current.copy(currentDir);

    onUpdate(
      [currentPos.x, currentPos.y, currentPos.z], 
      [currentDir.x, currentDir.y, currentDir.z]
    );
  });
  return null;
};

const FollowController = ({ target, onStopFollowing }: { target: PointerPayload, onStopFollowing?: () => void }) => {
    const { camera, gl } = useThree();

    // Re-usable vectors to avoid allocations each frame
    const goalPosRef = useRef(new THREE.Vector3());
    const smoothedPosRef = useRef(new THREE.Vector3());
    const goalDirRef = useRef(new THREE.Vector3());
    const smoothedDirRef = useRef(new THREE.Vector3());
    const targetLookAtRef = useRef(new THREE.Vector3());
    const initializedRef = useRef(false);

    // We need to access the orbit controls. 
    // Since we are inside Canvas, we can look for it in the scene or just assume standard behavior.
    // Better yet, we can listen to "start" event on controls if we had access to them.
    // But we don't have direct access to the OrbitControls instance from here easily unless we use a ref passed down
    // or we listen to events on the domElement.
    
    useEffect(() => {
        const onInteract = () => {
            onStopFollowing?.();
        };

        // Listen for user interaction that should break the follow
        // pointerdown, wheel are good indicators
        const canvas = gl.domElement;
        canvas.addEventListener('pointerdown', onInteract);
        canvas.addEventListener('wheel', onInteract);
        
        return () => {
            canvas.removeEventListener('pointerdown', onInteract);
            canvas.removeEventListener('wheel', onInteract);
        };
    }, [gl, onStopFollowing]);

    // Initialize smoothed position when we first get a target
    useEffect(() => {
        if (!target) return;
        if (initializedRef.current) return;
        smoothedPosRef.current.set(...target.position);
        smoothedDirRef.current.set(...target.direction).normalize();
        initializedRef.current = true;
    }, [target]);

    useFrame((_, delta) => {
        if (!target) return;

        const goalPos = goalPosRef.current.set(...target.position);
        const smoothedPos = smoothedPosRef.current;

        // Exponential smoothing of the *target* position, independent of camera/controls
        const followStrength = 4; // tweakable: higher means faster follow
        const step = 1 - Math.exp(-followStrength * delta);

        smoothedPos.lerp(goalPos, step);

        // Snap when very close to avoid micro jitter
        if (smoothedPos.distanceToSquared(goalPos) < 1e-4) {
            smoothedPos.copy(goalPos);
        }

        // Drive the camera directly from the smoothed position
        camera.position.copy(smoothedPos);

        // Smooth direction (rotation) separately to avoid jumpy orientation
        const goalDir = goalDirRef.current.set(...target.direction).normalize();
        const smoothedDir = smoothedDirRef.current;
        const rotationStrength = 6; // tweakable: higher means faster rotation follow
        const dirStep = 1 - Math.exp(-rotationStrength * delta);

        smoothedDir.lerp(goalDir, dirStep).normalize();

        // Snap when the angular difference is tiny
        if (smoothedDir.angleTo(goalDir) < 0.01) {
            smoothedDir.copy(goalDir);
        }

        const targetLookAt = targetLookAtRef.current;
        targetLookAt
            .copy(smoothedDir)
            .multiplyScalar(10) // Look 10m ahead
            .add(smoothedPos);

        camera.lookAt(targetLookAt);
        camera.updateProjectionMatrix();
    });

    // To properly support OrbitControls being "controlled", we should ideally get the controls instance.
    // For now, we just drive the camera directly and stop following on user interaction.
    
    return null;
};

// Render other users' pointers, but hide any that are very close
// to the current camera position to avoid overlapping "camera" indicators.
const PointersLayer = ({ pointers }: { pointers: PresenceMap }) => {
  const { camera } = useThree();
  const camPos = camera.position;
  const thresholdSq = 1000; // hide pointers closer than ~3.2 units

  return (
    <>
      {Object.entries(pointers).map(([id, pointer]) => {
        const [x, y, z] = pointer.position;
        const dx = x - camPos.x;
        const dy = y - camPos.y;
        const dz = z - camPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < thresholdSq) {
          return null;
        }

        return (
          <Pointer3D 
            key={id} 
            position={pointer.position} 
            direction={pointer.direction}
            label={pointer.label} 
            color={pointer.color} 
          />
        );
      })}
    </>
  );
};

export const IfcViewer = ({ fileUrl, pointers, onCameraUpdate, selections = {}, onSelectionChange, followingUserId, onStopFollowing }: { 
  fileUrl: string | null;
  pointers: PresenceMap;
  onCameraUpdate: (pos: [number, number, number], dir: [number, number, number]) => void;
  selections?: SelectionMap;
  onSelectionChange?: (id: number | null) => void;
  followingUserId?: string | null;
  onStopFollowing?: () => void;
}) => {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [selectedProps, setSelectedProps] = useState<any | null>(null);

  // Reset stories when file changes
  useEffect(() => {
      setStories([]);
      setSelectedStory(null);
  }, [fileUrl]);

  return (
    <div className="canvas-shell" ref={canvasRef} style={{ position: 'relative' }}>
      <Canvas 
        shadows 
        dpr={[1, 1.5]}
        onPointerMissed={(event) => {
          // Primary button click on empty space => unselect
          if (event.button !== 0) return;
          onSelectionChange?.(null);
          setSelectedProps(null);
        }}
      >
        <PerspectiveCamera makeDefault position={[20, 20, 20]} fov={50} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} castShadow intensity={1} />
        
        <CameraTracker onUpdate={onCameraUpdate} />
        
        {/* Helper to follow another user */}
        {followingUserId && pointers[followingUserId] && (
          <FollowController 
            target={pointers[followingUserId]} 
            onStopFollowing={onStopFollowing} 
          />
        )}

        <PointersLayer pointers={pointers} />

        <Suspense fallback={null}>
          {fileUrl ? (
            <Stage
              adjustCamera
              preset="soft"
              intensity={0.7}
              environment="city"
              shadows="accumulative"
            >
              <IfcModel 
                  url={fileUrl} 
                  onStoriesLoaded={setStories} 
                  selectedStory={selectedStory}
                  onSelectionChange={(id, props) => {
                      onSelectionChange?.(id);
                      if (id && props) {
                          setSelectedProps(props);
                      } else {
                          setSelectedProps(null);
                      }
                  }}
                  selections={selections}
              />
            </Stage>
          ) : null}
        </Suspense>
        <Grid
          args={[80, 80]}
          position={[0, -0.001, 0]}
          cellColor="#1e293b"
          sectionColor="#0f172a"
          fadeDistance={60}
          fadeStrength={0.8}
        />
        <OrbitControls enableDamping makeDefault enabled={!followingUserId} />
      </Canvas>
      
      {/* Selection Info */}
      {selectedProps && (
        <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: 'var(--text)',
            maxWidth: '300px',
            fontFamily: 'monospace',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Selection
                </h3>
                <button 
                  onClick={() => setSelectedProps(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                >
                  ×
                </button>
            </div>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                 <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600 }}>NAME</div>
                    {selectedProps.Name?.value || "Unnamed"}
                 </div>
                 <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600 }}>TYPE</div>
                    {selectedProps.ObjectType?.value || "Unknown"}
                 </div>
                 <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600 }}>ID</div>
                    {selectedProps.GlobalId?.value || selectedProps.expressID}
                 </div>
                 
                 {/* Raw props for debugging */}
                 <details style={{ marginTop: '12px' }}>
                     <summary style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Raw Data</summary>
                     <pre style={{ fontSize: '11px', overflow: 'auto', marginTop: '4px', color: '#334155', background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>
                         {JSON.stringify(selectedProps, (key, value) => {
                             if (key === 'ownerHistory' || key === 'Placement' || key === 'RelatingType') return undefined; // simplify
                             if (value && value.type && value.value) return value.value;
                             return value;
                         }, 2)}
                     </pre>
                 </details>
            </div>
        </div>
      )}
      
      {/* Story Dropdown */}
      {stories.length > 0 && (
        <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 10,
            background: 'white',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
        }}>
            <select 
                value={selectedStory ? selectedStory.expressID : ""} 
                onChange={(e) => {
                    const id = e.target.value;
                    if (!id) setSelectedStory(null);
                    else setSelectedStory(stories.find(s => s.expressID === Number(id)));
                }}
                style={{
                    background: 'transparent',
                    color: 'var(--text)',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    minWidth: '120px'
                }}
            >
                <option value="" style={{ color: 'black' }}>Whole Building</option>
                {stories.map(story => (
                    <option key={story.expressID} value={story.expressID} style={{ color: 'black' }}>
                        {story.name}
                    </option>
                ))}
            </select>
        </div>
      )}

      {!fileUrl ? (
        <div
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: 14,
            fontWeight: 500,
            pointerEvents: "none",
            background: "rgba(255,255,255,0.8)",
            padding: "8px 16px",
            borderRadius: "20px",
            backdropFilter: "blur(4px)"
          }}
        >
          Drop an IFC to start rendering.
        </div>
      ) : null}
    </div>
  );
};
