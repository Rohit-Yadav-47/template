/**
 * Visual Editor Vite Plugin
 *
 * This plugin adds unique data-visual-id, data-source-file, and data-source-line
 * attributes to all JSX elements during build. These attributes enable the visual
 * editor to map DOM elements back to their source code locations.
 *
 * How it works:
 * 1. Intercepts .tsx and .jsx files during Vite's transform phase
 * 2. Parses the file using Babel parser with JSX and TypeScript support
 * 3. Traverses the AST to find all JSXOpeningElement nodes
 * 4. Adds three data attributes:
 *    - data-visual-id: A unique hash based on file path + line + column
 *    - data-source-file: The file path relative to /app/src/
 *    - data-source-line: The line number in the source file
 * 5. Regenerates the code with source maps preserved
 *
 * Author: Heyamara Engineering
 */

import type { Plugin, TransformResult } from 'vite';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import crypto from 'crypto';

// Handle both ESM and CommonJS default exports
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as { default: typeof _traverse }).default) as typeof _traverse;
const generate = (typeof _generate === 'function' ? _generate : (_generate as { default: typeof _generate }).default) as typeof _generate;

/**
 * Configuration options for the visual editor plugin
 */
interface VisualEditorPluginOptions {
  /**
   * Whether to enable the plugin. Defaults to true in development mode.
   */
  enabled?: boolean;

  /**
   * List of element tag names to exclude from transformation.
   * By default, excludes Fragment and common utility components.
   */
  excludeTags?: string[];

  /**
   * Base path for source file paths. Defaults to '/app/src/'.
   */
  sourcePathPrefix?: string;

  /**
   * Whether to add source line numbers. Defaults to true.
   */
  includeLineNumbers?: boolean;

  /**
   * Enable verbose logging for debugging.
   */
  verbose?: boolean;
}

const DEFAULT_OPTIONS: Required<VisualEditorPluginOptions> = {
  enabled: true,
  excludeTags: [
    'Fragment',
    'React.Fragment',
    '<>',
    'Suspense',
    'React.Suspense',
    'StrictMode',
    'React.StrictMode',
    'Profiler',
    'React.Profiler',
  ],
  sourcePathPrefix: '/app/src/',
  includeLineNumbers: true,
  verbose: false,
};

/**
 * Creates a Vite plugin that adds visual editor attributes to JSX elements.
 *
 * @param options - Configuration options for the plugin
 * @returns A Vite plugin instance
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { visualEditorPlugin } from './plugins/visual-editor-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     react(),
 *     visualEditorPlugin({ verbose: true }),
 *   ],
 * });
 * ```
 */
export function visualEditorPlugin(options: VisualEditorPluginOptions = {}): Plugin {
  const config: Required<VisualEditorPluginOptions> = { ...DEFAULT_OPTIONS, ...options };

  return {
    name: 'visual-editor-source-map',

    // Only apply in development or when explicitly enabled
    apply(_, env) {
      if (config.enabled === false) return false;
      return env.mode === 'development' || config.enabled === true;
    },

    transform(code: string, id: string): TransformResult | null {
      // Only process .tsx, .jsx files in src directory
      if (!id.includes('/src/') || (!id.endsWith('.tsx') && !id.endsWith('.jsx'))) {
        return null;
      }

      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Skip files that are likely not React components
      if (id.includes('.test.') || id.includes('.spec.') || id.includes('.d.ts')) {
        return null;
      }

      try {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
          // Preserve source locations for accurate mapping
          ranges: true,
        });

        let elementCounter = 0;
        let hasModifications = false;

        // Extract relative file path
        const srcIndex = id.indexOf('/src/');
        const relativeFilePath = srcIndex !== -1 ? id.slice(srcIndex + 5) : id.split('/').pop() || id;

        if (config.verbose) {
          console.log(`[visual-editor-plugin] Processing: ${relativeFilePath}`);
        }

        traverse(ast, {
          JSXOpeningElement(path) {
            // Get element name
            let elementName = '';
            if (t.isJSXIdentifier(path.node.name)) {
              elementName = path.node.name.name;
            } else if (t.isJSXMemberExpression(path.node.name)) {
              // Handle cases like React.Fragment
              const obj = path.node.name.object;
              const prop = path.node.name.property;
              if (t.isJSXIdentifier(obj) && t.isJSXIdentifier(prop)) {
                elementName = `${obj.name}.${prop.name}`;
              }
            }

            // Skip excluded elements (fragments, etc.)
            if (config.excludeTags.includes(elementName)) {
              return;
            }

            // Skip if the element is a custom hook or utility
            if (elementName.startsWith('use') || elementName.startsWith('_')) {
              return;
            }

            // Check if attributes already exist
            const hasVisualId = path.node.attributes.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === 'data-visual-id'
            );

            if (hasVisualId) {
              return;
            }

            // Get source location
            const loc = path.node.loc;
            if (!loc) {
              return;
            }

            // Generate unique ID based on file + line + column
            // This ensures stability across rebuilds as long as source doesn't move
            const locationKey = `${relativeFilePath}:${loc.start.line}:${loc.start.column}`;
            const uniqueId = `ve-${crypto.createHash('md5').update(locationKey).digest('hex').slice(0, 8)}`;

            // Create data-visual-id attribute
            const visualIdAttr = t.jsxAttribute(
              t.jsxIdentifier('data-visual-id'),
              t.stringLiteral(uniqueId)
            );

            // Create data-source-file attribute
            const sourceFileAttr = t.jsxAttribute(
              t.jsxIdentifier('data-source-file'),
              t.stringLiteral(`${config.sourcePathPrefix}${relativeFilePath}`)
            );

            // Add attributes
            path.node.attributes.push(visualIdAttr);
            path.node.attributes.push(sourceFileAttr);

            // Optionally add line number
            if (config.includeLineNumbers) {
              const sourceLineAttr = t.jsxAttribute(
                t.jsxIdentifier('data-source-line'),
                t.stringLiteral(String(loc.start.line))
              );
              path.node.attributes.push(sourceLineAttr);
            }

            hasModifications = true;
            elementCounter++;
          },
        });

        // Only regenerate if we made changes
        if (!hasModifications) {
          return null;
        }

        if (config.verbose) {
          console.log(`[visual-editor-plugin] Added ${elementCounter} visual IDs to ${relativeFilePath}`);
        }

        // Generate output with source maps
        const output = generate(
          ast,
          {
            sourceMaps: true,
            sourceFileName: id,
            // Preserve formatting as much as possible
            retainLines: true,
            compact: false,
          },
          code
        );

        return {
          code: output.code,
          map: output.map,
        };
      } catch (error) {
        // Log warning but don't fail the build
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[visual-editor-plugin] Failed to transform ${id}:`, errorMessage);

        // In verbose mode, log the full stack trace
        if (config.verbose && error instanceof Error) {
          console.warn(error.stack);
        }

        return null;
      }
    },
  };
}

// Default export for convenient importing
export default visualEditorPlugin;
