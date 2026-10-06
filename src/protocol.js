import { SERVER_NAME, SERVER_VERSION } from './lib/constants.js';
import { TOOLS, callTool } from './tools/index.js';

function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }

async function handleJsonRpc(message) {
  const { id, method, params } = message;
  try {
    if (method === "initialize") {
      return rpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });
    }
    if (method === "notifications/initialized") return null;
    if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
    if (method === "tools/call") return rpcResult(id, await callTool(params));
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return rpcError(id, -32000, e.message);
  }
}

export { handleJsonRpc, rpcResult, rpcError };
