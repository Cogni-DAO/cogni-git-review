import { describe, test } from 'node:test';
import assert from 'node:assert';
import { testEventHandler } from '../helpers/handler-harness.js';
import payload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };

describe('Error On Neutral Flag Contract Tests', () => {

  test('fail_on_error: false (default) - neutral status creates neutral conclusion', async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'errorOnNeutralDefault', // Use proper fixture
      expectCheck: (params) => {
        // Verify that neutral status becomes neutral conclusion (default behavior)
        assert.strictEqual(params.conclusion, 'neutral');
        assert.strictEqual(params.name, 'Cogni Git PR Review (dev)');
      }
    });
  });

  test('fail_on_error: true - neutral status creates failure conclusion', async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'errorOnNeutralTrue', // Use proper fixture
      expectCheck: (params) => {
        // Verify that neutral status becomes failure conclusion when fail_on_error: true
        assert.strictEqual(params.conclusion, 'failure');
        assert.strictEqual(params.name, 'Cogni Git PR Review (dev)');
      }
    });
  });

  test('fail_on_error: true - pass status still creates success conclusion', async () => {
    // Verify that pass status is unaffected by the flag - use fixture with passing gates
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'minimalErrorOnNeutral', // Uses our new fixture with fail_on_error: true
      expectCheck: (params) => {
        // Verify that pass status creates success conclusion regardless of fail_on_error flag
        assert.strictEqual(params.conclusion, 'success');
        assert.strictEqual(params.name, 'Cogni Git PR Review (dev)');
      }
    });
  });
});