import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  jobs: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    inputUrl: v.string(),
    outputUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    fileName: v.string(),
  }).index("by_status", ["status"]),
})
