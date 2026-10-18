import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HACore } from '../src/ha/core.js';

describe('demo fixture (env-gated sample data)', () => {
  it('is off by default and serves no fake data unauthed', async () => {
    delete process.env.HASSWRIGHT_DEMO_FIXTURE;
    const ha = new HACore('http://127.0.0.1:9', '');
    assert.equal(ha.fixture, false);
  });
  it('serves labeled sample states when enabled without a token', async () => {
    process.env.HASSWRIGHT_DEMO_FIXTURE = '1';
    try {
      const ha = new HACore('http://127.0.0.1:9', '');
      assert.equal(ha.fixture, true);
      const states = await ha.getStates();
      assert.ok(states.length >= 4);
      assert.ok(states.some((s) => s.state === 'unavailable'));
      const one = await ha.getState('light.hallway');
      assert.equal(one?.state, 'on');
      assert.equal(await ha.getState('light.ghost'), null);
      const cfg = (await ha.getConfig()) as { location_name: string };
      assert.match(cfg.location_name, /fixture/i);
      const log = await ha.getLog();
      assert.match(log, /fixture/i);
    } finally {
      delete process.env.HASSWRIGHT_DEMO_FIXTURE;
    }
  });
  it('never activates when a real token is configured', () => {
    process.env.HASSWRIGHT_DEMO_FIXTURE = '1';
    try {
      const ha = new HACore('http://127.0.0.1:9', 'real-token');
      assert.equal(ha.fixture, false);
    } finally {
      delete process.env.HASSWRIGHT_DEMO_FIXTURE;
    }
  });
});
