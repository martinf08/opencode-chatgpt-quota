import { Rpc } from "@opencode/plugin"

export type Snapshot = {
  state: string
  observedAt: string
  plan: string
  fiveHourRemaining: string
  fiveHourReset: string
  weeklyRemaining: string
  weeklyReset: string
  message: string
}

export const EMPTY_SNAPSHOT: Snapshot = {
  state: "waiting",
  observedAt: "",
  plan: "",
  fiveHourRemaining: "",
  fiveHourReset: "",
  weeklyRemaining: "",
  weeklyReset: "",
  message: "",
}

const snapshotSchema = {
  type: "object",
  properties: {
    state: { type: "string" },
    observedAt: { type: "string" },
    plan: { type: "string" },
    fiveHourRemaining: { type: "string" },
    fiveHourReset: { type: "string" },
    weeklyRemaining: { type: "string" },
    weeklyReset: { type: "string" },
    message: { type: "string" },
  },
  required: [
    "state",
    "observedAt",
    "plan",
    "fiveHourRemaining",
    "fiveHourReset",
    "weeklyRemaining",
    "weeklyReset",
    "message",
  ],
  additionalProperties: false,
} as const

export const OpenAILimitsRPC = Rpc.define({
  id: "openai-limits",
  methods: {
    latest: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: snapshotSchema,
    },
  },
  events: {
    updated: { schema: snapshotSchema },
  },
})
