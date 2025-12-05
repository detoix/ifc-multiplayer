 "use client";

import { useEffect, useState, useMemo } from "react";
import { IfcViewer } from "@/app/components/IfcViewer";
import { useFakePresence } from "@/app/lib/useFakePresence";
import { usePresence } from "@/app/lib/usePresence";

import { JoinDialog } from "@/app/components/JoinDialog";
import type { UserIdentity } from "@/app/lib/identity";

import { Chat } from "@/app/components/Chat";

export function DemoRoom() {
  // Load the demo file from the public path
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);

  // Fake users (AI agents) simulated purely on the client,
  // but using Date.now so all clients see the same motion.
  const { pointers: fakePointers } = useFakePresence();

  // Real users (observers)
  // We use a static room ID "demo" for all real users to see each other
  const { pointers: realPointers, selections, messages, updatePosition, updateSelection, sendChatMessage } = usePresence("demo", identity);

  // Merge pointers
  const pointers = useMemo(
    () => ({
      ...realPointers,
      ...fakePointers
    }),
    [realPointers, fakePointers]
  );

  useEffect(() => {
    // Fetch the demo file from blob storage
    fetch('/api/room-file?roomId=demo')
      .then(res => {
        if (res.ok) return res.json();
        // If the API doesn't have a demo file yet, fall back to the bundled demo IFC
        return null;
      })
      .then(data => {
        if (data && data.fileUrl) {
          setFileUrl(data.fileUrl);
        } else {
          // Local fallback so the demo always has a model
          setFileUrl('/demo/demo.ifc');
        }
      })
      .catch(err => {
        console.error('Failed to fetch demo file from API, using local demo:', err);
        setFileUrl('/demo/demo.ifc');
      });
  }, []);

  // We can still allow dropping a file to "preview" the demo experience with a local file
  const onDrop = (files: File[]) => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setFileUrl(url);
    }
  };

  return (
    <div className="grid">
      <section>
        <div 
          style={{ 
            border: "1px dashed var(--border)", 
            padding: 20, 
            borderRadius: 8,
            textAlign: "center",
            marginBottom: 16
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(Array.from(e.dataTransfer.files));
          }}
        >
          <h1 style={{ margin: "0 0 8px", color: "var(--text)" }}>Interactive Demo</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            This is a simulation with AI agents. Drop an IFC file to see them interact with your model.
          </p>
        </div>

        <div style={{ marginTop: 16, position: "relative" }}>
          <IfcViewer 
            fileUrl={fileUrl} 
            pointers={pointers}
            onCameraUpdate={updatePosition}
            selections={selections}
            onSelectionChange={updateSelection}
          />
        </div>
      </section>

      <aside className="sidebar">
        <div className="tag" style={{ marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: identity?.color || "#ccc" }} />
          {identity?.name || "Connecting..."}
        </div>
        <div className="stat">
          <span>Active Users</span>
          <strong>{Object.keys(pointers).length + 1}</strong>
        </div>
        <div className="stat">
          <span>Mode</span>
          <code style={{ fontSize: 12 }}>DEMO_SIMULATION</code>
        </div>
        <div style={{ marginTop: 12 }}>
          <small>The other users in this room are simulated AI agents demonstrating the multiplayer capabilities.</small>
        </div>
        
        <Chat 
            messages={messages} 
            onSendMessage={sendChatMessage} 
            identity={identity} 
        />

      </aside>
      <JoinDialog onJoin={setIdentity} />
    </div>
  );
}
