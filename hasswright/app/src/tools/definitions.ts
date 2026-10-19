import type { ToolSchema } from '../types.js';

export const TOOL_DEFINITIONS: ToolSchema[] = [
  { name: 'ha.get_overview', description: 'Summarized installation health: versions, counts, issues.', risk: 'low', readonly: true, params: {} },
  { name: 'ha.search_entities', description: 'Search entities/states by text.', risk: 'low', readonly: true, params: { query: { type: 'string', required: true } } },
  { name: 'ha.get_state', description: 'Get one entity state.', risk: 'low', readonly: true, params: { entity_id: { type: 'string', required: true } } },
  { name: 'ha.get_log', description: 'Read Core error log (redacted).', risk: 'low', readonly: true, params: { max_chars: { type: 'number' } } },
  { name: 'ha.get_trace', description: 'Automation execution trace.', risk: 'low', readonly: true, params: { entity_id: { type: 'string', required: true } } },
  { name: 'ha.get_repairs', description: 'List repair issues.', risk: 'low', readonly: true, params: {} },
  { name: 'ha.check_config', description: 'Validate configuration.', risk: 'low', readonly: true, params: {} },
  { name: 'ha.render_template', description: 'Render + validate a Jinja template.', risk: 'low', readonly: true, params: { template: { type: 'string', required: true } } },
  { name: 'ha.list_files', description: 'List files in an allowed dir.', risk: 'low', readonly: true, params: { dir: { type: 'string', required: true } } },
  { name: 'ha.read_file', description: 'Read an allowlisted config/log file (redacted).', risk: 'low', readonly: true, params: { path: { type: 'string', required: true } } },
  { name: 'ha.call_service', description: 'Call a HA service (device control). Approval-gated.', risk: 'high', readonly: false, params: { domain: { type: 'string', required: true }, service: { type: 'string', required: true }, data: { type: 'object' } } },
  { name: 'ha.create_automation_draft', description: 'Validate + preview an automation without saving.', risk: 'low', readonly: true, params: { automation: { type: 'object', required: true } } },
  { name: 'ha.apply_automation', description: 'Save automation via file edit pipeline.', risk: 'approval', readonly: false, params: { path: { type: 'string', required: true }, automation: { type: 'object', required: true } } },
  { name: 'ha.update_dashboard', description: 'Propose/apply Lovelace dashboard change.', risk: 'approval', readonly: false, params: { path: { type: 'string', required: true }, fragment: { type: 'object', required: true } } },
  { name: 'ha.write_file', description: 'Targeted config file edit with backup+validation.', risk: 'approval', readonly: false, params: { path: { type: 'string', required: true }, old_text: { type: 'string' }, new_text: { type: 'string', required: true } } },
  { name: 'ha.restart_core', description: 'Restart Home Assistant Core.', risk: 'high', readonly: false, params: {} },
  { name: 'ha.create_backup', description: 'Create a full backup (Supervisor), with explicit approval.', risk: 'approval', readonly: false, params: { name: { type: 'string' } } },
  { name: 'ha.restore_backup', description: 'Restore a backup. Critical.', risk: 'critical', readonly: false, params: { slug: { type: 'string', required: true } } },
];
