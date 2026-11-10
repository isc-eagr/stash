import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import viteCompression from "vite-plugin-compression";

const sourcemap = process.env.VITE_APP_SOURCEMAPS === "true";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const plugins = [
    react({
      babel: {
        compact: true,
      },
    }),
    tsconfigPaths(),
    viteCompression({
      algorithm: "gzip",
      deleteOriginFile: true,
      threshold: 0,
      filter: /\.(js|json|css|svg|md)$/i,
    }),
  ];

  return {
    base: "",
    build: {
      outDir: "build",
      sourcemap: sourcemap,
      reportCompressedSize: false,
    },
    // CUSTOM: begin - silence third-party Sass deprecations until upstream deps migrate
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: [
            "legacy-js-api",
            "import",
            "global-builtin",
            "color-functions",
            "abs-percent",
          ],
        },
      },
    },
    // CUSTOM: end
    optimizeDeps: {
      entries: "src/index.tsx",
    },
    server: {
      port: 3000,
      cors: false,
    },
    publicDir: "public",
    assetsInclude: ["**/*.md"],
    plugins,
  };
});
