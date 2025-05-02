import React, { useState, useEffect } from "react";
import "@/assets/main.css";

function App() {
  // Image Blur Settings states
  const [mode, setMode] = useState("normal");
  const [isEnabled, setIsEnabled] = useState(false);
  const [focusOn, setFocusOn] = useState(false);

  // YouTube Chat states
  const [transcript, setTranscript] = useState("");
  type Message = { role: "user" | "gemini"; content: string };
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcriptStatus, setTranscriptStatus] = useState("idle");
  const [activeTab, setActiveTab] = useState("settings");
  const [isYouTubeVideo, setIsYouTubeVideo] = useState(false);

  // Check if current tab is a YouTube video
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
      const isYouTube = url.includes("youtube.com/watch");
      setIsYouTubeVideo(isYouTube);

      if (isYouTube && focusOn) {
        fetchTranscript();
      }
    });
  }, [focusOn]);

  // Load saved settings
  useEffect(() => {
    chrome.storage.sync.get(["mode", "isEnabled"], (data) => {
      setMode(data.mode || "normal");
      setIsEnabled(data.isEnabled !== false); // Default to true if undefined
    });

    chrome.storage.local.get("showZenUI", (res) => {
      setFocusOn(res.showZenUI ?? true);
    });
  }, []);
//gemini
  const fetchTranscript = () => {
    setTranscriptStatus("loading");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0].url || "";
      const videoId = new URLSearchParams(new URL(url).search).get("v");
      if (!videoId) {
        console.error("[Popup] No video ID found in URL.");
        setTranscriptStatus("error");
        return;
      }

      console.log("[Popup] Requesting transcript for video ID:", videoId);

      chrome.runtime.sendMessage(
        { type: "FETCH_TRANSCRIPT", videoId },
        (res) => {
          if (res?.status === "success") {
            console.log("[Popup] Transcript fetched.");
            setTranscript(res.transcript);
            setTranscriptStatus("success");
          } else {
            console.error("[Popup] Failed to fetch transcript:", res?.error);
            setTranscriptStatus("error");
          }
        }
      );
    });
  };

  const askGemini = () => {
    if (!userInput.trim()) return;
    const prompt = `Transcript: ${transcript}\n\nUser: ${userInput}`;
    const userMsg: Message = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setUserInput("");
    setLoading(true);

    chrome.runtime.sendMessage({ type: "ASK_GEMINI", prompt }, (res) => {
      const geminiMsg: Message = {
        role: "gemini",
        content: res?.text || "No response from Gemini.",
      };
      setMessages((prev) => [...prev, geminiMsg]);
      setLoading(false);
    });
  };



  // ✅ Convert [mm:ss] to seconds and send to content script
  const handleTimestampClick = async (timestamp: string) => {
    console.log("clicked at pop")
    const [min, sec] = timestamp.slice(1, -1).split(":").map(Number);
    const seconds = min * 60 + sec;
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    chrome.tabs.sendMessage(tab.id!, {
      type: "SEEK_TO_TIMESTAMP",
      seconds,
    });
  };
  // ✅ Render message content with clickable timestamps
  const renderWithTimestamps = (text: string) => {
    const parts = text.split(/(\[\d{2}:\d{2}\])/g); // e.g. [03:15]
    
    return parts.map((part, idx) => {
      if (/^\[\d{2}:\d{2}\]$/.test(part)) {
        return (
          <span
            key={idx}
            className="text-blue-600 underline cursor-pointer hover:opacity-80"
            onClick={() => handleTimestampClick(part)}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const toggle = () => {
    const newValue = !focusOn;
    setFocusOn(newValue);

    chrome.storage.local.set({ showZenUI: newValue });

    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              chrome.storage.local.get("showZenUI").then(({ showZenUI }) => {
                if (showZenUI) {
                  document.documentElement.classList.add("zen-mode");
                } else {
                  document.documentElement.classList.remove("zen-mode");
                  const existing = document.getElementById("zen-ui-root");
                  if (existing) existing.remove();
                }
              });
            },
          });
        }
      }
    });

    // If turning focus mode on and we're on YouTube, fetch transcript
    if (newValue && isYouTubeVideo) {
      fetchTranscript();
    }
  };

  const handleModeToggle = () => {
    const newMode = mode === "normal" ? "strict" : "normal";
    setMode(newMode);
    chrome.storage.sync.set({ mode: newMode });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { mode: newMode, isEnabled });
      }
    });
  };

  const handleEnableToggle = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    chrome.storage.sync.set({ isEnabled: newEnabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { mode, isEnabled: newEnabled });
      }
    });
  };

  return (
    <div className="w-96 bg-gray-900 text-gray-200 rounded-lg shadow-lg overflow-hidden">
      {/* Header with Logo */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 flex flex-col items-center justify-center">
        <div className="flex items-center mb-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-cyan-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-white">Guardian AI</h1>
        </div>

        {/* Show tabs only if YouTube focus mode is on and we're on a YouTube video */}
        {focusOn && isYouTubeVideo && (
          <div className="flex space-x-2 mt-3 w-full">
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "settings"
                  ? "bg-indigo-700 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-indigo-700 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              YouTube Chat
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Settings Tab */}
        {(!focusOn || !isYouTubeVideo || activeTab === "settings") && (
          <div className="space-y-5">
            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
              <span className="text-sm font-medium">
                Image Shield {isEnabled ? "On" : "Off"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isEnabled}
                  onChange={handleEnableToggle}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
              <div>
                <span className="text-sm font-medium">YouTube Focus Mode</span>
                {isYouTubeVideo && (
                  <p className="text-xs text-cyan-400 mt-1">
                    {focusOn
                      ? "Focus mode is active"
                      : "Enable to access YouTube Chat"}
                  </p>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={focusOn}
                  onChange={toggle}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
              <span className="text-sm font-medium">
                {mode === "normal" ? "Normal Filter" : "Strict Filter"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={mode === "strict"}
                  onChange={handleModeToggle}
                  disabled={!isEnabled}
                />
                <div
                  className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    isEnabled ? "peer-checked:bg-cyan-600" : "bg-gray-600"
                  }`}
                ></div>
              </label>
            </div>

            <p className="text-xs text-gray-400 bg-gray-800 p-3 rounded-lg">
              {isEnabled
                ? mode === "normal"
                  ? "Normal: Shields porn and hentai images."
                  : "Strict: Shields porn, hentai, sexy, and drawing images."
                : "Image Shield is disabled. No images will be filtered."}
            </p>

            {focusOn && isYouTubeVideo && (
              <button
                onClick={() => setActiveTab("chat")}
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-white py-2 rounded-md mt-2 font-medium text-sm transition-colors flex items-center justify-center"
              >
                <span className="mr-2">🎬</span> Chat with this YouTube Video
              </button>
            )}
          </div>
        )}

        {/* YouTube Chat Tab - Only shown if Focus Mode is ON and we're on YouTube */}
        {focusOn && isYouTubeVideo && activeTab === "chat" && (
          <div className="h-[460px] flex flex-col">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-cyan-400">
                🎬 Chat with YouTube Video
              </h2>

              {transcriptStatus === "loading" && (
                <p className="text-yellow-500 text-xs animate-pulse">
                  ⏳ Fetching transcript...
                </p>
              )}

              {transcriptStatus === "error" && (
                <div className="text-center mb-3">
                  <p className="text-red-400 text-xs mb-1">
                    ❌ Failed to fetch transcript.
                  </p>
                  <button
                    className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                    onClick={fetchTranscript}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {transcriptStatus === "success" && (
              <>
                <div className="flex-1 overflow-y-auto mb-3 border border-gray-700 rounded-md p-3 bg-gray-800 space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <p className="text-sm">
                        Ask Guardian AI about this video!
                      </p>
                      <p className="text-xs mt-2">
                        Try questions like "What is this video about?" or
                        "Summarize the key points"
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2 text-sm rounded-md whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-indigo-900 text-gray-200 ml-10 text-right"
                            : "bg-gray-700 text-gray-200 mr-10 text-left"
                        }`}
                      >
                        {msg.role === "gemini"
                          ? renderWithTimestamps(msg.content)
                          : msg.content}
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="text-gray-400 italic p-2 bg-gray-700 rounded animate-pulse">
                      Guardian AI is thinking...
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    className="flex-1 border border-gray-600 rounded-md p-2 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 bg-gray-800 text-gray-200"
                    placeholder="Ask something about this video..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      (e.preventDefault(), askGemini())
                    }
                  />

                  <button
                    onClick={askGemini}
                    className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 rounded-md disabled:opacity-50 disabled:bg-gray-700 transition flex-shrink-0"
                    disabled={loading || !userInput.trim()}
                  >
                    Ask
                  </button>
                </div>
              </>
            )}

            {transcriptStatus === "idle" && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400 text-sm">
                  Initializing transcript fetch...
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-800 p-2 text-center border-t border-gray-700">
        <p className="text-xs text-gray-500">Guardian AI v1.0.0</p>
      </div>
    </div>
  );
}

export default App;
