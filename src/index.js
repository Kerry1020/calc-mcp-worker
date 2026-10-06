// calc-mcp-worker — math computation MCP server for Cloudflare Workers.
import { SERVER_NAME, SERVER_VERSION } from './lib/constants.js';
import { TOOLS } from './tools/index.js';
import { handleJsonRpc } from './protocol.js';

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    if (request.method === "GET") {
      return new Response(JSON.stringify({ name: SERVER_NAME, version: SERVER_VERSION, tools: TOOLS.length, mcp: "/mcp" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    try {
      const message = await request.json();
      const result = await handleJsonRpc(message);
      if (!result) return new Response("", { status: 202, headers: { "Access-Control-Allow-Origin": "*" } });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  }
};
