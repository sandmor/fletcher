import { mutation, query, action } from "./_generated/server"
import { v } from "convex/values"
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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

export const getFrontendUploadUrl = action({
  args: { filename: v.string(), contentType: v.string() },
  handler: async (ctx, args) => {
    const fileKey = `inputs/${Date.now()}-${args.filename}`
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
      ContentType: args.contentType,
    })

    const uploadUrl = await getSignedUrl(storageClient, command, {
      expiresIn: 600,
    })

    const downloadUrl = getPublicUrl(fileKey)

    return { uploadUrl, downloadUrl }
  },
})

export const createJob = mutation({
  args: { inputUrl: v.string(), fileName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      status: "pending",
      inputUrl: args.inputUrl,
      fileName: args.fileName,
    })
  },
})

export const triggerModalJob = action({
  args: { jobId: v.id("jobs"), inputUrl: v.string() },
  handler: async (ctx, args) => {
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

export const updateJob = mutation({
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

export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId)
  },
})

export const cleanupJobS3 = action({
  args: { inputUrl: v.optional(v.string()), outputUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Best-effort S3 cleanup — silently ignore failures
    if (args.inputUrl) {
      const inputKey = args.inputUrl.replace(
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
    if (args.outputUrl) {
      const outputKey = args.outputUrl.replace(
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
  },
})

export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const completed = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .take(50)
    const failed = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(50)

    const toDelete = [...completed, ...failed].slice(0, 100)
    for (const job of toDelete) {
      await ctx.db.delete(job._id)
    }
  },
})

export const getQueue = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(100)
  },
})

export const getJobById = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})
