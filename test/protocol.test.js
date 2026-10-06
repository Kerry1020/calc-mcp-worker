// MCP JSON-RPC and HTTP transport tests (exercise the Worker fetch handler directly).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker, { MAX_BODY_BYTES } from '../src/index.js';
import { handleJsonRpc } from '../src/protocol.js';
import { TOOLS } from '../src/tools/index.js';

const URL_ = 'https://calc.example/mcp';
const post = (body, headers = {}) => worker.fetch(new Request(URL_, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });

test('tool names and order are unchanged (backward compatibility)', () => {
  assert.deepEqual(TOOLS.map(t => t.name), [
    'calc_batch', 'calc_single', 'calc_derivative', 'calc_integral', 'calc_double_integral', 'calc_solve',
    'calc_series', 'calc_limit', 'calc_taylor', 'calc_ode', 'calc_matrix', 'calc_simplify', 'calc_constants',
    'calc_convert', 'calc_stats', 'calc_base_convert', 'calc_prime', 'calc_plot_data', 'calc_least_squares',
    'calc_probability', 'calc_hypothesis_test', 'calc_confidence_interval', 'calc_anova', 'calc_correlation', 'health',
  ]);
  for (const t of TOOLS) {
    assert.equal(t.inputSchema.type, 'object', t.name);
    assert.equal(typeof t.description, 'string', t.name);
  }
});

test('initialize negotiates the protocol version', async () => {
  const old = await handleJsonRpc(rpc('initialize', { protocolVersion: '2024-11-05' }));
  assert.equal(old.result.protocolVersion, '2024-11-05');
  const unknown = await handleJsonRpc(rpc('initialize', { protocolVersion: '1999-01-01' }));
  assert.equal(unknown.result.protocolVersion, '2025-06-18');
  assert.equal(unknown.result.serverInfo.name, 'calc-mcp-worker');
  assert.ok(unknown.result.capabilities.tools);
});

test('ping returns an empty result', async () => {
  assert.deepEqual((await handleJsonRpc(rpc('ping'))).result, {});
});

test('notifications never get a response, even for unknown methods', async () => {
  assert.equal(await handleJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(await handleJsonRpc({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }), null);
  assert.equal(await handleJsonRpc({ jsonrpc: '2.0', method: 'whatever' }), null);
});

test('client responses are accepted silently', async () => {
  assert.equal(await handleJsonRpc({ jsonrpc: '2.0', id: 5, result: {} }), null);
});

test('error codes: method not found, invalid request, invalid params', async () => {
  assert.equal((await handleJsonRpc(rpc('nope'))).error.code, -32601);
  assert.equal((await handleJsonRpc({ id: 1, method: 'ping' })).error.code, -32600);
  assert.equal((await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 42 })).error.code, -32600);
  assert.equal((await handleJsonRpc({ jsonrpc: '2.0', id: { x: 1 }, method: 'ping' })).error.code, -32600);
  assert.equal((await handleJsonRpc('hello')).error.code, -32600);
  assert.equal((await handleJsonRpc(rpc('tools/call', {}))).error.code, -32602);
  assert.equal((await handleJsonRpc(rpc('tools/call', { name: 'calc_single', arguments: 'x' }))).error.code, -32602);
  const unknownTool = await handleJsonRpc(rpc('tools/call', { name: 'nope' }));
  assert.equal(unknownTool.error.code, -32602);
  assert.match(unknownTool.error.message, /Unknown tool/);
});

test('tool execution errors are isError results, not protocol errors', async () => {
  const r = await handleJsonRpc(rpc('tools/call', { name: 'calc_single', arguments: { expression: '1/0' } }));
  assert.equal(r.result.isError, true);
  assert.match(JSON.parse(r.result.content[0].text).error, /non-finite/);
});

test('missing arguments do not crash tools', async () => {
  const r = await handleJsonRpc(rpc('tools/call', { name: 'calc_constants' }));
  assert.equal(r.result.isError, undefined);
  const h = await handleJsonRpc(rpc('tools/call', { name: 'health' }));
  assert.equal(JSON.parse(h.result.content[0].text).tools, 25);
});

test('HTTP: tools/list over POST', async () => {
  const res = await post(rpc('tools/list'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(res.headers.get('Content-Type'), /application\/json/);
  const body = await res.json();
  assert.equal(body.id, 1);
  assert.equal(body.result.tools.length, 25);
});

test('HTTP: notification returns 202 with empty body', async () => {
  const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), '');
});

test('HTTP: malformed JSON returns a JSON-RPC parse error', async () => {
  const res = await post('{not json');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.jsonrpc, '2.0');
  assert.equal(body.id, null);
  assert.equal(body.error.code, -32700);
});

test('HTTP: invalid request returns 400 with -32600', async () => {
  const res = await post({ foo: 1 });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, -32600);
});

test('HTTP: JSON-RPC batches are supported and bounded', async () => {
  const res = await post([rpc('ping', undefined, 1), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc('nope', undefined, 2)]);
  const body = await res.json();
  assert.equal(body.length, 2);
  assert.deepEqual(body[0].result, {});
  assert.equal(body[1].error.code, -32601);
  const empty = await (await post([])).json();
  assert.equal(empty.error.code, -32600);
  const big = await (await post(Array.from({ length: 51 }, (_, i) => rpc('ping', undefined, i)))).json();
  assert.match(big.error.message, /Batch too large/);
});

test('HTTP: oversized bodies are rejected with 413', async () => {
  const res = await post(JSON.stringify(rpc('tools/call', { name: 'calc_single', arguments: { expression: '1'.repeat(MAX_BODY_BYTES) } })));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, -32600);
});

test('HTTP: CORS preflight', async () => {
  const res = await worker.fetch(new Request(URL_, {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, mcp-protocol-version' },
  }));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'content-type, mcp-protocol-version');
});

test('HTTP: GET returns server info; SSE GET gets 405; other methods 405', async () => {
  const info = await worker.fetch(new Request(URL_));
  assert.equal(info.status, 200);
  assert.equal((await info.json()).tools, 25);
  const sse = await worker.fetch(new Request(URL_, { headers: { Accept: 'text/event-stream' } }));
  assert.equal(sse.status, 405);
  const del = await worker.fetch(new Request(URL_, { method: 'DELETE' }));
  assert.equal(del.status, 405);
  const put = await worker.fetch(new Request(URL_, { method: 'PUT', body: '{}' }));
  assert.equal(put.status, 405);
});

test('HTTP: end-to-end tool call', async () => {
  const res = await post(rpc('tools/call', { name: 'calc_batch', arguments: { expressions: ['2+3*4', '5!/(3!*2!)', 'ln(e)'] } }));
  const body = await res.json();
  const data = JSON.parse(body.result.content[0].text);
  assert.deepEqual(data.batch.map(b => b.result), ['14', '10', '1']);
});
