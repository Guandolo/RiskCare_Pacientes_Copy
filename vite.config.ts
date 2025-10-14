import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Force all tooltip imports (including subpaths and prebundled ids) to our stub
      { find: /^@radix-ui\/react-tooltip(?:\/.*)?$/, replacement: path.resolve(__dirname, "./src/shims/tooltip-shim.tsx") },
      { find: "@radix-ui/react-tooltip", replacement: path.resolve(__dirname, "./src/shims/tooltip-shim.tsx") },
      { find: "@radix-ui_react-tooltip", replacement: path.resolve(__dirname, "./src/shims/tooltip-shim.tsx") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["@radix-ui/react-tooltip", "@radix-ui_react-tooltip"],
  },
}));
