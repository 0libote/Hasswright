export interface AgentAdapter {
  name: string;
  chat(sessionId: string, prompt: string, context: string, tools: unknown): Promise<{ text: string; toolCalls: Array<{ tool: string; args: Record<string, unknown> }> }>;
  status(): Promise<{ ok: boolean; detail: string }>;
}

export class MockAgent implements AgentAdapter {
  name = 'mock';
  async status() { return { ok: true, detail: 'built-in mock (no provider configured)' }; }
  async chat(_s: string, prompt: string, _c: string, _t: unknown) {
    const p = prompt.toLowerCase();
    let text = 'I reviewed your installation context. ';
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    if (p.includes('slow') || p.includes('fix') || p.includes('look through')) {
      text += 'Start with Overview → get_overview, then error_log and repairs. I found no fabricated issues; connect Home Assistant for live data.';
      calls.push({ tool: 'ha.get_overview', args: {} });
    } else if (p.includes('zigbee') || p.includes('disconnect') || p.includes('sensor')) {
      text += 'For disconnects: check entity availability, ZHA radio metrics, automation traces, then repairs. Tell me the entity_id to dig deeper.';
    } else if (p.includes('automation') || p.includes('hallway')) {
      text += 'I can draft the automation first (read-only preview), then ask for approval to save it. No entities were invented.';
      calls.push({ tool: 'ha.create_automation_draft', args: { automation: { alias: 'Draft', trigger: 'state', action: 'notify' } } });
    } else {
      text += 'Ask about devices, entities, automations, logs, or dashboards. Mutations always need approval in Assist/Managed modes and are blocked in Observe.';
    }
    return { text, toolCalls: calls };
  }
}
