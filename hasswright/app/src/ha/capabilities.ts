// Capability matrix: what is supported via stable APIs.
export interface Capability { supported: boolean; method: string; notes: string }

export const CAPABILITIES: Record<string, Capability> = {
  'core.states.read': { supported: true, method: 'REST /api/states', notes: 'Read-only' },
  'core.services.call': { supported: true, method: 'REST /api/services', notes: 'Write; approval-gated' },
  'core.config.check': { supported: true, method: 'POST /api/config/core/check_config', notes: 'Admin token' },
  'core.template.render': { supported: true, method: 'POST /api/template', notes: 'Admin token' },
  'core.log.read': { supported: true, method: 'GET /api/error_log', notes: 'Admin token' },
  'ws.device_registry': { supported: true, method: 'WS config/device_registry/list', notes: '' },
  'ws.entity_registry': { supported: true, method: 'WS config/entity_registry/list', notes: '' },
  'ws.area_registry': { supported: true, method: 'WS config/area_registry/list', notes: '' },
  'ws.automation.trace': { supported: true, method: 'WS automation/trace/get', notes: '' },
  'ws.repairs': { supported: true, method: 'WS repairs/list_issues', notes: '' },
  'ws.config_entries': { supported: true, method: 'WS config_entries/* (read; flows need UI)', notes: 'Setup flows that need physical action are guided, not automated' },
  'supervisor.info': { supported: true, method: 'GET /supervisor/info', notes: 'Needs hassio_role default+' },
  'supervisor.backups': { supported: true, method: 'GET /backups (+manager for create)', notes: 'Restore = high risk' },
  'file.config.read': { supported: true, method: '/homeassistant allowlist read', notes: 'YAML/lists only; .storage denied' },
  'file.config.write': { supported: true, method: 'allowlist write + check_config + backup', notes: 'Approval-gated' },
  'host.root.shell': { supported: false, method: 'n/a', notes: 'Explicitly unsupported; no host-root shortcut' },
};
