import Ajv from 'ajv';
import YAML from 'yaml';
import ruleSchema from './rule-spec.schema.json' with { type: 'json' };
import providerSchema from './provider-result.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: true });

// Pre-compile schemas for performance
const vRule = ajv.compile(ruleSchema);
const vProvider = ajv.compile(providerSchema);

export function parseYAML(yamlString) {
  return YAML.parse(yamlString);
}

export function assertRuleSchema(data) {
  if (!vRule(data)) {
    const err = new Error('Rule schema invalid');
    err.details = vRule.errors;
    throw err;
  }
}

export function assertProviderResult(data) {
  if (!vProvider(data)) {
    const err = new Error('ProviderResult schema invalid');
    err.details = vProvider.errors;
    throw err;
  }
}