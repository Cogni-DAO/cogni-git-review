import nock from 'nock';
import { beforeEach, afterEach, before, after } from 'node:test';

before(() => {
  nock.disableNetConnect();
  // Allow localhost if needed for local servers
  nock.enableNetConnect('127.0.0.1');
  
  // Log unmatched requests to see what's bypassing nock
  nock.emitter.on('no match', (req) => {
    const host = req.options?.host || req.options?.hostname;
    console.error('[nock:NO MATCH]', req.method, host, req.options?.path);
  });
});

afterEach(() => {
  const pending = nock.pendingMocks();
  if (pending.length) {
    console.log(`⚠️ UNCONSUMED MOCKS (not throwing for debug):\n${pending.join('\n')}`);
  }
  nock.abortPendingRequests();
  nock.cleanAll();
});

after(() => {
  nock.restore();
});