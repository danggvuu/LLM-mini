import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, getErrorMessage, readSSE, requestJson } from './api.js';

test('validation errors become readable messages', () => {
  assert.equal(getErrorMessage({ detail: [{ msg: 'Missing title' }, { msg: 'Invalid URL' }] }), 'Missing title; Invalid URL');
});

test('requestJson rejects unsuccessful responses instead of treating them as saved', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Model unavailable' }, { status: 503 }));
  await assert.rejects(requestJson('/api/test'), /Model unavailable/);
});

test('requestJson leaves multipart content type to the browser', async t => {
  const form = new FormData();
  form.set('title', 'Document');
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.has('Content-Type'), false);
    assert.equal(options.body, form);
    return Response.json({ status: 'success' });
  });
  assert.deepEqual(await requestJson('/api/test', { method: 'POST', body: form }), { status: 'success' });
});

test('SSE preserves split UTF-8, CRLF frames, comments and final unterminated frame', async () => {
  const bytes = new TextEncoder().encode(': heartbeat\r\n\r\ndata: {"type":"chunk","text":"Tiếng Việt"}\r\n\r\ndata: {"type":"saved","id":1}');
  const body = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const events = [];
  for await (const event of readSSE(new Response(body))) events.push(event);
  assert.deepEqual(events, [{ type: 'chunk', text: 'Tiếng Việt' }, { type: 'saved', id: 1 }]);
});

test('SSE surfaces HTTP errors before reading tokens', async () => {
  const response = Response.json({ detail: 'Notebook not found' }, { status: 404 });
  await assert.rejects(async () => { for await (const event of readSSE(response)) assert.fail(event); }, /Notebook not found/);
});

test('print content escapes document and model supplied HTML', () => {
  assert.equal(escapeHtml('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
});
