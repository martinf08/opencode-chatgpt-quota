import { Plugin } from "@opencode/plugin"
import { EMPTY_SNAPSHOT, OpenAILimitsRPC, type Snapshot } from "./rpc"

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"
const CODEX_LOGIN_METHOD = "chatgpt-token-sharing"
const FIVE_HOURS_SECONDS = 5 * 60 * 60
const WEEK_SECONDS = 7 * 24 * 60 * 60

type UsageWindow = {
  limit_window_seconds?: unknown
  used_percent?: unknown
  reset_at?: unknown
  reset_after_seconds?: unknown
}

type UsagePayload = {
  plan_type?: unknown
  rate_limit?: {
    primary_window?: UsageWindow
    secondary_window?: UsageWindow
  } | null
}

function accountID(token: string): string | undefined {
  try {
    const payload = token.split(".")[1]
    if (!payload) return undefined
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown }
    }
    const id = decoded["https://api.openai.com/auth"]?.chatgpt_account_id
    return typeof id === "string" ? id : undefined
  } catch {
    return undefined
  }
}

function windowData(windows: UsageWindow[], duration: number): { remaining: string; reset: string } {
  const value = windows.find((window) => window.limit_window_seconds === duration)
  if (!value || typeof value.used_percent !== "number" || !Number.isFinite(value.used_percent)) {
    return { remaining: "", reset: "" }
  }

  const remaining = Math.max(0, Math.min(100, 100 - value.used_percent))
  let resetAt = ""
  if (typeof value.reset_at === "number" && Number.isFinite(value.reset_at) && value.reset_at > 0) {
    resetAt = new Date(value.reset_at * 1000).toISOString()
  } else if (
    typeof value.reset_after_seconds === "number" &&
    Number.isFinite(value.reset_after_seconds) &&
    value.reset_after_seconds > 0
  ) {
    resetAt = new Date(Date.now() + value.reset_after_seconds * 1000).toISOString()
  }

  return { remaining: String(Math.round(remaining)), reset: resetAt }
}

export default Plugin.define({
  id: "openai-limits.server",
  async setup(ctx) {
    let latest = ((await ctx.storage.get("latest")) as Snapshot | undefined) ?? EMPTY_SNAPSHOT
    const rpc = await ctx.rpc.register(OpenAILimitsRPC, {
      latest: async () => latest,
    })

    let refreshing = false
    const publish = async (snapshot: Snapshot) => {
      latest = snapshot
      try {
        await ctx.storage.set("latest", snapshot)
        await rpc.events.emit("updated", snapshot)
      } catch (error) {
        console.warn("OpenAI quota monitor could not publish its snapshot", error)
      }
    }

    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const connection = await ctx.integration.connection.active("openai")
        if (!connection) {
          await publish({ ...EMPTY_SNAPSHOT, state: "needs-login", observedAt: new Date().toISOString(), message: "Connect OpenAI with /connect" })
          return
        }

        const credential = await ctx.integration.connection.resolve(connection)
        if (!credential || credential.type !== "oauth") {
          await publish({ ...EMPTY_SNAPSHOT, state: "needs-login", observedAt: new Date().toISOString(), message: "An OAuth Codex login is required" })
          return
        }

        if (credential.methodID === CODEX_LOGIN_METHOD) {
          await publish({
            ...EMPTY_SNAPSHOT,
            state: "needs-codex-login",
            observedAt: new Date().toISOString(),
            message: "The current login cannot access subscription usage; choose Codex browser/device code (legacy)",
          })
          return
        }

        const headers = new Headers({
          Authorization: `Bearer ${credential.access}`,
          Accept: "application/json",
        })
        const id = accountID(credential.access)
        if (id) headers.set("ChatGPT-Account-Id", id)

        const response = await fetch(USAGE_URL, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(12_000),
        })
        if (!response.ok) {
          await publish({
            ...EMPTY_SNAPSHOT,
            state: response.status === 401 || response.status === 403 ? "needs-codex-login" : "error",
            observedAt: new Date().toISOString(),
            message:
              response.status === 401 || response.status === 403
                ? "OpenAI rejected this login; sign in with Codex browser/device code (legacy)"
                : `ChatGPT usage is unavailable (HTTP ${response.status})`,
          })
          return
        }

        const payload = (await response.json()) as UsagePayload
        const windows = [payload.rate_limit?.primary_window, payload.rate_limit?.secondary_window].filter(
          (window): window is UsageWindow => Boolean(window),
        )
        const fiveHour = windowData(windows, FIVE_HOURS_SECONDS)
        const weekly = windowData(windows, WEEK_SECONDS)
        if (!fiveHour.remaining && !weekly.remaining) {
          await publish({
            ...EMPTY_SNAPSHOT,
            state: "unavailable",
            observedAt: new Date().toISOString(),
            message: "The response did not include a 5-hour or weekly usage window",
          })
          return
        }

        await publish({
          ...EMPTY_SNAPSHOT,
          state: "available",
          observedAt: new Date().toISOString(),
          plan: typeof payload.plan_type === "string" ? payload.plan_type : "",
          fiveHourRemaining: fiveHour.remaining,
          fiveHourReset: fiveHour.reset,
          weeklyRemaining: weekly.remaining,
          weeklyReset: weekly.reset,
          message: "",
        })
      } catch {
        await publish({
          ...EMPTY_SNAPSHOT,
          state: "error",
          observedAt: new Date().toISOString(),
          message: "Unable to read the ChatGPT quota right now",
        })
      } finally {
        refreshing = false
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), 60_000)
    return async () => {
      clearInterval(timer)
      await rpc.dispose()
    }
  },
})
