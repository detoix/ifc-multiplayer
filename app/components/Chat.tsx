import React, { useState, useRef, useEffect, useMemo } from "react";
import type { ChatMessage, PresenceMap } from "@/app/lib/usePresence";
import type { UserIdentity } from "@/app/lib/identity";

const COMMANDS = ["/follow"];

export const Chat = ({ 
  messages, 
  onSendMessage, 
  identity,
  users = {}
}: { 
  messages: ChatMessage[]; 
  onSendMessage: (text: string) => void;
  identity: UserIdentity | null;
  users?: PresenceMap;
}) => {
  const [inputText, setInputText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive list of other user names from pointers (users prop) and chat messages.
  // This way autocomplete still works even if the users prop is empty,
  // as long as others have sent at least one chat message.
  const otherUsers = useMemo(() => {
    const fromPointers = Object.values(users).map((u) => u.label);
    const fromMessages = messages
      .map((m) => m.senderName)
      .filter((n): n is string => Boolean(n));

    const merged = Array.from(new Set([...fromPointers, ...fromMessages]));
    return identity ? merged.filter((name) => name !== identity.name) : merged;
  }, [users, messages, identity]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle autocomplete logic
  useEffect(() => {
    const text = inputText;
    
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0];

      if (parts.length === 1) {
        // Suggest commands
        const matches = COMMANDS.filter(c => c.startsWith(cmd.toLowerCase()));
        if (matches.length > 0) {
          setSuggestions(matches);
          setShowSuggestions(true);
          setSelectedIndex(0);
          return;
        }
      } else if (cmd.toLowerCase() === "/follow") {
        // Suggest users
        // Everything after "/follow "
        const rawQuery = text.substring(cmd.length + 1).trim(); 
        const queryName = rawQuery.startsWith("@") ? rawQuery.slice(1) : rawQuery;
        const loweredQuery = queryName.toLowerCase();

        const matches = otherUsers
          .filter(name => 
            // If query is empty, show everyone; otherwise filter by substring
            loweredQuery === "" || name.toLowerCase().includes(loweredQuery)
          )
          .map(name => `@${name}`);

        if (matches.length > 0) {
            setSuggestions(matches);
            setShowSuggestions(true);
            setSelectedIndex(0);
            return;
        }
      }
    }
    
    setShowSuggestions(false);
  }, [inputText, users, identity, otherUsers]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
    setShowSuggestions(false);
  };

  const completeSuggestion = (suggestion: string) => {
    const parts = inputText.split(" ");
    if (parts.length <= 1) {
        // Completing command
        setInputText(`${suggestion} `);
    } else {
        // Completing argument
        const cmd = parts[0];
        setInputText(`${cmd} ${suggestion}`); // replace everything after command
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "Tab") {
      e.preventDefault();
      completeSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "300px", marginTop: "16px", position: "relative" }}>
      <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: "#94a3b8" }}>
        Chat
      </div>
      
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        background: "white", 
        borderRadius: "12px", 
        padding: "12px",
        marginBottom: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        border: "1px solid #f1f5f9",
        boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.01)"
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
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px", marginLeft: "4px", marginRight: "4px" }}>
                {msg.senderName}
              </div>
              <div style={{
                background: isMe ? "var(--accent)" : "white",
                color: isMe ? "white" : "var(--text)",
                padding: "8px 12px",
                borderRadius: "12px",
                borderBottomRightRadius: isMe ? "2px" : "12px",
                borderBottomLeftRadius: isMe ? "12px" : "2px",
                fontSize: "13px",
                maxWidth: "90%",
                wordBreak: "break-word",
                fontWeight: 500,
                boxShadow: isMe ? "0 2px 4px rgba(249, 115, 22, 0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
                border: isMe ? "none" : "1px solid #e2e8f0"
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Autocomplete Popup */}
      {showSuggestions && (
          <div style={{
              position: "absolute",
              bottom: "40px",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              zIndex: 20,
              maxHeight: "150px",
              overflowY: "auto"
          }}>
              {suggestions.map((s, i) => (
                  <div 
                    key={s}
                    onClick={() => completeSuggestion(s)}
                    style={{
                        padding: "8px 12px",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: i === selectedIndex ? "#fff7ed" : "transparent",
                        color: i === selectedIndex ? "var(--accent)" : "var(--text)"
                    }}
                  >
                      {s}
                  </div>
              ))}
          </div>
      )}

      <form onSubmit={handleSend} style={{ display: "flex", gap: "8px" }}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={identity ? "Type a message..." : "Join to chat"}
          disabled={!identity}
          style={{
            flex: 1,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "8px 12px",
            color: "var(--text)",
            fontSize: "13px",
            outline: "none",
            fontFamily: "inherit",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
          }}
        />
        <button
          type="submit"
          disabled={!identity || !inputText.trim()}
          style={{
            background: identity && inputText.trim() ? "var(--accent)" : "#f1f5f9",
            color: identity && inputText.trim() ? "white" : "#94a3b8",
            border: "none",
            borderRadius: "8px",
            padding: "0 16px",
            cursor: identity && inputText.trim() ? "pointer" : "not-allowed",
            fontSize: "13px",
            fontWeight: 600,
            transition: "all 0.2s"
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
