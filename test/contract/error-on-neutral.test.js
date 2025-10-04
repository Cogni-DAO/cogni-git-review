import { describe, test } from 'node:test';
import assert from 'node:assert';
import { testEventHandler } from '../helpers/handler-harness.js';
import payload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };

describe('Error On Neutral Flag Contract Tests', () => {

  // Helper function to reduce test duplication
  async function testFailOnErrorBehavior(spec, expectedConclusion, description) {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec,
      expectCheck: (params) => {
        assert.strictEqual(params.conclusion, expectedConclusion, description);
        assert.strictEqual(params.name, 'Cogni Git PR Review (dev)');
      }
    });
  }

  test('fail_on_error: false (default) - neutral status creates neutral conclusion', () =>
    testFailOnErrorBehavior('errorOnNeutralDefault', 'neutral', 'Default behavior should be non-blocking')
  );

  test('fail_on_error: true - neutral status creates failure conclusion', () =>
    testFailOnErrorBehavior('errorOnNeutralTrue', 'failure', 'fail_on_error: true should block with failure')
  );

  test('fail_on_error: true - pass status still creates success conclusion', () =>
    testFailOnErrorBehavior('minimalErrorOnNeutral', 'success', 'Pass status should be unaffected by flag')
  );
});