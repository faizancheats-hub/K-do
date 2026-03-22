import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const watch = process.argv.includes("--watch");

async function copyStatic() {
  const targets = [
    ["webview/src/styles.css", "webview/dist/styles.css"],
    ["media/icon.png", "media/icon.png"]
  ];

  for (const [source, destination] of targets) {
    if (!existsSync(source)) {
      continue;
    }
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { force: true });
  }
}

const shared = {
  bundle: true,
  sourcemap: true,
  platform: "node",
  target: "node20",
  logLevel: "info"
};

await build({
  ...shared,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  format: "cjs",
  external: ["vscode"]
});

await build({
  bundle: true,
  entryPoints: ["webview/src/app.ts"],
  outfile: "webview/dist/app.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  logLevel: "info"
});

await copyStatic();

if (watch) {
  console.log("Watch mode is not wired in this baseline build. Re-run npm run build after edits.");
}
