"use client";

import { Sparkles, Send, Loader2, ExternalLink } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";

// Design system colors
const colors = {
  bg: "#FFFEFB",
  textPrimary: "#09162F",
  textSecondary: "#42515A",
  accent: "#223D48",
  accentLight: "#1C7BBB",
  border: "#C6D2D9",
};

interface ToolResult {
  success: boolean;
  snapApp?: {
    id: string;
    title: string;
    type: string;
    shareUrl: string;
  };
  message?: string;
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResult?: ToolResult;
}

function WelcomeMessage({
  onExampleClick,
}: {
  onExampleClick: (text: string) => void;
}) {
  const examples = [
    "Create a price comparison for laptop deals",
    "Make an article summary about AI trends",
    "Build a product gallery of wireless headphones",
    "Create a data table comparing cloud providers",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: `${colors.accentLight}15` }}
      >
        <Sparkles size={32} style={{ color: colors.accentLight }} />
      </div>
      <h2
        className="text-2xl font-semibold mb-3"
        style={{ color: colors.textPrimary }}
      >
        Welcome to Snap App Author
      </h2>
      <p
        className="text-base mb-8 max-w-md"
        style={{ color: colors.textSecondary }}
      >
        Describe what you want to create, and I will help you build an
        interactive Snap App.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {examples.map((example, i) => (
          <button
            key={i}
            onClick={() => onExampleClick(example)}
            className="text-left px-4 py-3 rounded-xl border transition-all hover:border-[#1C7BBB] hover:bg-[#1C7BBB]/5"
            style={{
              borderColor: colors.border,
              color: colors.textSecondary,
            }}
          >
            <span className="text-sm">{example}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Loader2
        size={16}
        className="animate-spin"
        style={{ color: colors.accentLight }}
      />
      <span className="text-sm" style={{ color: colors.textSecondary }}>
        Thinking...
      </span>
    </div>
  );
}

function ToolResultCard({ result }: { result: ToolResult }) {
  if (result.success && result.snapApp) {
    return (
      <div
        className="rounded-xl border p-4 my-2"
        style={{
          backgroundColor: "#10B98115",
          borderColor: "#10B98130",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[#059669] mb-1">
              Snap App Created!
            </div>
            <div
              className="text-base font-semibold mb-1"
              style={{ color: colors.textPrimary }}
            >
              {result.snapApp.title}
            </div>
            <div className="text-xs" style={{ color: colors.textSecondary }}>
              Type: {result.snapApp.type.replace("_", " ")}
            </div>
          </div>
          <a
            href={result.snapApp.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: colors.accentLight,
              color: "#FFFFFF",
            }}
          >
            View
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div
        className="rounded-xl border p-4 my-2"
        style={{
          backgroundColor: "#EF444415",
          borderColor: "#EF444430",
        }}
      >
        <div className="text-sm font-medium text-red-600 mb-1">
          Failed to create Snap App
        </div>
        <div className="text-xs text-red-500">{result.error}</div>
      </div>
    );
  }

  return null;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className="space-y-2">
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] px-4 py-3 rounded-2xl ${
            isUser ? "rounded-br-md" : "rounded-bl-md"
          }`}
          style={{
            backgroundColor: isUser ? colors.accent : "#F3F4F6",
            color: isUser ? "#FFFFFF" : colors.textPrimary,
          }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
      {message.toolResult && <ToolResultCard result={message.toolResult} />}
    </div>
  );
}

export default function AuthorPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleExampleClick = (text: string) => {
    setInput(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const sendMessage = useCallback(async (userMessage: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/author/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let toolResult: ToolResult | undefined;
      const assistantId = crypto.randomUUID();

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "text-delta" && parsed.delta) {
                assistantContent += parsed.delta;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }

              if (parsed.type === "tool-result" && parsed.result) {
                toolResult = parsed.result;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, toolResult }
                      : m
                  )
                );
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input;
    setInput("");
    await sendMessage(userInput);
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: colors.border }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${colors.accentLight}15` }}
        >
          <Sparkles size={20} style={{ color: colors.accentLight }} />
        </div>
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Snap App Author
          </h1>
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            Create interactive content with AI
          </p>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeMessage onExampleClick={handleExampleClick} />
        ) : (
          <div className="px-4 py-6 space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <LoadingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input Bar */}
      <footer
        className="border-t px-4 py-4"
        style={{ borderColor: colors.border }}
      >
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-xl border"
            style={{
              borderColor: colors.border,
              backgroundColor: "#FFFFFF",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Describe the Snap App you want to create..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: colors.textPrimary }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                backgroundColor: input.trim() ? colors.accentLight : colors.border,
                color: "#FFFFFF",
              }}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
