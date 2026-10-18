# Automation authoring (Hasswright skill)

1. Read existing automations (`ha.search_entities` + `ha.read_file` for YAML) before proposing anything.
2. Verify every `entity_id` exists; never invent IDs.
3. Prefer `mode: single/restart`, explicit triggers, and `id:` + `alias:`.
4. Draft via `ha.create_automation_draft` → show preview → request approval → `ha.apply_automation`.
5. After apply: `ha.check_config`, trace inspection, report success/failure honestly.
