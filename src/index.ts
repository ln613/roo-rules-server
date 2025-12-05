#!/usr/bin/env node

/**
 * MCP server that reads rules from ~/.roo/rules directory and provides them as resources.
 * It reads all .md files from /Users/nanli/.roo/rules and exposes them as MCP resources
 * for automatic injection into context. Includes file system watching for automatic updates.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Type alias for a rule object.
 */
type Rule = {
  filename: string;
  title: string;
  content: string;
};

/**
 * Path to the rules directory
 */
const RULES_DIR = "/Users/nanli/.roo/rules";

/**
 * Cached rules data
 */
let cachedRules: { [filename: string]: Rule } = {};
let lastLoadTime = 0;

/**
 * Function to read all .md files from the rules directory
 */
function loadRules(): { [filename: string]: Rule } {
  const rules: { [filename: string]: Rule } = {};
  
  try {
    if (!fs.existsSync(RULES_DIR)) {
      console.error(`Rules directory does not exist: ${RULES_DIR}`);
      return rules;
    }

    const files = fs.readdirSync(RULES_DIR);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    for (const filename of mdFiles) {
      const filePath = path.join(RULES_DIR, filename);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract title from the first heading or use filename
        const lines = content.split('\n');
        let title = filename.replace('.md', '');
        
        // Look for the first # heading
        for (const line of lines) {
          const match = line.match(/^#\s+(.+)$/);
          if (match) {
            title = match[1].trim();
            break;
          }
        }

        rules[filename] = {
          filename,
          title,
          content
        };
      } catch (error) {
        console.error(`Error reading file ${filename}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error reading rules directory:`, error);
  }

  return rules;
}

/**
 * Function to get rules with caching and automatic refresh
 */
function getRules(): { [filename: string]: Rule } {
  // Always reload rules to ensure we have the latest content
  // This ensures changes to existing files are picked up immediately
  cachedRules = loadRules();
  lastLoadTime = Date.now();
  return cachedRules;
}

/**
 * Set up file system watcher for the rules directory
 */
function setupFileWatcher() {
  try {
    if (!fs.existsSync(RULES_DIR)) {
      console.error(`Rules directory does not exist for watching: ${RULES_DIR}`);
      return;
    }

    const watcher = fs.watch(RULES_DIR, { recursive: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.error(`Rules file ${eventType}: ${filename} - cache will be refreshed on next request`);
        // Cache will be refreshed on next request due to getRules() always reloading
      }
    });

    console.error(`File watcher set up for rules directory: ${RULES_DIR}`);
    
    // Handle process termination
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      watcher.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(`Error setting up file watcher:`, error);
  }
}

/**
 * Create an MCP server with capabilities for resources to list/read rules.
 */
const server = new Server(
  {
    name: "roo-rules-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
    },
  }
);

/**
 * Handler for listing available rules as resources.
 * Each rule is exposed as a resource with:
 * - A rule:// URI scheme
 * - Markdown MIME type
 * - Human readable name and description
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const rules = getRules();
  
  return {
    resources: Object.entries(rules).map(([filename, rule]) => ({
      uri: `rule:///${filename}`,
      mimeType: "text/markdown",
      name: rule.title,
      description: `Roo rule: ${rule.title} (${filename})`
    }))
  };
});

/**
 * Handler for reading the contents of a specific rule.
 * Takes a rule:// URI and returns the rule content as markdown.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const filename = url.pathname.replace(/^\//, '');
  
  const rules = getRules();
  const rule = rules[filename];

  if (!rule) {
    throw new Error(`Rule ${filename} not found`);
  }

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "text/markdown",
      text: rule.content
    }]
  };
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  // Set up file system watcher
  setupFileWatcher();
  
  // Initialize rules cache
  getRules();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Roo Rules MCP server running on stdio with file watching enabled');
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
