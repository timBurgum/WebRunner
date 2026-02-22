export const stepOps = ['navigate', 'click', 'type', 'select', 'waitFor', 'extract', 'screenshot', 'scroll'] as const;
export type StepOp = typeof stepOps[number];

export const assertionKinds = ['urlContains', 'urlEquals', 'titleContains', 'textPresent', 'elementVisible', 'downloadExists'] as const;
export type AssertionKind = typeof assertionKinds[number];

export const verdictStatuses = ['success', 'patch', 'escalate'] as const;
export type VerdictStatus = typeof verdictStatuses[number];

// ── JSON Schemas ──────────────────────────────────────────────────────────────

export const StepSchema = {
  type: 'object',
  required: ['id', 'op'],
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    op: { type: 'string', enum: stepOps },
    url: { type: 'string' },
    ref: { type: 'string' },
    text: { type: 'string' },
    value: { type: 'string' },
    kind: { type: 'string' },
    timeoutMs: { type: 'number' },
    schemaRef: { type: 'string' },
    out: { type: 'string' },
    direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
    amount: { type: 'number' },
  },
};

export const AssertionSchema = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: assertionKinds },
    value: { type: 'string' },
    ref: { type: 'string' },
    filePattern: { type: 'string' },
  },
};

export const OnFailureSchema = {
  type: 'object',
  properties: {
    retry: {
      type: 'object',
      properties: { maxAttempts: { type: 'number' } },
    },
    escalateIf: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export const PlanSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['goal', 'steps'],
  properties: {
    goal: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: StepSchema, minItems: 1 },
    assertions: { type: 'array', items: AssertionSchema },
    onFailure: OnFailureSchema,
    schemaVersion: { type: 'string', default: '1.0' },
  },
};

export const VerdictSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['status', 'summary'],
  properties: {
    status: { type: 'string', enum: verdictStatuses },
    summary: { type: 'string' },
    evidence: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        keyTexts: { type: 'array', items: { type: 'string' } },
        files: { type: 'array', items: { type: 'string' } },
      },
    },
    patchPlan: { type: 'string' },
    reason: { type: 'string' },
    next: { type: 'string', enum: ['stop', 'runPatch', 'enterStepMode'] },
    schemaVersion: { type: 'string', default: '1.0' },
  },
};

// TypeScript interfaces matching schemas
export interface Step {
  id: string;
  op: StepOp;
  url?: string;
  ref?: string;
  text?: string;
  value?: string;
  kind?: string;
  timeoutMs?: number;
  schemaRef?: string;
  out?: string;
  direction?: 'up' | 'down' | 'top' | 'bottom';
  amount?: number;
}

export interface Assertion {
  kind: AssertionKind;
  value?: string;
  ref?: string;
  filePattern?: string;
}

export interface Plan {
  goal: string;
  assumptions?: string[];
  steps: Step[];
  assertions?: Assertion[];
  onFailure?: {
    retry?: { maxAttempts: number };
    escalateIf?: string[];
  };
  schemaVersion?: string;
}

export interface Verdict {
  status: VerdictStatus;
  summary: string;
  evidence?: {
    url?: string;
    keyTexts?: string[];
    files?: string[];
  };
  patchPlan?: string;
  reason?: string;
  next?: 'stop' | 'runPatch' | 'enterStepMode';
  schemaVersion?: string;
}
