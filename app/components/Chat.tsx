import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/app/lib/usePresence";
import type { UserIdentity } from "@/app/lib/identity";

export const Chat = ({ 
  messages, 
  onSendMessage, 
  identity 
}: { 
  messages: ChatMessage[]; 
  onSendMessage: (text: string) => void;
  identity: UserIdentity | null;
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "300px", marginTop: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: "#94a3b8" }}>
        Chat
      </div>
      
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        background: "rgba(0,0,0,0.1)", 
        borderRadius: "8px", 
        padding: "8px",
        marginBottom: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}>
        {messages.length === 0 && (
          <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", marginTop: "20px" }}>
            No messages yet.
          </div>
        )}
        
        {messages.map((msg) => {
          if (msg.type === "event") {
            return (
              <div key={msg.id} style={{ fontSize: "11px", color: "#64748b", textAlign: "center", margin: "4px 0" }}>
                {msg.text}
              </div>
            );
          }
          
          const isMe = identity && msg.senderId === identity.id;
          return (
            <div key={msg.id} style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: isMe ? "flex-end" : "flex-start" 
            }}>
              <div style={{ fontSize: "10px", color: msg.color || "#ccc", marginBottom: "2px", marginLeft: "4px", marginRight: "4px" }}>
                {msg.senderName}
              </div>
              <div style={{
                background: isMe ? "#2563eb" : "#334155",
                color: "white",
                padding: "6px 10px",
                borderRadius: "12px",
                borderBottomRightRadius: isMe ? "2px" : "12px",
                borderBottomLeftRadius: isMe ? "12px" : "2px",
                fontSize: "13px",
                maxWidth: "90%",
                wordBreak: "break-word"
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={identity ? "Type a message..." : "Join to chat"}
          disabled={!identity}
          style={{
            flex: 1,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px 10px",
            color: "white",
            fontSize: "13px",
            outline: "none"
          }}
        />
        <button
          type="submit"
          disabled={!identity || !inputText.trim()}
          style={{
            background: identity && inputText.trim() ? "var(--accent)" : "#334155",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "0 12px",
            cursor: identity && inputText.trim() ? "pointer" : "not-allowed",
            fontSize: "13px"
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
