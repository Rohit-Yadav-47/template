/**
 * Vite Configuration for Heyamara Website Builder Sandbox
 *
 * This configuration is used by the Modal sandbox to build and serve
 * websites created through the Amara visual editor.
 *
 * Features:
 * - React with Fast Refresh
 * - Visual Editor Plugin for element source mapping
 * - Path aliases (@/ -> src/)
 * - CORS-enabled dev server for iframe embedding
 *
 * Author: Heyamara Engineering
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualEditorPlugin } from './plugins/visual-editor-plugin';

export default defineConfig({
  plugins: [
    // React plugin with Fast Refresh for HMR
    react(),

    // Visual Editor plugin adds data-visual-id, data-source-file,
    // and data-source-line attributes to all JSX elements
    // This enables click-to-source navigation in the visual editor
    visualEditorPlugin({
      enabled: true,
      includeLineNumbers: true,
      verbose: false,
      sourcePathPrefix: '/app/src/',
    }),
  ],

  resolve: {
    alias: {
      // Enable @/ imports to resolve to src/
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Bind to all interfaces for Modal tunnel access
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,

    // Allow all hosts for Modal's encrypted tunnels
    // @ts-expect-error - Vite 6 changed the type to boolean | true
    allowedHosts: true,

    // Enable CORS for cross-origin iframe embedding
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
    },

    // HMR configuration for iframe embedding
    hmr: {
      // Use the tunnel URL for HMR in production
      // In development, use the default
      clientPort: 443,
      protocol: 'wss',
    },

    // Watch configuration for file changes
    watch: {
      // Use polling in container environments
      usePolling: true,
      interval: 1000,
    },
  },

  // Build configuration
  build: {
    // Output directory
    outDir: 'dist',

    // Generate source maps for debugging
    sourcemap: true,

    // Rollup options
    rollupOptions: {
      output: {
        // Chunk naming for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react', 'framer-motion'],
        },
      },
    },

    // Target modern browsers for smaller bundle size
    target: 'esnext',

    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'framer-motion',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
  },

  // Environment variables
  define: {
    // Expose build-time environment
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
