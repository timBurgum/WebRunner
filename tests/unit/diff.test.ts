import { describe, it, expect } from 'vitest';
import { diffStates, formatDiffForPrompt } from '../../src/core/state/diff.js';
import type { CompactState } from '../../src/core/state/model.js';

function makeState(elements: Array<{ ref: string; label: string; visible?: boolean; disabled?: boolean }>): CompactState {
  return {
    meta: { runId: 'test', timestamp: new Date().toISOString(), url: 'https://example.com', title: 'Test' },
    pageSummary: { headings: [], forms: [], notices: [] },
    interactive: elements.map(e => ({
      ref: e.ref,
      role: 'button',
      label: e.label,
      valuePresent: false,
      disabled: e.disabled ?? false,
      visible: e.visible ?? true,
      selectors: { primary: `#${e.ref}`, fallback: [] },
    })),
  };
}

describe('diffStates', () => {
  it('detects added elements', () => {
    const prev = makeState([{ ref: 'E1', label: 'Submit' }]);
    const curr = makeState([{ ref: 'E1', label: 'Submit' }, { ref: 'E2', label: 'Cancel' }]);
    const diff = diffStates(prev, curr);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.ref).toBe('E2');
  });

  it('detects removed elements', () => {
    const prev = makeState([{ ref: 'E1', label: 'Submit' }, { ref: 'E2', label: 'Cancel' }]);
    const curr = makeState([{ ref: 'E1', label: 'Submit' }]);
    const diff = diffStates(prev, curr);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.ref).toBe('E2');
  });

  it('detects label changes', () => {
    const prev = makeState([{ ref: 'E1', label: 'Sign In' }]);
    const curr = makeState([{ ref: 'E1', label: 'Sign Out' }]);
    const diff = diffStates(prev, curr);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.ref).toBe('E1');
  });

  it('detects visibility changes', () => {
    const prev = makeState([{ ref: 'E1', label: 'Btn', visible: false }]);
    const curr = makeState([{ ref: 'E1', label: 'Btn', visible: true }]);
    const diff = diffStates(prev, curr);
    expect(diff.changed).toHaveLength(1);
  });

  it('returns empty diff for identical states', () => {
    const state = makeState([{ ref: 'E1', label: 'Submit' }]);
    const diff = diffStates(state, state);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });
});

describe('formatDiffForPrompt', () => {
  it('formats added/removed/changed into readable string', () => {
    const prev = makeState([{ ref: 'E1', label: 'Old' }]);
    const curr = makeState([{ ref: 'E2', label: 'New' }]);
    const diff = diffStates(prev, curr);
    const text = formatDiffForPrompt(diff);
    expect(text).toContain('Added');
    expect(text).toContain('Removed');
  });

  it('returns "No observable changes" for empty diff', () => {
    const state = makeState([]);
    const diff = diffStates(state, state);
    expect(formatDiffForPrompt(diff)).toBe('No observable changes.');
  });
});
