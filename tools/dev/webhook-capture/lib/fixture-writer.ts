import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { mkdirp } from 'mkdirp';

export type FixtureRecord = {
  id: string;
  received_at: string;
  method: string;
  url: string;
  provider: string;
  headers: Record<string, string | string[]>;
  body_raw_base64: string;
};

export async function writeFixture(rec: FixtureRecord, dir = process.env.FIXTURE_CAPTURE_DIR || './fixtures') {
  const provider = rec.provider || 'unknown';
  const event = detectEvent(rec.headers) || 'unknown_event';
  const ts = rec.received_at.replace(/[:.]/g, '-');
  const file = `${ts}_${provider}_${event}_${rec.id}.json`;
  const dstDir = path.join(dir, provider, event);
  await mkdirp(dstDir);
  await fs.writeFile(path.join(dstDir, file), JSON.stringify(rec, null, 2), 'utf8');
  return { file: path.join(dstDir, file) };
}

function detectEvent(headers: Record<string, any>): string | null {
  const h = normalize(headers);
  // GitHub events
  if (h['x-github-event']) return h['x-github-event'];
  // Alchemy events - look for signature to indicate CogniSignal
  if (h['x-alchemy-signature']) return 'CogniSignal';
  // Other webhook types
  return h['x-alchemy-event-type'] || h['svix-id'] || null;
}

function normalize(h: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(h || {})) {
    const v = Array.isArray(h[k]) ? h[k].join(',') : String(h[k]);
    out[k.toLowerCase()] = v;
  }
  return out;
}