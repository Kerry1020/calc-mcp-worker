// calc-mcp-worker — math computation MCP server for Cloudflare Workers.
// HTTP transport: JSON-RPC over POST (MCP Streamable HTTP, JSON responses only).
import { SERVER_NAME, SERVER_VERSION } from './lib/constants.js';
import { TOOLS } from './tools/index.js';
import { ErrorCode, handlePayload, rpcError } from './protocol.js';

export const MAX_BODY_BYTES = 1024 * 1024;

const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID';

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
  };
}

function json(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request), ...extra },
  });
}

async function readBody(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { tooLarge: true };
  return { text };
}

export default {
  async fetch(request) {
    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (method === 'GET') {
      // Streamable HTTP: a GET asking for an SSE stream must get 405 when the server offers none.
      const accept = request.headers.get('Accept') || '';
      if (accept.includes('text/event-stream') && !accept.includes('application/json') && !accept.includes('text/html')) {
        return new Response(null, { status: 405, headers: { Allow: 'GET, POST, OPTIONS', ...corsHeaders(request) } });
      }
      return json(request, { name: SERVER_NAME, version: SERVER_VERSION, tools: TOOLS.length, mcp: '/mcp' });
    }
    if (method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, POST, OPTIONS', ...corsHeaders(request) } });
    }

    const body = await readBody(request);
    if (body.tooLarge) return json(request, rpcError(null, ErrorCode.INVALID_REQUEST, `Request body too large (max ${MAX_BODY_BYTES} bytes)`), 413);

    let payload;
    try {
      payload = JSON.parse(body.text);
    } catch {
      return json(request, rpcError(null, ErrorCode.PARSE_ERROR, 'Parse error'), 400);
    }

    try {
      const result = await handlePayload(payload);
      if (!result) return new Response('', { status: 202, headers: corsHeaders(request) });
      const invalid = !Array.isArray(result) && result.error && result.error.code === ErrorCode.INVALID_REQUEST;
      return json(request, result, invalid ? 400 : 200);
    } catch (e) {
      return json(request, rpcError(null, ErrorCode.INTERNAL_ERROR, `Internal error: ${e instanceof Error ? e.message : String(e)}`), 500);
    }
  },
};
