import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  jobs: defineTable({
    userId: v.string(),
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
    background: v.optional(
      v.union(
        v.object({
          type: v.literal("solid"),
          color: v.string(),
        }),
        v.object({
          type: v.literal("image"),
          imageUrl: v.string(),
          fileName: v.optional(v.string()),
        })
      )
    ),
    compositionLayout: v.optional(
      v.object({
        width: v.number(),
        height: v.number(),
        foreground: v.object({
          x: v.number(),
          y: v.number(),
          width: v.number(),
          height: v.number(),
        }),
        background: v.optional(
          v.object({
            x: v.number(),
            y: v.number(),
            width: v.number(),
            height: v.number(),
          })
        ),
      })
    ),
    queueDismissed: v.boolean(),
  }).index("by_user_and_status", ["userId", "status"]),
})
