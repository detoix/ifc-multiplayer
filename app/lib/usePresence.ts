"use client";

import React, { useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import type { UserIdentity } from "./identity";

export type PointerPayload = {
  position: [number, number, number]; // Camera position
  direction: [number, number, number]; // Camera look direction
  color: string;
  label: string;
};
export type SelectionPayload = {
  expressId: number | null;
  color: string;
};
export type PresenceMap = Record<string, PointerPayload>;
export type SelectionMap = Record<string, SelectionPayload>;

const getClientId = () => {
  if (typeof window === "undefined") return "server";
  const stored = window.sessionStorage.getItem("ifc-presence-client-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  window.sessionStorage.setItem("ifc-presence-client-id", id);
  return id;
};

// Module-level singleton - only created once
let pusherInstance: PusherClient | null = null;

export type ChatMessage = {
  id: string;
  type: "chat" | "event";
  senderId?: string;
  senderName?: string;
  text: string;
  timestamp: number;
  color?: string;
};

export const usePresence = (roomId: string, identity: UserIdentity | null) => {
  const [pointers, setPointers] = useState<PresenceMap>({});
  const [selections, setSelections] = useState<SelectionMap>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastSent = useRef(0);

  // Initialize pointer ref with identity if available, otherwise defaults
  const pointerRef = useRef<PointerPayload>({
    position: [0, 0, 0],
    direction: [0, 0, -1],
    color: identity?.color || "#a855f7",
    label: identity?.name || "Anonymous"
  });

  const channelRef = useRef<any>(null);
  const hasAnnouncedLeaveRef = useRef(false);
  const hasSentInitialPointerRef = useRef(false);

  // Update pointer ref when identity changes
  useEffect(() => {
    if (identity) {
      pointerRef.current.color = identity.color;
      pointerRef.current.label = identity.name;
    }
  }, [identity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return; // Wait for identity

    // Create singleton Pusher instance
    if (!pusherInstance) {
      const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
      const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
      if (!key || !cluster) {
        console.warn("Pusher credentials not configured");
        return;
      }
      pusherInstance = new PusherClient(key, { cluster });
    }

    const channelName = `room-${roomId}`;
    const channel = pusherInstance.subscribe(channelName);
    channelRef.current = channel;
    hasAnnouncedLeaveRef.current = false;

    // Announce that we joined the room so others know immediately
    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: channelName,
        event: "user-joined",
        data: { senderId: identity.id, name: identity.name, color: identity.color }
      })
    }).catch(console.error);

    // Handle pointer updates from other users
    const handlePointerUpdate = ({ senderId, pointer }: { senderId: string; pointer: PointerPayload }) => {
      // Ignore our own updates
      if (senderId === identity.id) return;

      setPointers((prev) => ({
        ...prev,
        [senderId]: pointer
      }));
    };

    const handleSelectionUpdate = ({ senderId, selection }: { senderId: string; selection: SelectionPayload }) => {
      // Track selections for all users, including ourselves, so that
      // each client has exactly one active highlight per user.
      setSelections((prev) => ({
        ...prev,
        [senderId]: selection
      }));
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-49), msg]);
    };

    // Handle user leaving
    const handleUserLeft = ({ senderId }: { senderId: string }) => {
      setPointers((prev) => {
        const next = { ...prev };
        const label = next[senderId]?.label || prev[senderId]?.label;
        delete next[senderId];

        if (label) {
          const leaveMsg: ChatMessage = {
            id: crypto.randomUUID(),
            type: "event",
            text: `${label} left the room`,
            timestamp: Date.now()
          };
          setMessages((prev) => [...prev.slice(-49), leaveMsg]);
        }
        return next;
      });
      setSelections((prev) => {
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    };

    // Handle user joining
    const handleUserJoined = ({ senderId, name }: { senderId: string; name: string }) => {
      if (senderId === identity.id) return;
      const joinMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: "event",
        text: `${name} joined the room`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev.slice(-49), joinMsg]);
    };

    channel.bind("pointer-update", handlePointerUpdate);
    channel.bind("selection-update", handleSelectionUpdate);
    channel.bind("chat-message", handleChatMessage);
    channel.bind("user-left", handleUserLeft);
    channel.bind("user-joined", handleUserJoined);

    return () => {
      channel.unbind("pointer-update", handlePointerUpdate);
      channel.unbind("selection-update", handleSelectionUpdate);
      channel.unbind("chat-message", handleChatMessage);
      channel.unbind("user-left", handleUserLeft);
      channel.unbind("user-joined", handleUserJoined);
      pusherInstance?.unsubscribe(channelName);
      setPointers({});
      setSelections({});
    };
  }, [roomId, identity]);

  // As soon as we have an identity, send one pointer update
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;
    if (hasSentInitialPointerRef.current) return;

    hasSentInitialPointerRef.current = true;

    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "pointer-update",
        data: { senderId: identity.id, pointer: pointerRef.current }
      })
    }).catch(console.error);
  }, [roomId, identity]);

  // Helper to announce that we are leaving the room
  const announceLeave = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;
    if (hasAnnouncedLeaveRef.current) return;
    hasAnnouncedLeaveRef.current = true;

    const channelName = `room-${roomId}`;
    const payload = {
      channel: channelName,
      event: "user-left",
      data: { senderId: identity.id }
    };

    try {
      const body = JSON.stringify(payload);
      const url = "/api/pusher";

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true
        }).catch(console.error);
      }
    } catch (e) {
      console.error("Failed to announce leave", e);
    }
  }, [roomId, identity]);

  // Announce leave on unmount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) return;

    const handleBeforeUnload = () => {
      announceLeave();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      announceLeave();
    };
  }, [announceLeave, identity]);

  const updatePosition = React.useCallback((position: [number, number, number], direction: [number, number, number]) => {
    pointerRef.current.position = position;
    pointerRef.current.direction = direction;

    if (!identity) return;

    // Send via API route
    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "pointer-update",
        data: { senderId: identity.id, pointer: pointerRef.current }
      })
    }).catch(console.error);
  }, [roomId, identity]);

  const updateSelection = React.useCallback((expressId: number | null) => {
    if (!identity) return;
    const selectionPayload: SelectionPayload = {
      expressId,
      color: identity.color
    };

    setSelections((prev) => ({
      ...prev,
      [identity.id]: selectionPayload
    }));

    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "selection-update",
        data: { senderId: identity.id, selection: selectionPayload }
      })
    }).catch(console.error);
  }, [roomId, identity]);

  const sendChatMessage = React.useCallback((text: string) => {
    if (!identity || !text.trim()) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      type: "chat",
      senderId: identity.id,
      senderName: identity.name,
      text: text.trim(),
      timestamp: Date.now(),
      color: identity.color
    };

    // Add locally immediately
    // Note: If we broadcast to self via Pusher too, we might duplicate.
    // Usually better to wait for Pusher event for consistency, OR optimistically update.
    // Given the previous pattern, let's wait for pusher event OR assume pusher event is broadcast to everyone including sender.
    // Pusher usually excludes the sender if triggered from client with socketId, but we are triggering via server API.
    // The server API trigger sends to everyone on the channel.
    // So if we also add it locally here, we will see it twice unless we de-dupe.

    // Let's just rely on the Pusher event loop for simplicity and ordering.
    // BUT, generic pusher trigger usually sends to everyone.

    fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: "chat-message",
        data: msg
      })
    }).catch(console.error);
  }, [roomId, identity]);

  return { pointers, selections, messages, updatePosition, updateSelection, sendChatMessage } as const;
};
