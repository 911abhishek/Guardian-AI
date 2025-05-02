
import { GoogleGenAI } from "@google/genai";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id }); // Existing fetch image logic

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchImage" && message.url) {
      fetch(message.url, { mode: "cors" })
        .then(async (response) => {
          if (!response.ok)
            throw new Error("failed to fetch image from bg cors error");
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          sendResponse({
            data: arrayBuffer,
            type: blob.type,
          });
        })
        .catch((error) => {
          sendResponse({ error: error.message }); // ✅ Return error to content if fetch fails
        });

      return true; 
    } 
  }); 
  //gemini logic start
  
  const TRANSCRIPT_API_URL =
    "https://www.youtube-transcript.io/api/transcripts";
  const TRANSCRIPT_API_TOKEN = "6814e79a4ee82b0495320d2a"; // Replace with your actual token
  const GEMINI_API_KEY = "AIzaSyDpCKAu3-8bmejHEc_Wk4UFf67y8JdefUo"; // Replace with your Gemini API key

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // === Memory caches ===
  const transcriptCache: { [videoId: string]: string } = {};
  const chatHistories: {
    [videoId: string]: Array<{ role: "user" | "model"; text: string }>;
  } = {};

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_TRANSCRIPT") {
      const { videoId } = message;

      // Serve from cache if available
      if (transcriptCache[videoId]) {
        sendResponse({
          status: "success",
          transcript: transcriptCache[videoId],
        });
        return true;
      }

      // Fetch transcript from API
      fetch(TRANSCRIPT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${TRANSCRIPT_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: [videoId] }),
      })
        .then((res) => res.json())
        .then((data) => {
          const transcriptData = data?.[0]?.tracks?.[0]?.transcript || [];

          const fullTranscript = transcriptData
            .map((entry: any) => {
              const startSec = parseFloat(entry.start);
              const timestamp = formatTimestamp(startSec);
              return `[${timestamp}] ${entry.text}`;
            })
            .join(" ");

          transcriptCache[videoId] = fullTranscript; // ✅ Cache it

          sendResponse({
            status: "success",
            transcript: fullTranscript,
          });
        })
        .catch((err) => {
          console.error("[ERROR] Transcript fetch failed:", err);
          sendResponse({ status: "error", error: err.message });
        });

      return true;
    }

    if (message.type === "ASK_GEMINI") {
      const { prompt, videoId } = message;

      const transcript = transcriptCache[videoId] || "";

      // Initialize chat history if first time
      if (!chatHistories[videoId]) {
        chatHistories[videoId] = [
          {
            role: "user",
            text: `This is the transcript of the video:\n${transcript}\n please response in plain text and when time slot asked give in [mm:ss] this format with topic`,
          },
        ];
      }

      // Append user's message
      chatHistories[videoId].push({ role: "user", text: prompt });

      // Truncate to last 20 messages (optional optimization)
      if (chatHistories[videoId].length > 40) {
        chatHistories[videoId] = chatHistories[videoId].slice(-20);
      }

      // Convert to Gemini format
      const messages = chatHistories[videoId].map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

      ai.models
        .generateContent({
          model: "gemini-2.0-flash-001",
          contents: messages,
        })
        .then((data) => {
          const text: string =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

          // Save Gemini's reply to history
          chatHistories[videoId].push({ role: "model", text });

          sendResponse({ text });
        })
        .catch((err: Error) => {
          console.error("[ERROR] Gemini request failed:", err);
          sendResponse({ text: "Error from Gemini API" });
        });

      return true;
    }

    // Converts seconds to MM:SS
    function formatTimestamp(seconds: number): string {
      const mins = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
      const secs = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");
      return `${mins}:${secs}`;
    }
  });
  
  // gemini logic end
});
