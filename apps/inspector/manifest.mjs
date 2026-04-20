// @ts-check
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatBuildMode,
  formatBuildModeTitle,
} from "./src/components/environment/build-mode.js";

const pkg = await readFile(new URL("./package.json", import.meta.url))
  .then(String)
  .then(JSON.parse);

const base = {
  manifest_version: 3,
  name: pkg.description,
  description: pkg.description,
  version: pkg.version.split("-")[0],
  homepage_url: "https://originator-profile.org/",
  icons: {
    48: "icons/48x48.png",
    128: "icons/128x128.png",
  },
  default_locale: "en",
  action: {},
  content_scripts: [
    {
      match_about_blank: true,
      matches: ["<all_urls>"],
      js: ["content-script.js"],
      run_at: "document_start",
    },
    {
      match_about_blank: true,
      matches: ["<all_urls>"],
      all_frames: true,
      js: ["content-script-all-frames.js"],
      run_at: "document_start",
    },
  ],
  web_accessible_resources: [
    {
      matches: ["<all_urls>"],
      resources: [
        "content-script/iframe.js",
        "main.css",
        "index.html",
        "*.map",
      ],
    },
  ],
  host_permissions: ["<all_urls>"],
  permissions: [
    "activeTab",
    "scripting",
    "webNavigation",
    "webRequest",
    "webRequestAuthProvider",
    "storage",
  ],
};

const chromium = {
  ...base,
  permissions: [...base.permissions, "sidePanel"],
  version_name: pkg.version,
  background: {
    service_worker: "background.js",
  },
  side_panel: { default_path: "index.html" },
};

const firefox = {
  ...base,
  browser_specific_settings: {
    gecko: {
      id: "bot@originator-profile.org",
      strict_min_version: "109.0",
    },
    gecko_android: {
      id: "bot@originator-profile.org",
      strict_min_version: "120.0",
    },
  },
  background: {
    page: "background.html",
  },
  sidebar_action: {
    default_panel: "index.html",
    default_title: pkg.description,
    default_icon: { 48: "icons/48x48.png", 128: "icons/128x128.png" },
    open_at_install: false,
  },
};

/**
 *
 * @param {object} arg
 * @param {string} arg.target 拡張機能のランタイム
 * @param {string} [arg.mode] ビルドモード
 */
export default function esbuildPluginManifest({ target, mode = "production" }) {
  const targetManifest = {
    chromium,
    "firefox-desktop": firefox,
    "firefox-android": firefox,
  }[target];

  if (!targetManifest) {
    throw new Error(`Unsupported target: ${target}`);
  }

  const manifest = {
    ...targetManifest,
    name: formatBuildModeTitle(mode, targetManifest.name),
    description: formatBuildMode(mode, targetManifest.description),
  };

  return {
    name: "plugin:manifest",
    /** @param build {import("esbuild").PluginBuild} */
    setup(build) {
      const dist = build.initialOptions.outdir ?? ".";
      build.onEnd(async () => {
        await writeFile(
          path.join(dist, "manifest.json"),
          JSON.stringify(manifest, null, 2),
        );
      });
    },
  };
}
