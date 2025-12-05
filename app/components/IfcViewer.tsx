"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import type { Group } from "three";
import * as THREE from "three";
import { Pointer3D } from "./Pointer3D";
import type { PresenceMap } from "../lib/usePresence";

const IfcModel = ({ url, onStoriesLoaded, selectedStory, onSelect }: { 
  url: string, 
  onStoriesLoaded: (stories: any[]) => void, 
  selectedStory: any | null,
  onSelect: (props: any) => void 
}) => {
  const [displayModel, setDisplayModel] = useState<THREE.Object3D | null>(null);
  const [highlightModel, setHighlightModel] = useState<THREE.Object3D | null>(null);
  const modelRef = useRef<any>(null);
  const loaderRef = useRef<IFCLoader | null>(null);
  const storiesRef = useRef<any[]>([]);
  const { scene: threeScene } = useThree();

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
      setDisplayModel(null);
      modelRef.current = null;
    };
  }, [url, onStoriesLoaded]);

  // Handle filtering
  useEffect(() => {
    const loader = loaderRef.current;
    const model = modelRef.current;
    if (!loader || !model) return;

    const filter = async () => {
      if (!selectedStory) {
        // Show full model
        loader.ifcManager.removeSubset(model.modelID, undefined, "custom-subset");
        setDisplayModel(model);
        return;
      }

      // Filter by story
      // Find all stories <= selected story
      const visibleStories = storiesRef.current.filter(s => s.elevation <= selectedStory.elevation);
      const visibleStoryIds = new Set(visibleStories.map(s => s.expressID));

      // We need to find all elements that are children of these stories
      const ifcProject = await loader.ifcManager.getSpatialStructure(model.modelID);
      const subsetIds: number[] = [];

      const collectStoryItems = (node: any) => {
         if (visibleStoryIds.has(node.expressID)) {
             // This is a visible story, collect all its descendants
             const collectDescendants = (n: any) => {
                 if (n.children && n.children.length > 0) {
                     n.children.forEach(collectDescendants);
                 } else {
                     // Leaf, assume it's an element
                     subsetIds.push(n.expressID);
                 }
             };
             if (node.children) node.children.forEach(collectDescendants);
         } else if (node.children) {
             node.children.forEach(collectStoryItems);
         }
      };
      
      collectStoryItems(ifcProject);

      if (subsetIds.length > 0) {
          const subset = loader.ifcManager.createSubset({
              modelID: model.modelID,
              ids: subsetIds,
              scene: undefined, // We don't want to add it to scene automatically, we'll render it via primitive
              removePrevious: true,
              customID: "custom-subset"
          });
          
          // Setup shadows for subset
           if (subset) {
            (subset as any).traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            setDisplayModel(subset as any);
           }
      } else {
          // Nothing visible?
          setDisplayModel(null);
      }
    };

    filter();

  }, [selectedStory]);

  const handlePointerDown = async (event: any) => {
    // Only handle primary clicks
    if (event.button !== 0) return;
    
    // Check if we hit the model
    const intersection = event.intersections.find((i: any) => i.object === event.object);
    if (!intersection) return;

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

    if (expressId) {
       console.log("Selected ID:", expressId);
       
       // Get properties
       const props = await loader.ifcManager.getItemProperties(modelId, expressId);
       console.log("Selected Props:", props);
       onSelect(props);

       // Create highlight subset
       // We use a custom ID for the highlight subset to distinguish it
       const highlight = loader.ifcManager.createSubset({
         modelID: modelId,
         ids: [expressId],
         material: new THREE.MeshLambertMaterial({ 
             color: 0xff00ff, 
             depthTest: false,
             transparent: true,
             opacity: 0.5 
         }),
         scene: undefined,
         removePrevious: true,
         customID: "highlight-subset"
       });
       
       if (highlight) {
           // Ensure it renders on top
           (highlight as any).renderOrder = 1;
           setHighlightModel(highlight as any);
       }
    }
  };

  if (!displayModel) return null;
  return (
    <group>
        <primitive 
            object={displayModel} 
            onPointerDown={(e: any) => {
                e.stopPropagation();
                handlePointerDown(e);
            }}
        />
        {highlightModel && <primitive object={highlightModel} />}
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

export const IfcViewer = ({ fileUrl, pointers, onCameraUpdate }: { 
  fileUrl: string | null;
  pointers: PresenceMap;
  onCameraUpdate: (pos: [number, number, number], dir: [number, number, number]) => void;
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
            {fileUrl ? (
                <IfcModel 
                    url={fileUrl} 
                    onStoriesLoaded={setStories} 
                    selectedStory={selectedStory}
                    onSelect={setSelectedProps}
                />
            ) : null}
          </Center>
          <Environment preset="city" />
        </Suspense>
        <Grid args={[100, 100]} cellColor="#1f2937" sectionColor="#334155" fadeDistance={50} />
        <OrbitControls enableDamping makeDefault />
      </Canvas>
      
      {/* Selection Info */}
      {selectedProps && (
        <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            background: 'rgba(0,0,0,0.8)',
            padding: '12px',
            borderRadius: '8px',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
            maxWidth: '300px',
            fontFamily: 'monospace'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '14px' }}>
                    Selection
                </h3>
                <button 
                  onClick={() => setSelectedProps(null)}
                  style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                >
                  ×
                </button>
            </div>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                 <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <div style={{ color: '#888', fontSize: '10px' }}>NAME</div>
                    {selectedProps.Name?.value || "Unnamed"}
                 </div>
                 <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <div style={{ color: '#888', fontSize: '10px' }}>TYPE</div>
                    {selectedProps.ObjectType?.value || "Unknown"}
                 </div>
                 <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <div style={{ color: '#888', fontSize: '10px' }}>ID</div>
                    {selectedProps.GlobalId?.value || selectedProps.expressID}
                 </div>
                 
                 {/* Raw props for debugging */}
                 <details style={{ marginTop: '8px' }}>
                     <summary style={{ fontSize: '10px', color: '#666', cursor: 'pointer' }}>Raw Data</summary>
                     <pre style={{ fontSize: '10px', overflow: 'auto', marginTop: '4px' }}>
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
            background: 'rgba(0,0,0,0.8)',
            padding: '8px',
            borderRadius: '8px',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)'
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
                    color: 'white',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
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
            pointerEvents: "none"
          }}
        >
          Drop an IFC to start rendering.
        </div>
      ) : null}
    </div>
  );
};
