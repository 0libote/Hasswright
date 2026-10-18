import type { Mode, Risk } from '../types.js';

// Server-side authorization. Prompt text can never widen these rules.
const TOOL_RISK: Record<string, Risk> = {
  'ha.get_overview': 'low',
  'ha.search_entities': 'low',
  'ha.get_state': 'low',
  'ha.get_log': 'low',
  'ha.get_trace': 'low',
  'ha.get_repairs': 'low',
  'ha.check_config': 'low',
  'ha.render_template': 'low',
  'ha.list_files': 'low',
  'ha.read_file': 'low',
  'ha.call_service': 'high',       // device control: locks/alarms/climate get critical handling in gateway
  'ha.create_automation_draft': 'low',
  'ha.apply_automation': 'approval',
  'ha.update_dashboard': 'approval',
  'ha.write_file': 'approval',
  'ha.restart_core': 'high',
  'ha.create_backup': 'low',
  'ha.restore_backup': 'critical',
};

const CRITICAL_DOMAINS = new Set(['lock', 'alarm_control_panel', 'climate', 'cover', 'siren', 'water_heater']);

export function classify(tool: string, args: Record<string, unknown> = {}): Risk {
  if (tool === 'ha.call_service') {
    const domain = String((args.domain as string) || (args.entity_id as string || '').split('.')[0] || '');
    if (CRITICAL_DOMAINS.has(domain)) return 'critical';
    return 'high';
  }
  return TOOL_RISK[tool] || 'approval';
}

export function mayExecute(mode: Mode, risk: Risk, approved: boolean): { ok: boolean; reason: string } {
  if (risk === 'low') return { ok: true, reason: 'low-risk' };
  if (mode === 'observe') return { ok: false, reason: 'observe mode is read-only' };
  if (!approved) return { ok: false, reason: 'approval required' };
  if (mode === 'assist') return { ok: true, reason: 'explicit approval' };
  if (mode === 'managed') {
    if (risk === 'critical' || risk === 'high') {
      // managed still requires explicit per-action approval for high/critical (policy: narrow low-risk auto allowed)
      return approved ? { ok: true, reason: 'managed + explicit approval' } : { ok: false, reason: 'approval required' };
    }
    return { ok: true, reason: 'managed policy' };
  }
  return { ok: false, reason: 'denied' };
}
