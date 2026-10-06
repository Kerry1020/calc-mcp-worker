// MCP JSON-RPC 2.0 message handling (transport independent).
import { SERVER_NAME, SERVER_VERSION } from './lib/constants.js';
import { toolError } from './lib/format.js';
import { TOOLS, callTool, UnknownToolError } from './tools/index.js';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
export const MAX_BATCH_MESSAGES = 50;

export const ErrorCode = Object.freeze({
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
});

export function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
export function rpcError(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validId = (id) => id === null || typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));

class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function dispatch(method, params) {
  switch (method) {
    case 'initialize': {
      const requested = isObject(params) ? params.protocolVersion : undefined;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
      return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call': {
      if (!isObject(params) || typeof params.name !== 'string') throw new RpcError(ErrorCode.INVALID_PARAMS, 'tools/call requires params.name');
      if (params.arguments !== undefined && params.arguments !== null && !isObject(params.arguments)) {
        throw new RpcError(ErrorCode.INVALID_PARAMS, 'tools/call params.arguments must be an object');
      }
      try {
        return await callTool(params);
      } catch (e) {
        if (e instanceof UnknownToolError) throw new RpcError(ErrorCode.INVALID_PARAMS, e.message);
        // Tool execution failures are reported in the result so the model can see and react to them.
        return toolError(e instanceof Error ? e.message : String(e));
      }
    }
    default:
      throw new RpcError(ErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/**
 * Handle one JSON-RPC message. Returns a response object, or null when no
 * response must be sent (notifications and client responses).
 */
export async function handleJsonRpc(message) {
  if (!isObject(message)) return rpcError(null, ErrorCode.INVALID_REQUEST, 'Invalid Request: expected a JSON-RPC object');
  const { id, method, params } = message;
  const isNotification = !('id' in message);

  // A response from the client (e.g. to a server request): nothing to send back.
  if (method === undefined && ('result' in message || 'error' in message)) return null;

  if (message.jsonrpc !== '2.0' || typeof method !== 'string' || (!isNotification && !validId(id))) {
    // Structurally invalid messages get an error (id null when unknown), even without an id.
    return rpcError(!isNotification && validId(id) ? id : null, ErrorCode.INVALID_REQUEST, 'Invalid Request');
  }
  if (params !== undefined && params !== null && typeof params !== 'object') {
    return isNotification ? null : rpcError(id, ErrorCode.INVALID_PARAMS, 'params must be an object or array');
  }
  // Notifications (notifications/initialized, notifications/cancelled, ...) never get a response.
  if (isNotification) return null;

  try {
    return rpcResult(id, await dispatch(method, params));
  } catch (e) {
    if (e instanceof RpcError) return rpcError(id, e.code, e.message);
    return rpcError(id, ErrorCode.INTERNAL_ERROR, `Internal error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Handle a parsed request body: a single message or a JSON-RPC batch. */
export async function handlePayload(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return rpcError(null, ErrorCode.INVALID_REQUEST, 'Invalid Request: empty batch');
    if (payload.length > MAX_BATCH_MESSAGES) return rpcError(null, ErrorCode.INVALID_REQUEST, `Batch too large (max ${MAX_BATCH_MESSAGES} messages)`);
    const responses = [];
    for (const m of payload) {
      const r = await handleJsonRpc(m);
      if (r) responses.push(r);
    }
    return responses.length ? responses : null;
  }
  return handleJsonRpc(payload);
}
