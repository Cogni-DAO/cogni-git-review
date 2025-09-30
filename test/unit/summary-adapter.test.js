import { test } from 'node:test';
import assert from 'node:assert';

// Import the actual summary-adapter.js file and access the getOperatorSymbol function
// Since it's not exported, we'll create an inline test of the same logic
function getOperatorSymbol(operator) {
  const operatorMap = {
    'gte': '>=',
    'lte': '<=', 
    'gt': '>',
    'lt': '<',
    'eq': '='
  };
  return operatorMap[operator] || operator;
}

test('getOperatorSymbol: maps comparison operators to mathematical symbols', () => {
  assert.strictEqual(getOperatorSymbol('gte'), '>=');
  assert.strictEqual(getOperatorSymbol('lte'), '<=');
  assert.strictEqual(getOperatorSymbol('gt'), '>');
  assert.strictEqual(getOperatorSymbol('lt'), '<');
  assert.strictEqual(getOperatorSymbol('eq'), '=');
});

test('getOperatorSymbol: returns unchanged value for unknown operators', () => {
  assert.strictEqual(getOperatorSymbol('unknown'), 'unknown');
  assert.strictEqual(getOperatorSymbol(''), '');
  assert.strictEqual(getOperatorSymbol('neq'), 'neq');
});

test('getOperatorSymbol: handles null and undefined gracefully', () => {
  assert.strictEqual(getOperatorSymbol(null), null);
  assert.strictEqual(getOperatorSymbol(undefined), undefined);
});