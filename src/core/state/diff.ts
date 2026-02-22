import type { CompactState, InteractiveElement, StateDiff } from './model.js';

type ElementMap = Map<string, InteractiveElement>;

function indexByRef(elements: InteractiveElement[]): ElementMap {
  return new Map(elements.map(el => [el.ref, el]));
}

const TRACKED_FIELDS: (keyof InteractiveElement)[] = [
  'label', 'disabled', 'visible', 'valuePresent', 'text', 'href',
];

function changed(
  before: InteractiveElement,
  after: InteractiveElement,
): { before: Partial<InteractiveElement>; after: Partial<InteractiveElement> } | null {
  const bDiff: Partial<InteractiveElement> = {};
  const aDiff: Partial<InteractiveElement> = {};

  for (const field of TRACKED_FIELDS) {
    if (before[field] !== after[field]) {
      (bDiff as Record<string, unknown>)[field] = before[field];
      (aDiff as Record<string, unknown>)[field] = after[field];
    }
  }

  if (Object.keys(bDiff).length === 0) return null;
  return { before: bDiff, after: aDiff };
}

export function diffStates(prev: CompactState, curr: CompactState): StateDiff {
  const prevMap = indexByRef(prev.interactive);
  const currMap = indexByRef(curr.interactive);

  const added: InteractiveElement[] = [];
  const removed: InteractiveElement[] = [];
  const changedList: StateDiff['changed'] = [];

  for (const [ref, currEl] of currMap) {
    if (!prevMap.has(ref)) {
      added.push(currEl);
    } else {
      const prevEl = prevMap.get(ref)!;
      const diff = changed(prevEl, currEl);
      if (diff) {
        changedList.push({ ref, ...diff });
      }
    }
  }

  for (const [ref, prevEl] of prevMap) {
    if (!currMap.has(ref)) {
      removed.push(prevEl);
    }
  }

  return { added, removed, changed: changedList };
}

export function formatDiffForPrompt(diff: StateDiff): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push(`Added elements (${diff.added.length}):`);
    diff.added.slice(0, 10).forEach(el =>
      lines.push(`  + ${el.ref} [${el.role}] "${el.label}"`),
    );
  }

  if (diff.removed.length > 0) {
    lines.push(`Removed elements (${diff.removed.length}):`);
    diff.removed.slice(0, 10).forEach(el =>
      lines.push(`  - ${el.ref} [${el.role}] "${el.label}"`),
    );
  }

  if (diff.changed.length > 0) {
    lines.push(`Changed elements (${diff.changed.length}):`);
    diff.changed.slice(0, 10).forEach(c =>
      lines.push(`  ~ ${c.ref}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`),
    );
  }

  return lines.join('\n') || 'No observable changes.';
}
