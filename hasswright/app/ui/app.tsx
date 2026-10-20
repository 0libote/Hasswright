import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  ChatComposer,
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
  Workspace: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
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
  const [focusTask, setFocusTask] = useState(0);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const sending = useRef(false);
  const health = useResource<{ mode: string; agent?: string }>("health");
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
    if (focusTask) document.getElementById("task-instructions")?.focus();
  }, [focusTask]);
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
  function workOnTask(prompt?: string) {
    navigate("Workspace");
    if (prompt !== undefined) setDraft(prompt);
    setFocusTask((current) => current + 1);
  }
  function newSession() {
    if (sending.current) return;
    setSession(null);
    setError("");
    workOnTask("");
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
      if (activeSession) saveSession(activeSession);
      setError((e as Error).message);
      setDraft(text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
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
          <p className="eyebrow nav-caption">INSTALLATION</p>
          <nav aria-label="Main navigation">
            {views.map((item) => (
              <Button
                key={item}
                label={item === "Overview" ? "Inventory" : item}
                icon={<Icon name={item} />}
                variant="ghost"
                width="100%"
                className={`nav-item ${view === item ? "is-active" : ""}`}
                aria-current={view === item ? "page" : undefined}
                onClick={() => navigate(item)}
              />
            ))}
          </nav>
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
            <div className="topbar-actions">
              <Button
                label={view === "Workspace" ? "New task" : "Work on a task"}
                variant="secondary"
                icon={<Icon name="plus" />}
                isDisabled={busy}
                onClick={() =>
                  view === "Workspace" ? newSession() : workOnTask()
                }
              />
              <span className="mode-pill">
                <span className="status-dot" />
                {mode
                  ? `${mode[0].toUpperCase()}${mode.slice(1)} mode`
                  : health.error
                    ? "Status unavailable"
                    : "Connecting…"}
              </span>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="page">
            <div className="page-heading">
              <div>
                {view !== "Workspace" && (
                  <p className="eyebrow">Home Assistant</p>
                )}
                <h1>
                  {view === "Workspace"
                    ? "Workspace"
                    : view === "Overview"
                      ? "Inventory"
                      : view}
                </h1>
                <p className="muted">{descriptions[view]}</p>
              </div>
            </div>
            {view === "Workspace" && (
              <WorkspaceView
                resource={overview}
                mode={mode}
                navigate={navigate}
                ask={workOnTask}
                workbench={
                  <TaskWorkbench
                    session={session}
                    sessions={sessions}
                    sessionLoading={sessionLoading}
                    busy={busy}
                    draft={draft}
                    setDraft={setDraft}
                    send={send}
                    error={error}
                    mode={mode}
                    agent={health.data?.agent}
                    navigate={navigate}
                    newTask={newSession}
                    selectSession={(id) => {
                      setSession(
                        sessions.find((item) => item.id === id) || null,
                      );
                      setDraft("");
                      setError("");
                    }}
                  />
                }
              />
            )}
            {view === "Overview" && <OverviewView resource={overview} />}
            {view === "Explorer" && <ExplorerView />}
            {view === "Investigations" && <InvestigationsView />}
            {view === "Changes" && <ChangesView mode={mode} />}
            {view === "Maintenance" && <MaintenanceView />}
            {view === "Settings" && <SettingsView theme={theme} />}
          </main>
        </div>
      </div>
    </Theme>
  );
}
const descriptions: Record<View, string> = {
  Workspace: "Describe a task, inspect the evidence, and review changes here.",
  Overview: "A clear view of the context available from your home.",
  Explorer: "Find entities and inspect their dependencies.",
  Investigations:
    "Start with the evidence: logs, repairs, and automation traces.",
  Changes: "Review proposed actions before they reach your home.",
  Maintenance: "Keep an eye on your home’s health.",
  Settings: "Appearance, capabilities, and installation details.",
};
function TaskWorkbench({
  session,
  sessions,
  sessionLoading,
  busy,
  draft,
  setDraft,
  send,
  error,
  mode,
  agent,
  navigate,
  newTask,
  selectSession,
}: {
  session: ChatSession | null;
  sessions: ChatSession[];
  sessionLoading: boolean;
  busy: boolean;
  draft: string;
  setDraft: (value: string) => void;
  send: (text: string) => Promise<void>;
  error: string;
  mode?: string;
  agent?: string;
  navigate: (view: View) => void;
  newTask: () => void;
  selectSession: (id: string) => void;
}) {
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session?.id, session?.messages.length, busy]);
  const hasMessages = Boolean(session?.messages.length);
  return (
    <section className="task-workbench" aria-labelledby="task-heading">
      <div className="task-heading">
        <h2 id="task-heading">What do you want to do?</h2>
        {sessions.length > 0 && (
          <div className="task-history">
            <label className="sr-only" htmlFor="recent-tasks">
              Recent tasks
            </label>
            <select
              id="recent-tasks"
              value={session?.id || ""}
              disabled={busy || sessionLoading}
              onChange={(event) => selectSession(event.target.value)}
            >
              <option value="">New task</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || "Untitled task"}
                </option>
              ))}
            </select>
            {hasMessages && (
              <Button
                label="New task"
                variant="ghost"
                size="sm"
                isDisabled={busy}
                onClick={newTask}
              />
            )}
          </div>
        )}
      </div>
      <p className="task-description muted">
        Tell Hasswright what to investigate, build, or change.
      </p>
      <ChatComposer
        className="task-composer"
        value={draft}
        onChange={setDraft}
        onSubmit={(text) => void send(text)}
        isDisabled={busy || sessionLoading}
        elevation="none"
        input={
          <textarea
            id="task-instructions"
            aria-label="Task instructions"
            className="task-input"
            rows={3}
            placeholder="Describe the problem or change you want…"
            value={draft}
            disabled={busy || sessionLoading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
        }
        footerActions={
          <span className="composer-context">
            {mode === "observe"
              ? "Observe mode: inspect and plan"
              : mode
                ? "Changes go through approval"
                : "Checking mode…"}
          </span>
        }
        sendButton={
          <Button
            label={
              busy ? "Working…" : hasMessages ? "Continue task" : "Start task"
            }
            variant="primary"
            isLoading={busy}
            isDisabled={busy || sessionLoading || !draft.trim()}
            onClick={() => void send(draft)}
          />
        }
      />
      <div className="task-starters">
        <span className="muted">Start with</span>
        <Button
          label="Investigate a problem"
          variant="ghost"
          size="sm"
          isDisabled={busy}
          onClick={() => {
            setDraft(
              "Help me investigate a problem in my Home Assistant installation. Start with the current context and identify the evidence we need.",
            );
            document.getElementById("task-instructions")?.focus();
          }}
        />
        <Button
          label="Plan an automation"
          variant="ghost"
          size="sm"
          isDisabled={busy}
          onClick={() => {
            setDraft(
              "Help me plan an automation using my existing Home Assistant entities. Ask me what it should do before drafting it.",
            );
            document.getElementById("task-instructions")?.focus();
          }}
        />
      </div>
      {agent === "mock" && (
        <p className="runtime-note muted">
          Example assistant is active.{" "}
          <button className="text-link" onClick={() => navigate("Settings")}>
            Connect an AI runtime
          </button>{" "}
          for AI tasks. The tools below work directly.
        </p>
      )}
      {agent === "codex" && (
        <p className="runtime-note muted">
          The Codex adapter is a placeholder.{" "}
          <button className="text-link" onClick={() => navigate("Settings")}>
            Connect OpenCode
          </button>{" "}
          for AI tasks.
        </p>
      )}
      {error && (
        <div className="notice task-error" role="alert">
          {error}
        </div>
      )}
      {(hasMessages || busy) && (
        <div className="task-output">
          <div className="task-output-heading">
            <h3>{session?.title || "Current task"}</h3>
            <span className="muted">
              {busy
                ? "Working…"
                : error
                  ? "Request failed"
                  : "Response received"}
            </span>
          </div>
          <div ref={transcript} className="task-transcript">
            <ChatMessageList align="top" isStreaming={busy}>
              {session?.messages.length || busy ? (
                <>
                  {session?.messages.map((message, index) => (
                    <ChatMessage
                      key={`${session.id}-${index}`}
                      sender={message.role === "tool" ? "system" : message.role}
                    >
                      <ChatMessageBubble
                        variant="ghost"
                        name={
                          message.role === "assistant"
                            ? "Hasswright"
                            : message.role === "user"
                              ? "You"
                              : undefined
                        }
                        metadata={
                          <ChatMessageMetadata
                            timestamp={new Date(message.ts).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          />
                        }
                      >
                        <div className="message-text">{message.content}</div>
                      </ChatMessageBubble>
                    </ChatMessage>
                  ))}
                  {busy && (
                    <p className="thinking" role="status">
                      Reading context and preparing a response…
                    </p>
                  )}
                </>
              ) : null}
            </ChatMessageList>
          </div>
        </div>
      )}
    </section>
  );
}
function WorkspaceView({
  resource,
  mode,
  navigate,
  ask,
  workbench,
}: {
  resource: ReturnType<typeof useResource<{ overview: Overview }>>;
  mode?: string;
  navigate: (view: View) => void;
  ask: (prompt: string) => void;
  workbench: ReactNode;
}) {
  const approvals = useResource<{ approvals: Approval[] }>("approvals");
  const [quickResult, setQuickResult] = useState<{
    title: string;
    tool: string;
    result: unknown;
  }>();
  const [quickError, setQuickError] = useState("");
  const [quickBusy, setQuickBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const inv = resource.data?.overview;
  const core = inv?.core as { location_name?: string; version?: string } | null;
  const pending = approvals.data?.approvals.filter(
    (item) => item.status === "pending" && item.expiresAt > Date.now(),
  );
  async function runCheck(tool: string, title: string) {
    if (quickBusy) return;
    setQuickBusy(tool);
    setQuickError("");
    setQuickResult(undefined);
    try {
      const { body } = await api<{ result: unknown }>("tools/exec", {
        tool,
        args: tool === "ha.get_log" ? { max_chars: 6000 } : {},
      });
      setQuickResult({ title, tool, result: body.result });
    } catch (error) {
      setQuickError((error as Error).message);
    } finally {
      setQuickBusy("");
    }
  }
  const validation =
    quickResult?.tool === "ha.check_config"
      ? (quickResult.result as { result?: string; errors?: unknown } | null)
      : undefined;
  return (
    <div className="work-area">
      <div className="work-main">
        {workbench}
        <section
          className="direct-tools"
          aria-labelledby="direct-tools-heading"
        >
          <h2 id="direct-tools-heading">Run a check or open a tool</h2>
          <div className="direct-tool-actions">
            <Button
              label="Check configuration"
              icon={<Icon name="Changes" />}
              isLoading={quickBusy === "ha.check_config"}
              isDisabled={Boolean(quickBusy)}
              clickAction={() =>
                runCheck("ha.check_config", "Configuration check")
              }
            />
            <Button
              label="Read error log"
              icon={<Icon name="Investigations" />}
              isLoading={quickBusy === "ha.get_log"}
              isDisabled={Boolean(quickBusy)}
              clickAction={() => runCheck("ha.get_log", "Error log")}
            />
            <Button
              label="Find an entity"
              icon={<Icon name="Explorer" />}
              onClick={() => navigate("Explorer")}
            />
            <Button
              label="Review changes"
              icon={<Icon name="Changes" />}
              onClick={() => navigate("Changes")}
            />
          </div>
          {quickError && (
            <div className="notice" role="alert">
              {quickError}
            </div>
          )}
          {quickResult && (
            <div className="check-result" role="status">
              <h3>{quickResult.title}</h3>
              {quickResult.tool === "ha.get_log" &&
              typeof quickResult.result === "string" ? (
                <pre className="json">
                  {quickResult.result || "No log text was returned."}
                </pre>
              ) : (
                <>
                  <p>
                    {validation?.result === "valid"
                      ? "Home Assistant reports that the configuration is valid."
                      : validation?.result === "invalid"
                        ? "Home Assistant found configuration errors. Review the details before making changes."
                        : "The configuration check could not be completed. Review the connection and details."}
                  </p>
                  <details>
                    <summary>Details</summary>
                    <Json value={quickResult.result} />
                  </details>
                </>
              )}
            </div>
          )}
        </section>
        <ResourceStatus resource={resource} />
        {inv?.warnings?.map((warning) => (
          <Notice key={warning}>{warning}</Notice>
        ))}
        <details className="workspace-details">
          <summary>Installation & updates</summary>
          <VersionPanel />
        </details>
      </div>
      <aside className="work-context" aria-label="Home context">
        <Panel
          title={core?.location_name || "Home context"}
          action={
            <Button
              label="Refresh home context"
              variant="ghost"
              size="sm"
              isLoading={resource.loading || refreshing}
              clickAction={async () => {
                setRefreshing(true);
                setRefreshError("");
                try {
                  resource.setData(
                    (await api<{ overview: Overview }>("overview?refresh=1"))
                      .body,
                  );
                } catch (error) {
                  setRefreshError((error as Error).message);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              Refresh
            </Button>
          }
        >
          {refreshError && <Notice>{refreshError}</Notice>}
          {inv?.demoFixture && <span className="chip">Demo data</span>}
          {core?.version && (
            <p className="muted">Home Assistant {core.version}</p>
          )}
          <dl className="context-counts">
            {[
              [
                "Entities",
                inv?.sources?.states === "unavailable"
                  ? undefined
                  : inv?.counts.entities,
              ],
              ["Devices", inv?.counts.devices],
              ["Areas", inv?.counts.areas],
            ].map(([label, count]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{count ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <Button
            label="Explore inventory"
            variant="ghost"
            onClick={() => navigate("Overview")}
          />
        </Panel>
        <Panel title="Needs attention">
          {!inv ? (
            <p className="muted">Loading home context…</p>
          ) : inv.sources?.states === "unavailable" ? (
            <p className="muted">Entity availability could not be checked.</p>
          ) : inv.unavailable.length ? (
            <div className="attention-list">
              {inv.unavailable.slice(0, 3).map((entity) => (
                <div className="attention-item" key={entity.entity_id}>
                  <code>{entity.entity_id}</code>
                  <div>
                    <small className="muted">{entity.state}</small>
                    <Button
                      label={`Investigate ${entity.entity_id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        ask(
                          `Investigate why ${entity.entity_id} is ${entity.state}. Use the available evidence and propose read-only checks.`,
                        )
                      }
                    >
                      Investigate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              No unavailable or unknown entities were returned.
            </p>
          )}
        </Panel>
        <Panel title="Changes">
          <ResourceStatus resource={approvals} />
          <p>
            {pending
              ? countLabel(pending.length, "request") + " awaiting review."
              : "Approval status unavailable."}
          </p>
          <Button
            label="Open change review"
            variant="ghost"
            onClick={() => navigate("Changes")}
          />
          {mode === "observe" && (
            <p className="context-note muted">
              Observe mode blocks saving and other mutations.
            </p>
          )}
        </Panel>
      </aside>
    </div>
  );
}
function VersionPanel({ compact = false }: { compact?: boolean }) {
  const version = useResource<{ version: VersionInfo }>("version");
  const info = version.data?.version;
  const update = info?.supervisor;
  return (
    <Panel
      title="Installation & updates"
      action={
        <Button
          label="Check update status"
          variant="ghost"
          clickAction={version.load}
        />
      }
    >
      <ResourceStatus resource={version} />
      {info && (
        <>
          <div className="setting-row">
            <strong>Hasswright {info.installed || "Unknown version"}</strong>
            <span className="chip">
              {update?.updateAvailable === true
                ? "Update available"
                : update?.updateAvailable === false
                  ? "Up to date"
                  : "Status unavailable"}
            </span>
          </div>
          {update?.latest && (
            <p className="muted">Latest in Supervisor: {update.latest}</p>
          )}
          {update?.installed && update.installed !== info.installed && (
            <Notice>
              Supervisor reports {update.installed}, but this process is running{" "}
              {info.installed}. Reopen the UI and check the add-on logs if the
              versions still differ.
            </Notice>
          )}
          <p className="muted">
            {update
              ? "Install updates from Home Assistant’s Hasswright app page."
              : "Supervisor update information is unavailable. Check the app page in Home Assistant."}
          </p>
          {!compact && (
            <>
              <p>
                Settings → Apps → Hasswright → Update. If no update is offered,
                reload the app store repository first.
              </p>
              <p className="muted">
                Persistent sessions and settings are stored in /data. Keep a
                backup before updating.
              </p>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

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
      {inv?.warnings?.map((warning) => (
        <Notice key={warning}>{warning}</Notice>
      ))}
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
  const connection = useResource<{ agent?: string }>("health");
  const tools = useResource<{ tools: ToolSchema[] }>("tools");
  const audit = useResource<{ audit: AuditEntry[] }>("audit");
  return (
    <>
      <Panel title="Assistant connection">
        <ResourceStatus resource={connection} />
        <p>
          {connection.data?.agent === "opencode"
            ? "OpenCode is selected as the AI runtime."
            : connection.data?.agent === "codex"
              ? "The Codex adapter is a placeholder in this release."
              : "The built-in example assistant is active. It does not run a real AI model."}
        </p>
        <p className="muted">
          To connect OpenCode, open Home Assistant Settings → Apps → Hasswright
          → Configuration and set opencode_base_url to your OpenCode server URL.
          Authenticate with your model provider in OpenCode, then restart the
          Hasswright app from its Home Assistant page.
        </p>
      </Panel>
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
      <VersionPanel />
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
