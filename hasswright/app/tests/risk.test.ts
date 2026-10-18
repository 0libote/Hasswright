import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classify, mayExecute } from '../src/policy/risk.js';
import { redactSecrets } from '../src/types.js';

describe('risk classification', () => {
  it('reads are low risk', () => {
    assert.equal(classify('ha.get_overview'), 'low');
    assert.equal(classify('ha.read_file'), 'low');
  });
  it('device control on locks is critical', () => {
    assert.equal(classify('ha.call_service', { domain: 'lock', service: 'lock' }), 'critical');
    assert.equal(classify('ha.call_service', { entity_id: 'alarm_control_panel.home' }), 'critical');
    assert.equal(classify('ha.call_service', { domain: 'light', service: 'turn_on' }), 'high');
  });
  it('observe mode blocks all mutations', () => {
    assert.equal(mayExecute('observe', 'approval', true).ok, false);
    assert.equal(mayExecute('observe', 'high', true).ok, false);
    assert.equal(mayExecute('observe', 'low', false).ok, true);
  });
  it('assist requires approval for non-low', () => {
    assert.equal(mayExecute('assist', 'approval', false).ok, false);
    assert.equal(mayExecute('assist', 'approval', true).ok, true);
  });
});

describe('secret redaction', () => {
  it('redacts token keys and bearer strings', () => {
    const out = redactSecrets({ api_key: 'abc123xyz', name: 'kitchen', msg: 'Bearer supersecrettoken123' }) as Record<string, string>;
    assert.equal(out.api_key, '[REDACTED]');
    assert.equal(out.name, 'kitchen');
    assert.ok(out.msg.includes('[REDACTED]'));
  });
});
