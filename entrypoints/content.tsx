import ZenUI from "@/components/ZenUI";
import { createRoot } from "react-dom/client";
import "@/assets/main.css";
import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
tf.enableProdMode();

export default defineContentScript({
  matches: ["<all_urls>"],
  async main() {
    console.log("Hello content.");
    // youtube chat feature start

    chrome.runtime.onMessage.addListener((message) => {
      console.log("message reciebed");
      if (message.type === "SEEK_TO_TIMESTAMP") {
        const video = document.querySelector("video");
        if (video) {
          video.currentTime = message.seconds;
          video.play();
        }
      }
    });
    interface ModeMessage {
      mode: "normal" | "strict";
      isEnabled: boolean;
    }

    let model: nsfwjs.NSFWJS | null = null;
    let isEnabled: boolean = true;
    let currentMode: "normal" | "strict" = "normal";
    let observer: MutationObserver | null = null;
    let scanInterval: ReturnType<typeof setInterval> | null = null;
    const processedImages = new WeakSet<HTMLImageElement>();

    const loadModel = async () => {
      try {
        model = await nsfwjs.load();
      } catch (error) {
        console.log("Error at content.tsx " + error);
      }
    };

    const toBlur = (
      predictions: nsfwjs.PredictionType[],
      mode: "normal" | "strict"
    ): boolean => {
      const thresholds = {
        Porn: 0.75,
        Hentai: 0.75,
        Sexy: 0.1,
      };
      const blurClasses =
        mode === "normal" ? ["Porn", "Hentai"] : ["Porn", "Hentai", "Sexy"];

      return predictions.some(
        (pred) =>
          blurClasses.includes(pred.className) &&
          pred.probability >
            thresholds[pred.className as keyof typeof thresholds]
      );
    };

    const createImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
    };

    // Throttle helper
    const throttle = (fn: (...args: any[]) => void, delay: number) => {
      let lastCall = 0;
      return (...args: any[]) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          fn(...args);
        }
      };
    };

    // ---- Clean up observer/interval ----
    function stopScanning() {
      if (observer) observer.disconnect();
      observer = null;
      if (scanInterval) clearInterval(scanInterval);
      scanInterval = null;
    }

    const processImage = async (
      img: HTMLImageElement,
      mode: "normal" | "strict"
    ) => {
      if (
        !model ||
        !isEnabled ||
        img.dataset.processed === "true" ||
        processedImages.has(img)
      )
        return;

      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        try {
          let predictions: nsfwjs.PredictionType[];

          // CORS-friendly fetch in background page
          if (img.crossOrigin === "anonymous" && img.src) {
            const response = await chrome.runtime.sendMessage({
              action: "fetchImage",
              url: img.src,
            });
            if (response.error) {
              console.error("wahi bekar cors wala drama", response.error);
              return;
            }
            const imgBlob = await createImageFromBlob(
              new Blob([response.data], { type: response.type })
            );
            predictions = await model.classify(imgBlob);
            URL.revokeObjectURL(imgBlob.src);
          } else {
            predictions = await model.classify(img);
            console.log(predictions);
          }

          if (toBlur(predictions, mode)) {
            img.style.filter = "blur(30px)";
            img.classList.add("blurred");
          }

          img.dataset.processed = "true";
          processedImages.add(img); // Mark as processed
        } catch (error) {
          img.style.filter = "grayscale(100%) blur(20px)";
          console.log("cross origin image founded make it in grey scale");
          console.log("error at process image : " + error);
        }
      } else {
        // If the image is not loaded, wait for the load event
        const loadListener = () => {
          processImage(img, mode); // Reprocess once loaded
          img.removeEventListener("load", loadListener);
        };
        img.addEventListener("load", loadListener);
      }
    };

    // Scan all <img> tags at once
    const processImages = async (mode: "normal" | "strict") => {
      if (!isEnabled) {
        document.querySelectorAll("img.blurred").forEach((img) => {
          img.classList.remove("blurred");
          (img as HTMLImageElement).style.filter = "";
          delete (img as HTMLImageElement).dataset.processed;
          processedImages.delete(img as HTMLImageElement);
        });
        return;
      }
      const images = document.querySelectorAll("img");
      for (const img of images) {
        await processImage(img as HTMLImageElement, mode);
      }
    };

    // Scan new images (and retry missed ones) robustly
    const observeImages = (mode: "normal" | "strict") => {
      stopScanning(); // Only keep one observer & scanInterval

      currentMode = mode;

      const throttledProcess = throttle(
        (img: HTMLImageElement) => processImage(img, mode),
        100
      );

      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // Handle added nodes (new <img> tags)
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if ((node as Element).tagName === "IMG") {
                throttledProcess(node as HTMLImageElement);
              } else if ((node as Element).querySelectorAll) {
                (node as Element)
                  .querySelectorAll("img")
                  .forEach((img) => throttledProcess(img as HTMLImageElement));
              }
            });
          }
          // Handle <img> src changes!
          else if (
            mutation.type === "attributes" &&
            (mutation.target as Element).tagName === "IMG" &&
            mutation.attributeName === "src"
          ) {
            throttledProcess(mutation.target as HTMLImageElement);
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"], // Efficient: only src changes
      });

      // Periodic rescanning for robustness; catches missed/incrementally loaded images.
      scanInterval = setInterval(() => {
        document
          .querySelectorAll("img")
          .forEach((img) => throttledProcess(img as HTMLImageElement));
      }, 5000);
    };

    // Listen for changes and update scanning
    chrome.runtime.onMessage.addListener(
      (message: ModeMessage, sender, sendResponse) => {
        if (message.mode !== undefined && message.isEnabled !== undefined) {
          isEnabled = message.isEnabled;

          if (!isEnabled) {
            stopScanning();
            processImages(message.mode); // Remove blurring too
          } else {
            processImages(message.mode); // apply new mode to all
            observeImages(message.mode); // connect observer (replacing old one)
          }
        }
      }
    );

    // On load, set things up
    chrome.storage.sync.get(["mode", "isEnabled"], (data) => {
      const mode = (data.mode || "normal") as "normal" | "strict";
      isEnabled = data.isEnabled !== false;
      loadModel().then(() => {
        if (isEnabled) {
          processImages(mode);
          observeImages(mode);
        }
      });
    });

    // ========== Zen UI, YouTube etc. (as in your old code) ============
    function injectResetCSS() {
      const id = "zen-reset-style";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("reset.css");
        document.head.appendChild(link);
      }
    }

    async function injectZenUI() {
      document.documentElement.classList.add("zen-mode");
      if (document.getElementById("zen-ui-root")) return;
      const container = document.createElement("div");
      container.id = "zen-ui-root";
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<ZenUI />);
    }

    function removeZenUI() {
      document.documentElement.classList.remove("zen-mode");
      const existingRoot = document.getElementById("zen-ui-root");
      if (existingRoot) existingRoot.remove();
    }

    async function modifyResultPage() {
      const selectors = [
        "ytd-reel-shelf-renderer",
        "dismissible",
        ".ytd-search-pyv-renderer",
        "ytd-mini-guide-renderer",
      ];
      const hide = () =>
        selectors.forEach((sel) =>
          document
            .querySelectorAll(sel)
            .forEach((e) => ((e as HTMLElement).style.display = "none"))
        );
      hide();
      new MutationObserver(hide).observe(document.body, {
        childList: true,
        subtree: true,
      });
      await injectResetCSS();
    }

    // Zen Mode logic only for YouTube
    if (!window.location.href.includes("youtube.com")) return;
    const isResults =
      window.location.href.includes("/results") ||
      window.location.href.includes("/watch");
    if (isResults) {
      removeZenUI();

      modifyResultPage();

      return;
    }

    const { showZenUI } = await chrome.storage.local.get("showZenUI");
    const enabled = showZenUI ?? true;
    if (enabled) {
      injectZenUI();
    } else removeZenUI();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && "showZenUI" in changes) {
        changes.showZenUI.newValue ? injectZenUI() : removeZenUI();
      }
    });
    // End Zen Mode
  },
});
