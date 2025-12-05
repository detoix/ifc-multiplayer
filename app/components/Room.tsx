"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { IfcViewer } from "@/app/components/IfcViewer";
import { usePresence } from "@/app/lib/usePresence";

import { JoinDialog } from "@/app/components/JoinDialog";
import type { UserIdentity } from "@/app/lib/identity";

import { Chat } from "@/app/components/Chat";

const randomLabel = () => {
  const names = ["Falcon", "Quartz", "Lyra", "Cobalt", "Nova", "Atlas", "Delta", "Echo"];
  return names[Math.floor(Math.random() * names.length)];
};

export function Room({ initialRoomId }: { initialRoomId?: string }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roomId = useMemo(() => {
    if (initialRoomId) return initialRoomId;
    if (typeof window === "undefined") return "default-room";
    // Handle root path specifically
    if (!pathname || pathname === "/") return "default-room";
    // Remove leading slash if present, then replace slashes with dashes
    const path = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    return path.replaceAll("/", "-") || "default-room";
  }, [initialRoomId, pathname]);

  const { pointers, selections, messages, updatePosition, updateSelection, sendChatMessage } = usePresence(roomId, identity);
  const router = useRouter();

  // Current follow target is encoded in the URL as ?follow=<username>
  const followName = searchParams?.get("follow") || null;

  // Helper to update the follow query param (single source of truth)
  const setFollowParam = useCallback((name: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (name) {
      url.searchParams.set("follow", name);
    } else {
      url.searchParams.delete("follow");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Resolve follow target label to a concrete pointer ID when that user appears
  const followingUserId = useMemo(() => {
    if (!followName) return null;
    const entry = Object.entries(pointers).find(([_, p]) =>
      p.label === followName || p.label.toLowerCase() === followName.toLowerCase()
    );
    return entry ? entry[0] : null;
  }, [followName, pointers]);

  const handleSendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) {
      const parts = trimmed.split(" ");
      const command = parts[0].toLowerCase();

      if (command === "/follow" || command === "/f") {
        const potentialName = parts.slice(1).join(" ").replace("@", "").trim();
        if (!potentialName) {
          console.warn("No username provided to follow.");
          return;
        }
        // Try exact match first, then case-insensitive
        const targetEntry = Object.entries(pointers).find(([_, p]) => 
          p.label === potentialName || p.label.toLowerCase() === potentialName.toLowerCase()
        );
        
        if (targetEntry) {
          setFollowParam(targetEntry[1].label);
        }
        return; // Consume the command so it doesn't send as chat
      }
    }
    sendChatMessage(text);
  }, [pointers, sendChatMessage, setFollowParam]);

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

  // Listen for file uploads from other clients via Pusher
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const PusherClient = require('pusher-js');
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;
    
    // Use existing global instance or create new one
    const pusher = (window as any).__pusherInstance || new PusherClient(key, { cluster });
    (window as any).__pusherInstance = pusher;
    
    const channel = pusher.subscribe(`room-${roomId}`);
    
    const handleFileUploaded = ({ fileUrl, filename }: { fileUrl: string; filename: string }) => {
      console.log('File uploaded by another user:', filename);
      setFileUrl(fileUrl);
      setFileName(filename);
    };
    
    channel.bind('file-uploaded', handleFileUploaded);
    
    return () => {
      channel.unbind('file-uploaded', handleFileUploaded);
    };
  }, [roomId]);

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
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            We will load it locally in your browser and share pointer positions through a lightweight webhook.
          </p>
          {dropError ? (
            <p style={{ marginTop: 8, color: "var(--danger)" }}>{dropError}</p>
          ) : null}
          <div style={{ marginTop: 10, display: "inline-flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
            <button 
              type="button"
              onClick={open}
              style={{ 
                padding: "6px 10px", 
                border: "1px solid var(--border)", 
                borderRadius: 4, 
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
            selections={selections}
            onSelectionChange={updateSelection}
            followingUserId={followingUserId}
            onStopFollowing={() => {
              setFollowParam(null);
            }}
          />
        </div>
      </section>

      <aside className="sidebar">
        <div className="tag" style={{ marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: identity?.color || "var(--text-muted)" }} />
          {identity?.name || "Connecting..."}
        </div>
        <div className="stat">
          <span>Active pointers</span>
          <strong>{Object.keys(pointers).length}</strong>
        </div>
        {followingUserId && pointers[followingUserId] && (
          <div className="stat">
            <span>Following</span>
            <span>
              @{pointers[followingUserId].label}
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)" }}>
                (drag or scroll to stop)
              </span>
            </span>
          </div>
        )}
        <div className="stat">
          <span>Room</span>
          <code style={{ fontSize: 12, color: "var(--accent)" }}>{roomId}</code>
        </div>
        <div className="stat">
          <span>File</span>
          <span style={{ color: fileName ? "var(--text)" : "var(--text-muted)" }}>{fileName ?? "Waiting for drop"}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <small>Copy the URL to invite teammates. Cursors sync every ~1.2s via the webhook endpoint.</small>
        </div>
        <div style={{ marginTop: 12 }}>
          <small>Make sure <code>public/wasm/web-ifc.wasm</code> exists. If not, copy it from <code>node_modules/web-ifc/web-ifc.wasm</code>.</small>
        </div>
        {identity && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (typeof window === "undefined") return;
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.set("follow", identity.name);
                  const shareUrl = url.toString();
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrl).catch(() => {
                      // ignore clipboard errors silently
                    });
                  }
                  // As a fallback, we could show the URL somewhere in the UI if needed.
                } catch {
                  // ignore URL construction errors
                }
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                background: "white",
                color: "var(--accent)",
                font: "inherit",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fff7ed";
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#fed7aa";
              }}
            >
              Share “follow me” link
            </button>
          </div>
        )}
        
        <Chat 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          identity={identity} 
          users={pointers}
        />

      </aside>
      <JoinDialog onJoin={setIdentity} />
    </div>
  );
}
