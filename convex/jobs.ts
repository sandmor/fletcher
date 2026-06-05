import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { v } from "convex/values"
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { internal } from "./_generated/api"
import { paginationOptsValidator } from "convex/server"

const storageClient = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle:
    process.env.S3_FORCE_PATH_STYLE === "true" || !!process.env.S3_ENDPOINT,
})

function getPublicUrl(fileKey: string): string {
  const base = (process.env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "")
  return `${base}/${fileKey}`
}

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

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: outputKey,
      ContentType: "image/png",
    })

    const modalUploadUrl = await getSignedUrl(storageClient, command, {
      expiresIn: 900,
    })

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

export const deleteJobRecord = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId)
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

    if (job.inputUrl) {
      const inputKey = job.inputUrl.replace(
        process.env.S3_PUBLIC_URL_BASE + "/",
        ""
      )
      try {
        await storageClient.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: inputKey,
          })
        )
      } catch {
        /* ignore */
      }
    }

    if (job.outputUrl) {
      const outputKey = job.outputUrl.replace(
        process.env.S3_PUBLIC_URL_BASE + "/",
        ""
      )
      try {
        await storageClient.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: outputKey,
          })
        )
      } catch {
        /* ignore */
      }
    }

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

    const keysToDelete: string[] = []
    for (const job of jobsToDelete) {
      if (job.inputUrl)
        keysToDelete.push(
          job.inputUrl.replace(process.env.S3_PUBLIC_URL_BASE + "/", "")
        )
      if (job.outputUrl)
        keysToDelete.push(
          job.outputUrl.replace(process.env.S3_PUBLIC_URL_BASE + "/", "")
        )
    }

    await Promise.allSettled(
      keysToDelete.map((key) =>
        storageClient.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key,
          })
        )
      )
    )

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
  v.null()
)

export const updateJobBackground = mutation({
  args: {
    jobId: v.id("jobs"),
    background: backgroundValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== identity.subject) {
      throw new Error("Not found")
    }

    if (args.background === null) {
      await ctx.db.patch(args.jobId, { background: undefined })
      return
    }

    await ctx.db.patch(args.jobId, { background: args.background })
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
