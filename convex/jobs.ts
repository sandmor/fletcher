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
  createPresignedPutUrl,
  deleteS3Object,
  deleteS3ObjectByUrl,
  getJobS3Keys,
  getPublicUrl,
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
    })
  },
})

export const triggerModalJob = action({
  args: { jobId: v.id("jobs"), inputUrl: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const outputKey = `outputs/${args.jobId}.png`
    const modalUploadUrl = await createPresignedPutUrl(outputKey, "image/png", 900)
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

export const patchJobBackground = internalMutation({
  args: {
    jobId: v.id("jobs"),
    background: v.union(
      v.object({
        type: v.literal("solid"),
        color: v.string(),
      }),
      v.object({
        type: v.literal("image"),
        imageUrl: v.string(),
        fileName: v.optional(v.string()),
      }),
      v.null()
    ),
    clearCompositionLayout: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.background === null) {
      await ctx.db.patch(args.jobId, {
        background: undefined,
        compositionLayout: undefined,
      })
      return
    }

    const patch: {
      background: typeof args.background
      compositionLayout?: undefined
    } = { background: args.background }

    if (args.clearCompositionLayout) {
      patch.compositionLayout = undefined
    }

    await ctx.db.patch(args.jobId, patch)
  },
})

export const patchJobCompositionLayout = internalMutation({
  args: {
    jobId: v.id("jobs"),
    compositionLayout: compositionLayoutValidator,
  },
  handler: async (ctx, args) => {
    if (args.compositionLayout === null) {
      await ctx.db.patch(args.jobId, { compositionLayout: undefined })
      return
    }

    await ctx.db.patch(args.jobId, {
      compositionLayout: args.compositionLayout,
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

export const getOldJobsForDeletion = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const completed = await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.clerkUserId).eq("status", "completed")
      )
      .take(50)

    const failed = await ctx.db
      .query("jobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.clerkUserId).eq("status", "failed")
      )
      .take(50)

    return [...completed, ...failed].slice(0, 100)
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

export const clearCompletedWithFiles = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const jobsToDelete = await ctx.runQuery(
      internal.jobs.getOldJobsForDeletion,
      {
        clerkUserId: identity.subject,
      }
    )

    if (jobsToDelete.length === 0) return

    const keysToDelete = jobsToDelete.flatMap((job) => getJobS3Keys(job))

    await Promise.allSettled(keysToDelete.map((key) => deleteS3Object(key)))

    await ctx.runMutation(internal.jobs.deleteJobRecordsBatch, {
      jobIds: jobsToDelete.map((j) => j._id),
    })
  },
})

export const getQueue = query({
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

const backgroundValidator = v.union(
  v.object({
    type: v.literal("solid"),
    color: v.string(),
  }),
  v.object({
    type: v.literal("image"),
    imageUrl: v.string(),
    fileName: v.optional(v.string()),
  }),
  v.null()
)

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

export const updateJobBackground = action({
  args: {
    jobId: v.id("jobs"),
    background: backgroundValidator,
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

    const clearCompositionLayout =
      args.background === null ||
      (job.background?.type === "image" &&
        args.background?.type === "image" &&
        job.background.imageUrl !== args.background.imageUrl) ||
      (job.background?.type !== args.background?.type &&
        args.background !== null)

    await ctx.runMutation(internal.jobs.patchJobBackground, {
      jobId: args.jobId,
      background: args.background,
      clearCompositionLayout,
    })
  },
})

export const updateJobCompositionLayout = action({
  args: {
    jobId: v.id("jobs"),
    compositionLayout: compositionLayoutValidator,
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

    await ctx.runMutation(internal.jobs.patchJobCompositionLayout, {
      jobId: args.jobId,
      compositionLayout: args.compositionLayout,
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
      throw new Error("Not found")
    }
    return job
  },
})
