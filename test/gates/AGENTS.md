# Gate Logic Tests

## Scope
Tests for critical gate processing logic that sits between unit tests (isolated components) and contract tests (full webhook flows). Focuses on core gate algorithms and result aggregation.

## Why This Directory Exists
Gate logic tests validate complex algorithms that are too integrated for unit tests but too specific for contract tests:
- **Unit tests**: Test individual functions in isolation
- **Gate logic tests**: Test core gate algorithms with mocked dependencies  
- **Contract tests**: Test complete webhook → check flows

## Current Test Files

### `ai-rules-aggregator.test.js`
**Purpose**: P0 validation of tri-state aggregation logic (FAIL > NEUTRAL > PASS)

**Why it's here**: This test isolates the critical aggregation algorithm that determines final gate results from multiple AI rule evaluations. Too complex for unit testing (needs rule result simulation), but the algorithm itself is the key focus rather than webhook integration.

**What it tests**:
- Multiple rules with mixed verdicts aggregate correctly
- FAIL status takes precedence over NEUTRAL and PASS
- NEUTRAL takes precedence over PASS  
- Single rule results pass through unchanged
- Blocking vs non-blocking rule behavior

## Future Scope
This directory will expand as gate-specific algorithms grow:
- Gate Groups
- Complex scoring algorithms
- Multi-rule coordination logic
- Gate timeout and retry logic
- Evidence gathering algorithms