import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Guardian AI",
    description:
      "Guardian AI blurs explicit content, enables Zen Mode for YouTube, and lets you chat with videos using AI.",
    version: "1.0.0",
    permissions: ["storage", "tabs", "activeTab"],
    host_permissions: [
      "https://*.google.com/*",
      "https://*.youtube.com/*",
      "<all_urls>",
    ],
  },
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      manifest.content_scripts ??= [];
      manifest.content_scripts.push({
        css: ["assets/reset.css"],
        matches: ["*://*.youtube.com/*"],
      });
    },
  },
});
