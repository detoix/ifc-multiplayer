"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { IfcViewer } from "@/app/components/IfcViewer";
import { usePresence } from "@/app/lib/usePresence";

const randomLabel = () => {
  const names = ["Falcon", "Quartz", "Lyra", "Cobalt", "Nova", "Atlas", "Delta", "Echo"];
  return names[Math.floor(Math.random() * names.length)];
};

export function Room({ initialRoomId }: { initialRoomId?: string }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const [label, setLabel] = useState<string | null>(null);

  const pathname = usePathname();
  const roomId = useMemo(() => {
    if (initialRoomId) return initialRoomId;
    if (typeof window === "undefined") return "default-room";
    return pathname?.replaceAll("/", "-") || "root";
  }, [initialRoomId, pathname]);

  useEffect(() => {
    setLabel(randomLabel());
  }, []);
  const { pointers, clientId, color, updatePosition, socket } = usePresence(roomId, label);
  const router = useRouter();

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) {
      setDropError("No file received. Try again.");
      return;
    }
    const file = files[0];
    
    // Generate a new room ID for the dropped file
    const newRoomId = crypto.randomUUID();
    
    // Upload file to server
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', newRoomId);
    
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
      
      // Navigate to the new room
      router.push(`/${newRoomId}`);
    } catch (error) {
      console.error('Upload error:', error);
      setDropError('Failed to upload file. Please try again.');
    }
  }, [router]);

  // Fetch existing file for the room
  useEffect(() => {
    console.log('Room useEffect triggered. roomId:', roomId);
    if (!roomId) return;

    console.log('Fetching file for roomId:', roomId);
    fetch(`/api/room-file?roomId=${roomId}`)
      .then(res => {
        console.log('Fetch response status:', res.status);
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data) {
          console.log('Loaded file from API:', data.filename);
          setFileUrl(data.fileUrl);
          setFileName(data.filename);
        } else {
          console.log('No file data returned from API');
        }
      })
      .catch(err => console.error('Failed to fetch room file:', err));
  }, [roomId]);

  // Listen for file uploads from other clients
  useEffect(() => {
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
  }, [socket]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFiles,
    onDropAccepted: handleFiles,
    multiple: false,
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors?.[0]?.message ?? "File rejected.";
      setDropError(`${reason} Try selecting the file manually.`);
    },
    noClick: true, // Disable click on container, use button instead
    noKeyboard: false,
    accept: undefined // allow any file; IFCs often come with uncommon MIME types
  });

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
          <div style={{ marginTop: 10, display: "inline-flex", gap: 8, alignItems: "center", color: "#cbd5e1", fontSize: 13 }}>
            <button 
              type="button"
              onClick={open}
              style={{ 
                padding: "6px 10px", 
                border: "1px solid var(--border)", 
                borderRadius: 8, 
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                font: "inherit",
                cursor: "pointer"
              }}
            >
              Browse IFC
            </button>
            <span>Click if drag/drop fails.</span>
          </div>
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
