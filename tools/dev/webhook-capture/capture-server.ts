import http from 'http';
import { writeFixture } from './lib/fixture-writer';

const port = Number(process.env.CAPTURE_PORT || 4001);

http.createServer(async (req, res) => {
  try {
    if ((req.method || '') !== 'POST' || (req.url || '') !== '/capture') {
      console.log(`[capture] 404 ${req.method} ${req.url}`);
      res.statusCode = 404;
      return res.end();
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);

    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, v ?? '']));
    const id = (headers['x-github-delivery'] as string) || (headers['svix-id'] as string) || Date.now().toString();
    
    let provider = 'unknown';
    if (headers['x-github-event']) {
      provider = 'github';
    } else if (headers['x-alchemy-signature'] || headers['x-alchemy-event-type']) {
      provider = 'alchemy';
    }

    console.log(`[capture] Received ${provider} webhook (${raw.length} bytes)`);

    const result = await writeFixture({
      id,
      received_at: new Date().toISOString(),
      method: req.method || 'POST',
      url: req.url || '/capture',
      provider,
      headers,
      body_raw_base64: raw.toString('base64')
    });

    console.log(`[capture] Saved fixture: ${result.file}`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
  } catch (e) {
    console.error(`[capture] Error:`, e);
    res.statusCode = 500;
    res.end('{"ok":false}');
  }
}).listen(port, () => console.log('[capture] listening', port));