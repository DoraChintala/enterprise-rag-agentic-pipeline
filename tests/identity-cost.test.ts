import { describe, expect, it } from 'vitest';
import { CostMeter } from '../src/agents/cost.js';
import { identityForRole, isAllowed } from '../src/agents/identity.js';

describe('identity & permissioning', () => {
  it('gives analysts planner + rag scopes', () => {
    const id = identityForRole('Financial Analyst');
    expect(isAllowed(id, 'planner')).toBe(true);
    expect(isAllowed(id, 'rag')).toBe(true);
  });

  it('restricts a Compliance Officer to rag only (no planner)', () => {
    const id = identityForRole('Compliance Officer');
    expect(isAllowed(id, 'rag')).toBe(true);
    expect(isAllowed(id, 'planner')).toBe(false);
  });

  it('grants a Tech Lead all tools via wildcard', () => {
    const id = identityForRole('Tech Lead');
    expect(isAllowed(id, 'planner')).toBe(true);
    expect(isAllowed(id, 'anything')).toBe(true);
  });

  it('falls back to a safe default for unknown roles', () => {
    const id = identityForRole('Unknown Role');
    expect(id.role).toBe('Financial Analyst');
    expect(isAllowed(id, 'rag')).toBe(true);
  });
});

describe('cost governance', () => {
  it('tracks tokens and reports a cost summary', () => {
    const meter = new CostMeter({ maxSteps: 5, maxTokens: 1000 });
    meter.record('hello world this is some text');
    const s = meter.summary();
    expect(s.steps).toBe(1);
    expect(s.tokens).toBeGreaterThan(0);
    expect(s.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });

  it('flags when the step budget is exceeded', () => {
    const meter = new CostMeter({ maxSteps: 2, maxTokens: 100000 });
    meter.record('a');
    meter.record('b');
    expect(meter.exceeded().over).toBe(true);
    expect(meter.exceeded().reason).toContain('step budget');
  });

  it('flags when the token budget is exceeded', () => {
    const meter = new CostMeter({ maxSteps: 100, maxTokens: 5 });
    meter.record('this text is clearly more than five tokens long');
    expect(meter.exceeded().over).toBe(true);
    expect(meter.exceeded().reason).toContain('token budget');
  });
});
