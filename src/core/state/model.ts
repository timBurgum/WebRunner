import type { SelectorSet } from '../browser/selectors.js';

export type ElementRole =
  | 'input'
  | 'button'
  | 'link'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'other';

export interface InteractiveElement {
  /** Stable reference ID within this state snapshot, e.g. "E1", "E12" */
  ref: string;
  role: ElementRole;
  label: string;
  name?: string;
  inputType?: string;
  valuePresent: boolean;
  disabled: boolean;
  visible: boolean;
  selectors: SelectorSet;
  /** Inner text for buttons/links */
  text?: string;
  /** Current URL for links */
  href?: string;
}

export interface PageSummary {
  headings: string[];
  forms: string[];
  notices: string[];
}

export interface StateMeta {
  runId: string;
  timestamp: string;
  url: string;
  title: string;
}

export interface CompactState {
  meta: StateMeta;
  pageSummary: PageSummary;
  interactive: InteractiveElement[];
}

export interface StateDiff {
  added: InteractiveElement[];
  removed: InteractiveElement[];
  changed: Array<{ ref: string; before: Partial<InteractiveElement>; after: Partial<InteractiveElement> }>;
}
