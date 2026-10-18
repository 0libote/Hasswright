import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
} from "@astryxdesign/core/Chat";
import type {
  Approval,
  AuditEntry,
  ChatSession,
  ToolSchema,
} from "../src/types";
import type { Inventory } from "../src/context/engine";
import { api } from "./api";
import { connectHomeAssistantTheme, type ThemeState } from "./theme";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./styles.css";

const views = [
  "Workspace",
  "Overview",
  "Explorer",
  "Investigations",
  "Changes",
  "Maintenance",
  "Settings",
] as const;
type View = (typeof views)[number];
type Overview = Inventory & { demoFixture?: boolean; error?: string };
function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
const icons = {
  Workspace: "M4 4h16v12H8l-4 4Z",
  Overview: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  Explorer: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  Investigations: "M9 3h6M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M8 14h8",
  Changes: "m5 12 4 4L19 6M3 3h18v18H3Z",
  Maintenance: "m14 6 4-4 4 4-4 4M14 6 4 16l4 4 10-10",
  Settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
};
function Icon({
  name,
  size = 19,
}: {
  name: View | "plus" | "menu";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          name === "plus"
            ? "M12 5v14M5 12h14"
            : name === "menu"
              ? "M4 6h16M4 12h16M4 18h16"
              : icons[name]
        }
      />
    </svg>
  );
}
function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Json({ value }: { value: unknown }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
function useResource<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const load = async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(path);
      if (request === sequence.current) setData(result.body);
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [path]);
  return { data, setData, error, loading, load };
}
function ResourceStatus({
  resource,
}: {
  resource: { loading: boolean; error: string; load: () => Promise<void> };
}) {
  if (resource.error)
    return (
      <Notice>
        {resource.error}{" "}
        <Button label="Try again" clickAction={resource.load} />
      </Notice>
    );
  return resource.loading ? (
    <p className="muted" role="status">
      Loading…
    </p>
  ) : null;
}

function App() {
  const [theme, setTheme] = useState<ThemeState>({
    mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    source: "System",
  });
  const [view, setView] = useState<View>("Workspace");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const sending = useRef(false);
  const health = useResource<{ mode: string }>("health");
  const overview = useResource<{ overview: Overview }>("overview");
  const mode = health.data?.mode;
  useEffect(() => connectHomeAssistantTheme(setTheme), []);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  useEffect(() => {
    let active = true;
    api<{ sessions: ChatSession[] }>("sessions")
      .then(({ body }) => {
        if (active) {
          setSessions(body.sessions);
          setSession(body.sessions[0] || null);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
  }
  function saveSession(next: ChatSession) {
    setSession(next);
    setSessions((current) => [
      next,
      ...current.filter((item) => item.id !== next.id),
    ]);
  }
  async function newSession() {
    if (sending.current) return;
    setError("");
    try {
      const { body } = await api<{ session: ChatSession }>("sessions", {});
      saveSession(body.session);
      setDraft("");
      navigate("Workspace");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(content: string) {
    const text = content.trim();
    if (!text || sending.current || sessionLoading) return;
    if (text.length > 8000) {
      setError("Messages can contain up to 8,000 characters.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setDraft("");
    let activeSession = session;
    try {
      if (!activeSession)
        activeSession = (await api<{ session: ChatSession }>("sessions", {}))
          .body.session;
      const optimistic: ChatSession = {
        ...activeSession,
        title: activeSession.messages.length
          ? activeSession.title
          : text.slice(0, 60),
        updatedAt: Date.now(),
        messages: [
          ...activeSession.messages,
          { role: "user", content: text, ts: Date.now() },
        ],
      };
      saveSession(optimistic);
      const { body } = await api<{ reply: string }>(
        `sessions/${encodeURIComponent(activeSession.id)}/messages`,
        { content: text },
      );
      saveSession({
        ...optimistic,
        messages: [
          ...optimistic.messages,
          {
            role: "assistant",
            content: body.reply || "(No reply)",
            ts: Date.now(),
          },
        ],
      });
    } catch (e) {
      setError((e as Error).message);
      setDraft(text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const inv = overview.data?.overview;
  return (
    <Theme theme={neutralTheme} mode={theme.mode}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        {menuOpen && (
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          id="sidebar"
          className={`sidebar ${menuOpen ? "is-open" : ""}`}
          aria-label="Hasswright navigation"
        >
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("Workspace");
            }}
          >
            <span className="brand-icon">
              <Icon name="Overview" size={24} />
            </span>
            <span>
              <strong>Hasswright</strong>
              <small>Your home. Understood.</small>
            </span>
          </a>
          <Button
            label="New conversation"
            icon={<Icon name="plus" />}
            width="100%"
            isDisabled={busy || sessionLoading}
            clickAction={newSession}
          />
          <nav aria-label="Main navigation">
            {views.map((item) => (
              <Button
                key={item}
                label={item}
                icon={<Icon name={item} />}
                variant="ghost"
                width="100%"
                className={`nav-item ${view === item ? "is-active" : ""}`}
                aria-current={view === item ? "page" : undefined}
                onClick={() => navigate(item)}
              />
            ))}
          </nav>
          <div className="history">
            <p className="eyebrow">Conversations</p>
            {sessionLoading ? (
              <p className="muted">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="muted">Your conversations will appear here.</p>
            ) : (
              sessions.map((item) => (
                <Button
                  key={item.id}
                  label={item.title || "New conversation"}
                  variant="ghost"
                  width="100%"
                  className={`session-item ${session?.id === item.id ? "is-selected" : ""}`}
                  isDisabled={busy}
                  onClick={() => {
                    setSession(item);
                    setDraft("");
                    setError("");
                    navigate("Workspace");
                  }}
                />
              ))
            )}
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" />
            <span>
              {theme.source === "Home Assistant"
                ? "Using your HA theme"
                : "Following system appearance"}
            </span>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="title-group">
              <Button
                label={menuOpen ? "Close navigation" : "Open navigation"}
                icon={<Icon name="menu" />}
                isIconOnly
                variant="ghost"
                className="mobile-menu"
                aria-expanded={menuOpen}
                aria-controls="sidebar"
                onClick={() => setMenuOpen(!menuOpen)}
              />
              <span className="muted">Hasswright</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{view}</strong>
            </div>
            <span className="mode-pill">
              <span className="status-dot" />
              {mode
                ? `${mode[0].toUpperCase()}${mode.slice(1)} mode`
                : health.error
                  ? "Status unavailable"
                  : "Connecting…"}
            </span>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className={view === "Workspace" ? "workspace" : "page"}
          >
            {error && (
              <div className="error-banner" role="alert">
                {error}
                <Button
                  label="Dismiss"
                  variant="ghost"
                  onClick={() => setError("")}
                />
              </div>
            )}
            {view === "Workspace" ? (
              <>
                {inv?.demoFixture && (
                  <Notice>Demo fixture · Showing sample home data.</Notice>
                )}
                <ChatLayout
                  className="chat-layout"
                  density="spacious"
                  composer={
                    <div className="composer-wrap">
                      <ChatComposer
                        value={draft}
                        onChange={setDraft}
                        onSubmit={(text) => void send(text)}
                        isDisabled={busy || sessionLoading}
                        placeholder="Ask anything about your home…"
                        elevation="none"
                        footerActions={
                          <span className="composer-context">
                            <Icon name="Overview" size={15} />
                            Home Assistant context
                          </span>
                        }
                        sendActions={
                          draft && !busy ? (
                            <Button
                              label="Clear draft"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDraft("")}
                            />
                          ) : undefined
                        }
                        status={
                          busy
                            ? {
                                type: "warning",
                                message: "Hasswright is working…",
                              }
                            : undefined
                        }
                      />
                      <p className="composer-hint">
                        {mode === "observe"
                          ? "Observe mode is read-only. Changes are blocked."
                          : mode
                            ? "Changes go through the policy gateway and may need approval."
                            : "Checking policy mode…"}{" "}
                        <button
                          className="text-link"
                          onClick={() => navigate("Changes")}
                        >
                          Review changes
                        </button>
                      </p>
                    </div>
                  }
                >
                  <ChatMessageList
                    align="top"
                    isStreaming={busy}
                    emptyState={
                      <div className="welcome">
                        <div className="welcome-icon">
                          <Icon name="Overview" size={30} />
                        </div>
                        <p className="eyebrow">YOUR HOME. UNDERSTOOD.</p>
                        <h1>What can we work on?</h1>
                        <p className="welcome-description">
                          Understand your devices, untangle an automation,
                          <br className="desktop-break" /> or plan a better way
                          for your home to run.
                        </p>
                        <div className="suggestions">
                          {[
                            [
                              "Understand my home",
                              "Give me an overview of my Home Assistant installation.",
                              "Overview",
                            ],
                            [
                              "Investigate an issue",
                              "Help me investigate unavailable entities in my home.",
                              "Investigations",
                            ],
                            [
                              "Plan an automation",
                              "Help me plan an automation using my existing entities.",
                              "Changes",
                            ],
                          ].map(([label, prompt, icon]) => (
                            <Button
                              key={label}
                              label={label}
                              icon={<Icon name={icon as View} />}
                              className="suggestion"
                              isDisabled={sessionLoading}
                              onClick={() => {
                                setDraft(prompt);
                                document
                                  .querySelector<HTMLElement>(
                                    ".xds-chat-composer textarea, .xds-chat-composer [contenteditable]",
                                  )
                                  ?.focus();
                              }}
                            />
                          ))}
                        </div>
                        <div className="context-summary">
                          <span className="status-dot" />
                          {overview.loading
                            ? "Reading home context…"
                            : inv?.error || overview.error
                              ? "Home context unavailable"
                              : inv
                                ? `${countLabel(inv.counts?.states ?? 0, "state")} · ${countLabel(inv.counts?.devices ?? 0, "device")} · ${countLabel(inv.counts?.areas ?? 0, "area")}`
                                : "Home context unavailable"}
                        </div>
                      </div>
                    }
                  >
                    {session?.messages.length || busy ? (
                      <>
                        {(session?.messages || []).map((message, index) => (
                          <ChatMessage
                            key={`${session?.id}-${index}`}
                            sender={
                              message.role === "tool" ? "system" : message.role
                            }
                            avatar={
                              message.role === "assistant" ? (
                                <span className="assistant-avatar">
                                  <Icon name="Overview" size={18} />
                                </span>
                              ) : undefined
                            }
                          >
                            <ChatMessageBubble
                              variant={
                                message.role === "user" ? "filled" : "ghost"
                              }
                              name={
                                message.role === "assistant"
                                  ? "Hasswright"
                                  : undefined
                              }
                              metadata={
                                <ChatMessageMetadata
                                  timestamp={new Date(
                                    message.ts,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                />
                              }
                            >
                              <div className="message-text">
                                {message.content}
                              </div>
                            </ChatMessageBubble>
                          </ChatMessage>
                        ))}
                        {busy && (
                          <ChatMessage sender="assistant" name="Hasswright">
                            <p className="thinking" role="status">
                              Reading context and preparing a response…
                            </p>
                          </ChatMessage>
                        )}
                      </>
                    ) : null}
                  </ChatMessageList>
                </ChatLayout>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">HOME ASSISTANT</p>
                    <h1>{view}</h1>
                    <p className="muted">{descriptions[view]}</p>
                  </div>
                </div>
                {view === "Overview" && <OverviewView resource={overview} />}
                {view === "Explorer" && <ExplorerView />}
                {view === "Investigations" && <InvestigationsView />}
                {view === "Changes" && <ChangesView mode={mode} />}
                {view === "Maintenance" && <MaintenanceView />}
                {view === "Settings" && <SettingsView theme={theme} />}
              </>
            )}
          </main>
        </div>
      </div>
    </Theme>
  );
}
const descriptions: Record<Exclude<View, "Workspace">, string> = {
  Overview: "A clear view of the context available from your home.",
  Explorer: "Find entities and inspect their dependencies.",
  Investigations:
    "Start with the evidence: logs, repairs, and automation traces.",
  Changes: "Review proposed actions before they reach your home.",
  Maintenance: "Keep an eye on your home’s health.",
  Settings: "Appearance, capabilities, and installation details.",
};
function OverviewView({
  resource,
}: {
  resource: ReturnType<typeof useResource<{ overview: Overview }>>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const inv = resource.data?.overview;
  return (
    <>
      <ResourceStatus resource={resource} />
      {refreshError && <Notice>{refreshError}</Notice>}
      {inv && (
        <>
          {inv.demoFixture && (
            <Notice>
              Demo fixture · These are sample entities, not live home data.
            </Notice>
          )}
          {inv.error ? (
            <Notice>{inv.error}</Notice>
          ) : (
            <>
              <div className="stats-grid">
                {Object.entries(inv.counts || {}).map(([label, count]) => (
                  <div className="stat panel" key={label}>
                    <span className="muted">{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <Panel
                title="Home context"
                action={
                  <Button
                    label="Refresh inventory"
                    isLoading={refreshing}
                    clickAction={async () => {
                      setRefreshing(true);
                      setRefreshError("");
                      try {
                        resource.setData(
                          (
                            await api<{ overview: Overview }>(
                              "overview?refresh=1",
                            )
                          ).body,
                        );
                      } catch (e) {
                        setRefreshError((e as Error).message);
                      } finally {
                        setRefreshing(false);
                      }
                    }}
                  />
                }
              >
                <p className="muted">
                  Captured {new Date(inv.takenAt).toLocaleString()}
                  {inv.stale ? " · Stale" : ""}. Counts reflect available API
                  data.
                </p>
                <div className="domain-list">
                  {Object.entries(inv.domains || {}).map(([domain, count]) => (
                    <span className="chip" key={domain}>
                      {domain}
                      <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </Panel>
              <Panel
                title={`Unavailable or unknown · ${inv.unavailable?.length || 0}`}
              >
                {inv.unavailable?.length ? (
                  <div className="entity-list">
                    {inv.unavailable.map((entity) => (
                      <div className="entity-row" key={entity.entity_id}>
                        <code>{entity.entity_id}</code>
                        <span className="chip">{entity.state}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    No unavailable entities were returned by the inventory.
                  </p>
                )}
              </Panel>
              <details className="panel">
                <summary>Full inventory</summary>
                <Json value={inv} />
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}
function ExplorerView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { entity_id: string; state: string }[]
  >([]);
  const [dependencies, setDependencies] = useState<unknown>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    let active = true;
    setDependencies(undefined);
    setSelected("");
    setError("");
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      // Warm context first when Explorer is the first view visited.
      api("overview")
        .then(() =>
          api<{ results: typeof results }>(
            `search?q=${encodeURIComponent(query)}`,
          ),
        )
        .then(({ body }) => {
          if (active) setResults(body.results);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      requestId.current++;
    };
  }, [query]);
  return (
    <>
      <Panel title="Find an entity">
        <TextInput
          label="Search entities"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Search by entity ID or attributes…"
          size="lg"
          width="100%"
          hasClear
        />
        {error && <Notice>{error}</Notice>}
        {loading ? (
          <p role="status">Searching…</p>
        ) : results.length ? (
          <div className="entity-list">
            {results.map((entity) => (
              <div className="entity-row" key={entity.entity_id}>
                <div>
                  <code>{entity.entity_id}</code>
                  <small className="muted">{entity.state}</small>
                </div>
                <Button
                  label="Dependencies"
                  clickAction={async () => {
                    const request = ++requestId.current;
                    setError("");
                    setDependencies(undefined);
                    setSelected(entity.entity_id);
                    try {
                      const result = await api(
                        `dependencies/${encodeURIComponent(entity.entity_id)}`,
                      );
                      if (request === requestId.current)
                        setDependencies(result.body);
                    } catch (e) {
                              if (request === requestId.current) {
                                setSelected("");
                        setError((e as Error).message);
                              }
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            {query.trim()
              ? "No matching entities."
              : "Search your current Home Assistant inventory."}
          </p>
        )}
      </Panel>
      {selected && (
        <Panel title={selected}>
          {dependencies ? (
            <Json value={dependencies} />
          ) : (
            <p>Loading dependencies…</p>
          )}
        </Panel>
      )}
    </>
  );
}
function InvestigationsView() {
  const [entity, setEntity] = useState("");
  return (
    <div className="investigation-grid">
      <ToolPanel title="Error log" tool="ha.get_log" label="Load log" />
      <ToolPanel title="Repairs" tool="ha.get_repairs" label="Load repairs" />
      <ToolPanel
        title="Automation trace"
        tool="ha.get_trace"
        label="Load trace"
        args={{ entity_id: entity }}
        disabled={!entity.trim()}
      >
        <TextInput
          label="Automation entity ID"
          value={entity}
          onChange={setEntity}
          placeholder="Enter an existing entity ID"
          width="100%"
        />
      </ToolPanel>
    </div>
  );
}
function ToolPanel({
  title,
  tool,
  label,
  args = {},
  children,
  disabled,
}: {
  title: string;
  tool: string;
  label: string;
  args?: Record<string, unknown>;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [output, setOutput] = useState<unknown>();
  const [error, setError] = useState("");
  return (
    <Panel title={title}>
      {children}
      <Button
        label={label}
        isDisabled={disabled}
        clickAction={async () => {
          setError("");
          try {
            setOutput((await api("tools/exec", { tool, args })).body);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {error && <Notice>{error}</Notice>}
      {output !== undefined && <Json value={output} />}
    </Panel>
  );
}
function ChangesView({ mode }: { mode?: string }) {
  const approvals = useResource<{ approvals: Approval[] }>("approvals");
  const [tool, setTool] = useState("");
  const [args, setArgs] = useState("{}");
  const [approvalId, setApprovalId] = useState("");
  const [output, setOutput] = useState<unknown>();
  const [error, setError] = useState("");
  const [approvalNeeded, setApprovalNeeded] = useState(false);
  return (
    <>
      {mode === "observe" && (
        <Notice>
          Observe mode · Mutations are blocked. Read-only tools remain
          available.
        </Notice>
      )}
      <Panel
        title="Approval requests"
        action={
          <Button label="Refresh approvals" clickAction={approvals.load} />
        }
      >
        <ResourceStatus resource={approvals} />
        {error && <Notice>{error}</Notice>}
        {!approvals.loading && approvals.data?.approvals.length === 0 && (
          <div className="empty-panel">
            <Icon name="Changes" size={28} />
            <h3>Nothing waiting for approval</h3>
            <p className="muted">
              Proposed changes will appear here for review.
            </p>
          </div>
        )}
        {approvals.data?.approvals.map((approval) => (
          <article className="approval" key={approval.id}>
            <div className="panel-heading">
              <h3>{approval.tool}</h3>
              <span className="chip">
                {approval.status} · {approval.risk}
              </span>
            </div>
            <p className="muted">
              Expires {new Date(approval.expiresAt).toLocaleString()}
            </p>
            <pre className="json">{approval.preview}</pre>
            <details>
              <summary>Arguments</summary>
              <Json value={approval.args} />
            </details>
            {approval.status === "pending" &&
              approval.expiresAt > Date.now() && (
                <div className="actions">
                  {[true, false].map((approve) => (
                    <Button
                      key={String(approve)}
                      label={approve ? "Approve" : "Reject"}
                      variant={approve ? "primary" : "secondary"}
                      clickAction={async () => {
                        setError("");
                        try {
                          await api("approvals/decide", {
                            id: approval.id,
                            approve,
                          });
                          await approvals.load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            {approval.status === "approved" &&
              approval.expiresAt > Date.now() && (
                <Button
                  label="Use in tool runner"
                  onClick={() => {
                    setTool(approval.tool);
                    setArgs(JSON.stringify(approval.args, null, 2));
                    setApprovalId(approval.id);
                    setOutput(undefined);
                    setApprovalNeeded(false);
                  }}
                />
              )}
          </article>
        ))}
      </Panel>
      <Panel title="Tool runner">
        <p className="muted">
          Every request uses the policy gateway. Approval permits a matching
          request; it does not execute it.
        </p>
        <div className="form-stack">
          <TextInput
            label="Tool name"
            value={tool}
            onChange={(value) => {
              setTool(value);
              setApprovalId("");
            }}
              placeholder="ha.check_config"
            width="100%"
          />
          <label htmlFor="tool-args">Arguments (JSON)</label>
          <textarea
            id="tool-args"
            value={args}
            onChange={(e) => {
              setArgs(e.target.value);
              setApprovalId("");
            }}
            rows={4}
            spellCheck={false}
          />
          <TextInput
              label="Approval ID (select an approved request above)"
            value={approvalId}
              isReadOnly
            width="100%"
          />
          <Button
            label="Run tool"
            variant="primary"
            isDisabled={!tool.trim()}
            clickAction={async () => {
              setError("");
                setOutput(undefined);
              setApprovalNeeded(false);
              try {
                const parsed: unknown = JSON.parse(args || "{}");
                if (
                  !parsed ||
                  typeof parsed !== "object" ||
                  Array.isArray(parsed)
                )
                  throw new Error("Arguments must be a JSON object.");
                const result = await api("tools/exec", {
                  tool,
                  args: parsed,
                  ...(approvalId ? { approvalId } : {}),
                });
                setOutput(result.body);
                setApprovalNeeded(result.status === 428);
                await approvals.load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </div>
        {approvalNeeded && (
          <Notice>
            Approval requested. Review it above, then use the approved request
            in the tool runner.
          </Notice>
        )}
        {output !== undefined && <Json value={output} />}
      </Panel>
    </>
  );
}
function MaintenanceView() {
  const resource = useResource<{ enabled: boolean; note: string }>(
    "maintenance",
  );
  return (
    <Panel title="Proactive checks">
      <ResourceStatus resource={resource} />
      {resource.data && (
        <>
          <span className="chip">
            {resource.data.enabled ? "Enabled" : "Disabled"}
          </span>
          <p>
            Checks are read-only when enabled. Hasswright never automatically
            repairs your home.
          </p>
          <p className="muted">
            Disabled by default. This page reports the current maintenance
            status.
          </p>
        </>
      )}
    </Panel>
  );
}
type VersionInfo = {
  installed?: string;
  repository?: string;
  howToUpdate?: string;
  supervisor?: {
    installed?: string;
    latest?: string;
    updateAvailable?: boolean;
  };
};
function SettingsView({ theme }: { theme: ThemeState }) {
  const version = useResource<{ version: VersionInfo }>("version");
  const tools = useResource<{ tools: ToolSchema[] }>("tools");
  const audit = useResource<{ audit: AuditEntry[] }>("audit");
  const info = version.data?.version;
  return (
    <>
      <Panel title="Appearance">
        <div className="setting-row">
          <div>
            <h3>
              {theme.source === "Home Assistant"
                ? "Your Home Assistant theme"
                : "System appearance"}
            </h3>
            <p className="muted">
              {theme.source === "Home Assistant"
                ? "Colors, typography, and card styling follow your active HA theme. Changes sync automatically."
                : "Open Hasswright through Home Assistant Ingress to follow your HA theme. Direct and cross-origin pages follow your device appearance."}
            </p>
          </div>
          <span className="chip">{theme.mode}</span>
        </div>
      </Panel>
      <Panel title="Version & updates">
        <ResourceStatus resource={version} />
        {info && (
          <>
            <div className="setting-row">
              <strong>Hasswright {info.installed || "Unknown version"}</strong>
              <span className="chip">
                {info.supervisor?.updateAvailable
                  ? "Update available"
                  : info.supervisor?.latest
                    ? "Up to date"
                    : "Supervisor status unavailable"}
              </span>
            </div>
            {info.supervisor?.latest && (
              <p className="muted">Latest: {info.supervisor.latest}</p>
            )}
            <p>
              Install updates in Home Assistant: Settings → Add-ons → Hasswright
              → Update.
            </p>
            <p className="muted">
              Sessions and settings in /data survive updates.
            </p>
          </>
        )}
      </Panel>
      <Panel title="Available tools">
        <ResourceStatus resource={tools} />
        {tools.data?.tools.map((tool) => (
          <details key={tool.name} className="tool-details">
            <summary>
              <code>{tool.name}</code>
              <span className="muted">
                {tool.readonly ? "Read-only" : tool.risk}
              </span>
            </summary>
            <p>{tool.description}</p>
            <Json value={tool.params} />
          </details>
        ))}
      </Panel>
      <Panel title="Recent audit activity">
        <ResourceStatus resource={audit} />
        {audit.data?.audit.length === 0 && (
          <p className="muted">No activity recorded.</p>
        )}
        {audit.data?.audit.map((entry, index) => (
          <div className="audit-row" key={index}>
            <div>
              <strong>{entry.tool || entry.action}</strong>
              <small className="muted">
                {new Date(entry.ts).toLocaleString()} · {entry.actor}
              </small>
            </div>
            <span className="chip">{entry.result}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
