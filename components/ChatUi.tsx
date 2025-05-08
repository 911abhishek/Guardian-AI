import React, { useState, useEffect, useRef } from "react";


const ChatUi = () => {
  const [messages, setMessages] = useState<
    { sender: "user" | "bot"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: { sender: "user" | "bot"; text: string } = { sender: "user", text: input };
    const botMessage: { sender: "user" | "bot"; text: string } = {
      sender: "bot",
      text: `You said: "${input}". (Pretend this is an AI response!)`,
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput("");
  };

  return (
    <div className="fixed top-0 left-0 h-full w-[350px] bg-white border-r border-gray-200 shadow-lg z-[9999] flex flex-col">
      <div className="text-xl font-semibold p-4 border-b">Guardian AI</div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-900 flex items-center gap-2"
              }`}
            >
              {msg.sender === "bot" && <span className="text-lg">🧠</span>}
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t flex items-center gap-2">
        <input
          type="text"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
};
export default ChatUi