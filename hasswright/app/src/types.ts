// Shared types and schemas
export type Mode = 'observe' | 'assist' | 'managed';
export type Risk = 'low' | 'approval' | 'high' | 'critical';
export type ChangeStatus =
  | 'proposed' | 'awaiting_approval' | 'applying' | 'verifying'
  | 'completed' | 'failed' | 'partially_completed' | 'recovery_required';

export interface ToolSchema {
  name: string;
  description: string;
  risk: Risk;
  readonly: boolean;
  params: Record<string, { type: string; required?: boolean; enum?: string[]; description?: string }>;
}

export interface Approval {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  risk: Risk;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  preview?: string;
  decidedAt?: number;
}

export interface AuditEntry {
  ts: number;
  actor: string;
  action: string;
  tool?: string;
  result: string;
  detail?: string;
}

export interface ChatMessage { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; ts: number; }
export interface ChatSession {
  id: string; title: string; createdAt: number; updatedAt: number;
  model?: string; provider?: string; messages: ChatMessage[];
}

export const SECRET_KEYS = [/token/i, /api[_-]?key/i, /password/i, /secret/i, /credential/i, /access[_-]?token/i, /refresh[_-]?token/i];

export function redactSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    // redact bearer tokens and long hex secrets conservatively
    return value
      .replace(/(bearer\s+)[A-Z0-9._~+/=-]{8,}/gi, '$1[REDACTED]')
      .replace(/(token["'\s:=]+)[A-Z0-9._~+/=-]{8,}/gi, '$1[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.some((re) => re.test(k)) ? '[REDACTED]' : redactSecrets(v);
    }
    return out;
  }
  return value;
}
