"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import {
  Cable,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useSettingsStore,
  type McpServerConfig,
  type McpTransportType,
} from "@/store/settings-store";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface ServerFormState {
  name: string;
  url: string;
  transportType: McpTransportType;
  headerKey: string;
  headerValue: string;
  headers: Record<string, string>;
}

const EMPTY_FORM: ServerFormState = {
  name: "",
  url: "",
  transportType: "http",
  headerKey: "",
  headerValue: "",
  headers: {},
};

function ServerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: McpServerConfig;
  onSave: (data: Omit<McpServerConfig, "id" | "enabled">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ServerFormState>(
    initial
      ? {
          name: initial.name,
          url: initial.url,
          transportType: initial.transportType,
          headerKey: "",
          headerValue: "",
          headers: { ...initial.headers },
        }
      : { ...EMPTY_FORM }
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canSave = form.name.trim() && form.url.trim();

  function addHeader() {
    if (!form.headerKey.trim()) return;
    setForm((f) => ({
      ...f,
      headers: { ...f.headers, [f.headerKey.trim()]: f.headerValue },
      headerKey: "",
      headerValue: "",
    }));
  }

  function removeHeader(key: string) {
    setForm((f) => {
      const next = { ...f.headers };
      delete next[key];
      return { ...f, headers: next };
    });
  }

  async function testConnection() {
    setConnectionStatus("testing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url,
          transportType: form.transportType,
          headers: form.headers,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
        setErrorMsg(data.error ?? "Connection failed");
      }
    } catch (err) {
      setConnectionStatus("error");
      setErrorMsg(String(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
          Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="My MCP Server"
          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-2 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
          URL
        </label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://mcp-server.example.com/mcp"
          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-2 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
          Transport
        </label>
        <div className="flex gap-2">
          {(["http", "sse"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, transportType: t }))}
              className={cn(
                "px-3 py-1.5 text-xs uppercase tracking-wider border transition-colors",
                form.transportType === t
                  ? "border-zinc-500 bg-zinc-800 text-zinc-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
          Headers
        </label>
        {Object.entries(form.headers).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400 font-mono">{key}:</span>
            <span className="text-zinc-500 font-mono truncate flex-1">
              {key.toLowerCase().includes("auth") ||
              key.toLowerCase().includes("key") ||
              key.toLowerCase().includes("secret") ||
              key.toLowerCase().includes("token")
                ? "••••••••"
                : value}
            </span>
            <button
              type="button"
              onClick={() => removeHeader(key)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={form.headerKey}
            onChange={(e) =>
              setForm((f) => ({ ...f, headerKey: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addHeader()}
            placeholder="Header name"
            className="flex-1 bg-zinc-950 border border-zinc-800 text-xs px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <input
            type="text"
            value={form.headerValue}
            onChange={(e) =>
              setForm((f) => ({ ...f, headerValue: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addHeader()}
            placeholder="Value"
            className="flex-1 bg-zinc-950 border border-zinc-800 text-xs px-2 py-1.5 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={addHeader}
            disabled={!form.headerKey.trim()}
            className="px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={testConnection}
          disabled={!form.url.trim() || connectionStatus === "testing"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
        >
          {connectionStatus === "testing" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : connectionStatus === "success" ? (
            <CheckCircle2 className="size-3 text-emerald-400" />
          ) : connectionStatus === "error" ? (
            <XCircle className="size-3 text-red-400" />
          ) : (
            <Circle className="size-3" />
          )}
          Test connection
        </button>
        {connectionStatus === "error" && errorMsg && (
          <span className="text-[10px] text-red-400 truncate flex-1">
            {errorMsg}
          </span>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            onSave({
              name: form.name.trim(),
              url: form.url.trim(),
              transportType: form.transportType,
              headers: form.headers,
            })
          }
          className="px-3 py-1.5 text-xs bg-zinc-100 text-zinc-900 hover:bg-white transition-colors disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ServerRow({
  server,
  onEdit,
}: {
  server: McpServerConfig;
  onEdit: (id: string) => void;
}) {
  const toggleMcpServer = useSettingsStore((s) => s.toggleMcpServer);
  const removeMcpServer = useSettingsStore((s) => s.removeMcpServer);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 border border-zinc-800 transition-colors",
        server.enabled ? "bg-zinc-900/50" : "bg-zinc-950/50 opacity-60"
      )}
    >
      <Switch
        checked={server.enabled}
        onCheckedChange={() => toggleMcpServer(server.id)}
      />
      <button
        type="button"
        onClick={() => onEdit(server.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-xs text-zinc-200 truncate">{server.name}</div>
        <div className="text-[10px] text-zinc-500 truncate font-mono">
          {server.url}
        </div>
      </button>
      <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0">
        {server.transportType}
      </span>
      <button
        type="button"
        onClick={() => removeMcpServer(server.id)}
        className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function McpConfigDialog() {
  const mcpServers = useSettingsStore((s) => s.mcpServers);
  const addMcpServer = useSettingsStore((s) => s.addMcpServer);
  const updateMcpServer = useSettingsStore((s) => s.updateMcpServer);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const editingServer = editingId
    ? mcpServers.find((s) => s.id === editingId)
    : null;

  const enabledCount = mcpServers.filter((s) => s.enabled).length;

  function handleSaveNew(data: Omit<McpServerConfig, "id" | "enabled">) {
    addMcpServer({ ...data, id: nanoid(), enabled: true });
    setView("list");
  }

  function handleSaveEdit(data: Omit<McpServerConfig, "id" | "enabled">) {
    if (editingId) {
      updateMcpServer(editingId, data);
    }
    setEditingId(null);
    setView("list");
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setView("edit");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("list");
      setEditingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-zinc-500 hover:text-zinc-300 uppercase tracking-wider !text-xs"
          />
        }
      >
        <Cable className="size-3.5" />
        MCP
        {enabledCount > 0 && (
          <span className="flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] bg-zinc-700 text-zinc-200">
            {enabledCount}
          </span>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md bg-zinc-900 border-zinc-700 text-zinc-100 !rounded-none"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-zinc-200">
            <Cable className="size-4" />
            MCP Servers
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-3">
            {mcpServers.length > 0 && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  {mcpServers.length} server{mcpServers.length !== 1 && "s"}{" "}
                  configured
                </button>
                {expanded && (
                  <div className="space-y-1.5">
                    {mcpServers.map((server) => (
                      <ServerRow
                        key={server.id}
                        server={server}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {mcpServers.length === 0 && (
              <div className="py-6 text-center">
                <Cable className="size-8 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs text-zinc-500 mb-1">
                  No MCP servers configured
                </p>
                <p className="text-[10px] text-zinc-600">
                  Connect external tools and data sources to your agents via the
                  Model Context Protocol.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setView("add")}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-xs border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              <Plus className="size-3.5" />
              Add MCP server
            </button>
          </div>
        )}

        {view === "add" && (
          <ServerForm
            onSave={handleSaveNew}
            onCancel={() => setView("list")}
          />
        )}

        {view === "edit" && editingServer && (
          <ServerForm
            initial={editingServer}
            onSave={handleSaveEdit}
            onCancel={() => {
              setEditingId(null);
              setView("list");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
