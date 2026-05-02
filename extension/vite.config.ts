import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

function mergeKhanApiHostPermission(manifest: Record<string, unknown>, apiOrigin: string | undefined): void {
  const trimmed = apiOrigin?.trim();
  if (!trimmed) return;

  let permissionUrl: string;
  try {
    const u = new URL(trimmed);
    permissionUrl = `${u.protocol}//${u.host}/*`;
  } catch {
    console.warn("[vite] VITE_KHAN_API_ORIGIN 不是合法 URL，已跳过写入 host_permissions:", apiOrigin);
    return;
  }

  const existing = manifest.host_permissions;
  const list = Array.isArray(existing) ? [...(existing as string[])] : [];
  if (!list.includes(permissionUrl)) {
    list.push(permissionUrl);
  }
  manifest.host_permissions = list;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const khanApiOrigin = env.VITE_KHAN_API_ORIGIN;

  return {
    plugins: [
      react(),
      {
        name: "write-extension-manifest",
        closeBundle() {
          const manifestPath = resolve(__dirname, "manifest.json");
          const distManifestPath = resolve(__dirname, "dist/manifest.json");
          const raw = readFileSync(manifestPath, "utf8");
          const manifest = JSON.parse(raw) as Record<string, unknown>;
          mergeKhanApiHostPermission(manifest, khanApiOrigin);
          writeFileSync(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        }
      }
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, "sidepanel.html"),
          content: resolve(__dirname, "src/content/index.ts"),
          background: resolve(__dirname, "src/background/index.ts")
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name].[hash].js",
          assetFileNames: "assets/[name].[hash][extname]"
        }
      }
    }
  };
});
