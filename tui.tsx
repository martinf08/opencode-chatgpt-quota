import { Plugin } from "@opencode/plugin/tui"
import { OpenAILimitsRPC, type Snapshot } from "./rpc"

function countdown(resetAt: string): string {
  const remaining = Date.parse(resetAt) - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) return "reset"

  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}j ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function percentage(value: string): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : undefined
}

function progressBar(value: string): string {
  const percent = percentage(value)
  if (percent === undefined) return "Data unavailable"
  const filled = Math.round((percent / 100) * 20)
  return `${"█".repeat(filled)}${"░".repeat(20 - filled)} ${percent}%`
}

export default Plugin.define({
  id: "openai-limits.tui",
  async setup(context) {
    const api = context.client.rpc(OpenAILimitsRPC)
    const [snapshot, updateSnapshot] = context.storage.store("openai-limits", {
      initial: {
        state: "waiting",
        observedAt: "",
        plan: "",
        fiveHourRemaining: "",
        fiveHourReset: "",
        weeklyRemaining: "",
        weeklyReset: "",
        message: "",
      },
    })

    const apply = (next: Snapshot) =>
      updateSnapshot((current) => {
        if (next.observedAt >= current.observedAt) Object.assign(current, next)
      })

    const unsubscribe = api.events.on("updated", (event) => {
      void apply(event.data)
    })
    try {
      await apply(await api.latest({}))
    } catch {
      // The server plugin may still be loading when the TUI plugin starts.
    }

    const unregisterSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => (
        <box flexDirection="column">
          <text fg={context.theme.text.base}>ChatGPT quota{snapshot.plan ? ` · ${snapshot.plan}` : ""}</text>
          {snapshot.state === "available" ? (
            <box flexDirection="column">
              <text>5-hour window</text>
              <text fg={context.theme.text.base}>{progressBar(snapshot.fiveHourRemaining)}</text>
              <text fg={context.theme.text.base}>
                Resets in {snapshot.fiveHourReset ? countdown(snapshot.fiveHourReset) : "unavailable"}
              </text>
              <text>Weekly</text>
              <text fg={context.theme.text.base}>{progressBar(snapshot.weeklyRemaining)}</text>
              <text fg={context.theme.text.base}>
                Resets in {snapshot.weeklyReset ? countdown(snapshot.weeklyReset) : "unavailable"}
              </text>
            </box>
          ) : (
            <text>{snapshot.message || "Loading quota…"}</text>
          )}
        </box>
      ),
    })

    return () => {
      unsubscribe()
      unregisterSidebar()
    }
  },
})
