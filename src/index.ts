#!/usr/bin/env node

/**
 * MCP server that reads rules from GitHub repository and provides them as resources.
 * It fetches all .md files from the rules/ directory in the GitHub repo and exposes them as MCP resources
 * for automatic injection into context. Includes polling for automatic updates.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Type alias for a rule object.
 */
type Rule = {
  filename: string;
  title: string;
  content: string;
  sha: string;
};

/**
 * GitHub repository configuration
 */
const GITHUB_OWNER = "ln613";
const GITHUB_REPO = "roo-rules-server";
const GITHUB_BRANCH = "master";
const RULES_PATH = "rules";

/**
 * Polling interval in milliseconds (60 seconds)
 */
const POLL_INTERVAL = 60000;

/**
 * Cached rules data
 */
let cachedRules: { [filename: string]: Rule } = {};
let lastEtag: string | null = null;

/**
 * Extract title from markdown content
 */
function extractTitle(content: string, filename: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return filename.replace('.md', '');
}

/**
 * Fetch rules from GitHub repository
 */
async function fetchRulesFromGitHub(): Promise<{ [filename: string]: Rule }> {
  const rules: { [filename: string]: Rule } = {};
  
  try {
    // Fetch directory listing from GitHub API
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${RULES_PATH}?ref=${GITHUB_BRANCH}`;
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'roo-rules-server'
    };
    
    if (lastEtag) {
      headers['If-None-Match'] = lastEtag;
    }
    
    const response = await fetch(apiUrl, { headers });
    
    if (response.status === 304) {
      // Not modified, return cached rules
      console.error('GitHub rules not modified, using cache');
      return cachedRules;
    }
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    // Store etag for future requests
    const newEtag = response.headers.get('etag');
    if (newEtag) {
      lastEtag = newEtag;
    }
    
    const files = await response.json() as Array<{
      name: string;
      sha: string;
      download_url: string;
      type: string;
    }>;
    
    // Filter for .md files
    const mdFiles = files.filter(file => 
      file.type === 'file' && file.name.endsWith('.md')
    );
    
    // Fetch content for each file
    for (const file of mdFiles) {
      try {
        const contentResponse = await fetch(file.download_url, {
          headers: { 'User-Agent': 'roo-rules-server' }
        });
        
        if (!contentResponse.ok) {
          console.error(`Error fetching ${file.name}: ${contentResponse.status}`);
          continue;
        }
        
        const content = await contentResponse.text();
        const title = extractTitle(content, file.name);
        
        rules[file.name] = {
          filename: file.name,
          title,
          content,
          sha: file.sha
        };
      } catch (error) {
        console.error(`Error fetching content for ${file.name}:`, error);
      }
    }
    
    console.error(`Loaded ${Object.keys(rules).length} rules from GitHub`);
    
  } catch (error) {
    console.error('Error fetching rules from GitHub:', error);
    // Return cached rules if fetch fails
    if (Object.keys(cachedRules).length > 0) {
      console.error('Returning cached rules due to fetch error');
      return cachedRules;
    }
  }
  
  return rules;
}

/**
 * Function to get rules with caching
 */
async function getRules(): Promise<{ [filename: string]: Rule }> {
  cachedRules = await fetchRulesFromGitHub();
  return cachedRules;
}

/**
 * Set up polling for GitHub changes
 */
function setupGitHubPolling() {
  console.error(`Setting up GitHub polling every ${POLL_INTERVAL / 1000} seconds`);
  
  const pollInterval = setInterval(async () => {
    try {
      console.error('Polling GitHub for rule changes...');
      const newRules = await fetchRulesFromGitHub();
      
      // Check if rules have changed
      const oldKeys = Object.keys(cachedRules).sort();
      const newKeys = Object.keys(newRules).sort();
      
      if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) {
        console.error('Rules list changed - cache updated');
      } else {
        // Check for content changes
        for (const key of oldKeys) {
          if (cachedRules[key]?.sha !== newRules[key]?.sha) {
            console.error(`Rule ${key} content changed - cache updated`);
            break;
          }
        }
      }
      
      cachedRules = newRules;
    } catch (error) {
      console.error('Error during GitHub polling:', error);
    }
  }, POLL_INTERVAL);
  
  // Handle process termination
  process.on('SIGINT', () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
}

/**
 * Create an MCP server with capabilities for resources to list/read rules.
 */
const server = new Server(
  {
    name: "roo-rules-server",
    version: "0.2.0",
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
  const rules = await getRules();
  
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
  
  const rules = await getRules();
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
  // Initialize rules cache from GitHub
  console.error('Loading initial rules from GitHub...');
  await getRules();
  
  // Set up GitHub polling for changes
  setupGitHubPolling();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Roo Rules MCP server running on stdio with GitHub polling enabled');
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
