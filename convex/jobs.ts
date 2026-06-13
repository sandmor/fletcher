import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { paginationOptsValidator } from "convex/server"
import {
  buildBackgroundKey,
  buildCompositeKey,
  createPresignedPutUrl,
  deleteS3Object,
  deleteS3ObjectByUrl,
  getJobS3Keys,
  getPublicUrl,
  isExpectedCompositeUrl,
} from "./s3"

export const createJob = mutation({
  args: { inputUrl: v.string(), fileName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const clerkUserId = identity.subject

    return await ctx.db.insert("jobs", {
      userId: clerkUserId,
      status: "pending",
      inputUrl: args.inputUrl,
      fileName: args.fileName,
      queueDismissed: false,
    })
  },
})

export const triggerModalJob = action({
  args: {
    jobId: v.id("jobs"),
    inputUrl: v.string(),
    alphaMatting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const outputKey = `outputs/${args.jobId}.png`
    const modalUploadUrl = await createPresignedPutUrl(
      outputKey,
      "image/png",
      900
    )
    const finalDownloadUrl = getPublicUrl(outputKey)
    const callbackUrl = `${process.env.CONVEX_SITE_URL}/updateJobStatus`

    const modalUrl = process.env.MODAL_ENDPOINT_URL!
    const response = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: args.jobId,
        inputUrl: args.inputUrl,
        uploadUrl: modalUploadUrl,
        downloadUrl: finalDownloadUrl,
        callbackUrl: callbackUrl,
        callbackSecret: process.env.MODAL_CALLBACK_SECRET,
        alphaMatting: args.alphaMatting === true,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error")
      throw new Error(`Modal returned ${response.status}: ${body}`)
    }
  },
})

export const updateJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    outputUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args
    await ctx.db.patch(jobId, updates)
  },
})

export const getJobForDeletion = internalQuery({
  args: { jobId: v.id("jobs"), clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== args.clerkUserId) {
      throw new Error("Not found")
    }
    return job
  },
})

export const getJobsForDeletionBatch = internalQuery({
  args: { jobIds: v.array(v.id("jobs")), clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const jobs = []
    for (const jobId of args.jobIds) {
      const job = await ctx.db.get(jobId)
      if (!job || job.userId !== args.clerkUserId) {
        throw new Error("Not found")
      }
      jobs.push(job)
    }
    return jobs
  },
})

export const getJobForBackgroundUpdate = internalQuery({
  args: { jobId: v.id("jobs"), clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== args.clerkUserId) {
      throw new Error("Not found")
    }
    return job
  },
})

export const deleteJobRecord = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId)
  },
})

const layerRectValidator = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
})

const compositionLayoutValidator = v.union(
  v.object({
    width: v.number(),
    height: v.number(),
    foreground: layerRectValidator,
    background: v.optional(layerRectValidator),
  }),
  v.null()
)

const backgroundConfigValidator = v.union(
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

const backgroundValidator = v.union(backgroundConfigValidator, v.null())

export const patchJobBackground = internalMutation({
  args: {
    jobId: v.id("jobs"),
    background: backgroundValidator,
    clearCompositionLayout: v.optional(v.boolean()),
    compositionLayout: v.optional(compositionLayoutValidator),
    compositeUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    if (args.background === null) {
      await ctx.db.patch(args.jobId, {
        background: undefined,
        compositionLayout: undefined,
        compositeUrl: undefined,
        compositeUpdatedAt: undefined,
      })
      return
    }

    const job = await ctx.db.get(args.jobId)

    const patch: {
      background: typeof args.background
      compositionLayout?: {
        width: number
        height: number
        foreground: { x: number; y: number; width: number; height: number }
        background?: { x: number; y: number; width: number; height: number }
      }
      compositeUrl?: string
      compositeUpdatedAt?: number
    } = { background: args.background }

    if (args.clearCompositionLayout) {
      patch.compositionLayout = undefined
    } else if (args.compositionLayout !== undefined && args.compositionLayout !== null) {
      patch.compositionLayout = args.compositionLayout
    } else if (args.compositionLayout === null) {
      patch.compositionLayout = undefined
    } else if (job?.compositionLayout && args.background.type === "solid") {
      const { background: _backgroundLayer, ...rest } = job.compositionLayout
      if (job.compositionLayout.background !== undefined) {
        patch.compositionLayout = rest
      }
    }

    if (args.compositeUrl) {
      patch.compositeUrl = args.compositeUrl
      patch.compositeUpdatedAt = Date.now()
    }

    await ctx.db.patch(args.jobId, patch)
  },
})

export const patchJobCompositionLayout = internalMutation({
  args: {
    jobId: v.id("jobs"),
    compositionLayout: compositionLayoutValidator,
    compositeUrl: v.string(),
    background: backgroundConfigValidator,
  },
  handler: async (ctx, args) => {
    if (args.compositionLayout === null) {
      await ctx.db.patch(args.jobId, {
        background: args.background,
        compositionLayout: undefined,
        compositeUrl: args.compositeUrl,
        compositeUpdatedAt: Date.now(),
      })
      return
    }

    await ctx.db.patch(args.jobId, {
      background: args.background,
      compositionLayout: args.compositionLayout,
      compositeUrl: args.compositeUrl,
      compositeUpdatedAt: Date.now(),
    })
  },
})

export const deleteJobAndFiles = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const job = await ctx.runQuery(internal.jobs.getJobForDeletion, {
      jobId: args.jobId,
      clerkUserId: identity.subject,
    })

    await Promise.allSettled(
      getJobS3Keys(job).map((key) => deleteS3Object(key))
    )

    await ctx.runMutation(internal.jobs.deleteJobRecord, { jobId: args.jobId })
  },
})

export const deleteJobsAndFiles = action({
  args: { jobIds: v.array(v.id("jobs")) },
  handler: async (ctx, args) => {
    if (args.jobIds.length === 0) return

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const jobs = await ctx.runQuery(internal.jobs.getJobsForDeletionBatch, {
      jobIds: args.jobIds,
      clerkUserId: identity.subject,
    })

    const keysToDelete = jobs.flatMap((job) => getJobS3Keys(job))

    await Promise.allSettled(keysToDelete.map((key) => deleteS3Object(key)))

    await ctx.runMutation(internal.jobs.deleteJobRecordsBatch, {
      jobIds: jobs.map((j) => j._id),
    })
  },
})

export const deleteJobRecordsBatch = internalMutation({
  args: { jobIds: v.array(v.id("jobs")) },
  handler: async (ctx, args) => {
    for (const id of args.jobIds) {
      await ctx.db.delete(id)
    }
  },
})

export const getResults = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    return await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const getActiveQueue = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    return await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing"),
          q.and(
            q.or(
              q.eq(q.field("status"), "completed"),
              q.eq(q.field("status"), "failed")
            ),
            q.neq(q.field("queueDismissed"), true)
          )
        )
      )
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const dismissFromQueue = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== identity.subject) {
      throw new Error("Not found")
    }

    if (job.status !== "completed" && job.status !== "failed") {
      throw new Error("Only finished jobs can be dismissed from the queue")
    }

    await ctx.db.patch(args.jobId, { queueDismissed: true })
  },
})

export const dismissFinishedFromQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const completed = await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "completed")
      )
      .filter((q) => q.neq(q.field("queueDismissed"), true))
      .take(50)

    const failed = await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "failed")
      )
      .filter((q) => q.neq(q.field("queueDismissed"), true))
      .take(50)

    for (const job of [...completed, ...failed].slice(0, 100)) {
      await ctx.db.patch(job._id, { queueDismissed: true })
    }
  },
})

export const getBackgroundUploadUrl = action({
  args: {
    jobId: v.id("jobs"),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    await ctx.runQuery(internal.jobs.getJobForBackgroundUpdate, {
      jobId: args.jobId,
      clerkUserId: identity.subject,
    })

    const key = buildBackgroundKey(args.jobId, args.fileName)
    const uploadUrl = await createPresignedPutUrl(key, args.contentType)

    return {
      uploadUrl,
      imageUrl: getPublicUrl(key),
      key,
    }
  },
})

export const getCompositeUploadUrl = action({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    await ctx.runQuery(internal.jobs.getJobForBackgroundUpdate, {
      jobId: args.jobId,
      clerkUserId: identity.subject,
    })

    const key = buildCompositeKey(args.jobId)
    const uploadUrl = await createPresignedPutUrl(key, "image/png")

    return {
      uploadUrl,
      compositeUrl: getPublicUrl(key),
      key,
    }
  },
})

export const updateJobBackground = action({
  args: {
    jobId: v.id("jobs"),
    background: backgroundValidator,
    compositeUrl: v.optional(v.string()),
    compositionLayout: v.optional(compositionLayoutValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const job = await ctx.runQuery(internal.jobs.getJobForBackgroundUpdate, {
      jobId: args.jobId,
      clerkUserId: identity.subject,
    })

    const newImageUrl =
      args.background?.type === "image" ? args.background.imageUrl : null

    if (job.background?.type === "image") {
      const oldImageUrl = job.background.imageUrl
      if (!newImageUrl || oldImageUrl !== newImageUrl) {
        await deleteS3ObjectByUrl(oldImageUrl)
      }
    }

    if (args.background === null && job.compositeUrl) {
      await deleteS3ObjectByUrl(job.compositeUrl)
    }

    if (args.background !== null) {
      if (!args.compositeUrl) {
        throw new Error("compositeUrl is required when setting a background")
      }
      if (!isExpectedCompositeUrl(args.jobId, args.compositeUrl)) {
        throw new Error("Invalid compositeUrl")
      }
    }

    const clearCompositionLayout =
      args.background === null ||
      (job.background?.type === "image" &&
        args.background?.type === "image" &&
        job.background.imageUrl !== args.background.imageUrl)

    await ctx.runMutation(internal.jobs.patchJobBackground, {
      jobId: args.jobId,
      background: args.background,
      clearCompositionLayout,
      compositionLayout: args.compositionLayout,
      compositeUrl: args.background === null ? null : args.compositeUrl,
    })
  },
})

export const saveCompositionLayout = action({
  args: {
    jobId: v.id("jobs"),
    compositionLayout: compositionLayoutValidator,
    compositeUrl: v.string(),
    background: backgroundConfigValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const job = await ctx.runQuery(internal.jobs.getJobForBackgroundUpdate, {
      jobId: args.jobId,
      clerkUserId: identity.subject,
    })

    if (!job.background && !args.background) {
      throw new Error("Cannot save composition without a background")
    }

    if (!isExpectedCompositeUrl(args.jobId, args.compositeUrl)) {
      throw new Error("Invalid compositeUrl")
    }

    await ctx.runMutation(internal.jobs.patchJobCompositionLayout, {
      jobId: args.jobId,
      compositionLayout: args.compositionLayout,
      compositeUrl: args.compositeUrl,
      background: args.background,
    })
  },
})

export const getJobById = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const clerkUserId = identity.subject

    const job = await ctx.db.get(args.id)
    if (!job || job.userId !== clerkUserId) {
      return null
    }
    return job
  },
})
