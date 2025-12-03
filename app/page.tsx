"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IfcViewer } from "@/app/components/IfcViewer";
import { Pointer3D } from "@/app/components/Pointer3D";
import { usePresence } from "@/app/lib/usePresence";
import type { PresenceMap } from "@/app/lib/usePresence";

const randomLabel = () => {
  const names = ["Falcon", "Quartz", "Lyra", "Cobalt", "Nova", "Atlas", "Delta", "Echo"];
  return names[Math.floor(Math.random() * names.length)];
};

export default function Home() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const roomId = useMemo(() => {
    if (typeof window === "undefined") return "default-room";
    return window.location.pathname.replaceAll("/", "-") || "root";
  }, []);

  const [label] = useState(() => randomLabel());
  const { pointers, clientId, color, updatePosition } = usePresence(roomId, label);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) {
      setDropError("No file received. Try again.");
      return;
    }
    const file = files[0];
    
    // Upload file to server
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setDropError(null);
      setFileUrl(data.fileUrl);
      setFileName(data.filename);
    } catch (error) {
      console.error('Upload error:', error);
      setDropError('Failed to upload file. Please try again.');
    }
  }, [roomId]);

  // Listen for file uploads from other clients
  useEffect(() => {
    if (!clientId) return;
    
    const socket = (window as any).__socket;
    if (!socket) return;
    
    const handleFileUploaded = ({ fileUrl, filename }: { fileUrl: string; filename: string }) => {
      console.log('File uploaded by another user:', filename);
      setFileUrl(fileUrl);
      setFileName(filename);
    };
    
    socket.on('file-uploaded', handleFileUploaded);
    
    return () => {
      socket.off('file-uploaded', handleFileUploaded);
    };
  }, [clientId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    onDropAccepted: handleFiles,
    multiple: false,
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors?.[0]?.message ?? "File rejected.";
      setDropError(`${reason} Try selecting the file manually.`);
    },
    noClick: false,
    noKeyboard: false,
    accept: undefined // allow any file; IFCs often come with uncommon MIME types
  });

  const onManualSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      handleFiles(files);
    },
    [handleFiles]
  );

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return (
    <div className="grid">
      <section>
        <div className="dropzone" {...getRootProps()} style={{ borderColor: isDragActive ? "var(--accent)" : "var(--border)" }}>
          <input {...getInputProps()} />
          <h1 style={{ margin: "0 0 8px", color: "var(--text)" }}>Drop an IFC file</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            We will load it locally in your browser and share pointer positions through a lightweight webhook.
          </p>
          {dropError ? (
            <p style={{ marginTop: 8, color: "#f97316" }}>{dropError}</p>
          ) : null}
          <label style={{ marginTop: 10, display: "inline-flex", gap: 8, alignItems: "center", color: "#cbd5e1", fontSize: 13 }}>
            <span style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              Browse IFC
            </span>
            <input
              type="file"
              accept=".ifc"
              onChange={onManualSelect}
              style={{ display: "none" }}
            />
            <span>Click if drag/drop fails.</span>
          </label>
        </div>

        <div style={{ marginTop: 16, position: "relative" }}>
          <IfcViewer 
            fileUrl={fileUrl} 
            pointers={pointers}
            onCameraUpdate={updatePosition}
          />
        </div>
      </section>

      <aside className="sidebar">
        <div className="tag" style={{ marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
          {label}
        </div>
        <div className="stat">
          <span>Active pointers</span>
          <strong>{Object.keys(pointers).length}</strong>
        </div>
        <div className="stat">
          <span>Room</span>
          <code style={{ fontSize: 12 }}>{roomId}</code>
        </div>
        <div className="stat">
          <span>File</span>
          <span>{fileName ?? "Waiting for drop"}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <small>Copy the URL to invite teammates. Cursors sync every ~1.2s via the webhook endpoint.</small>
        </div>
        <div style={{ marginTop: 12 }}>
          <small>Make sure <code>public/wasm/web-ifc.wasm</code> exists. If not, copy it from <code>node_modules/web-ifc/web-ifc.wasm</code>.</small>
        </div>
      </aside>
    </div>
  );
}
