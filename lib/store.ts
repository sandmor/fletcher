import { create } from "zustand"
import { toast } from "sonner"
import type { JobStatus, UploadStatus } from "./types"
import { getPresignedUrl, uploadToS3, deleteFromS3 } from "./s3"

export interface ImageJob {
  id: string
  fileName: string
  originalUrl: string
  remoteUrl?: string
  removedUrl?: string
  status: JobStatus
  uploadStatus: UploadStatus
  progress: number
  createdAt: number
  completedAt?: number
  error?: string
  s3Key?: string
}

interface StoreState {
  jobs: ImageJob[]
  addJobs: (files: File[]) => void
  removeJob: (id: string) => void
  clearCompleted: () => void
}

/* ------------------------------------------------------------------ */
/* Internal upload logic                                               */
/* ------------------------------------------------------------------ */

async function uploadImage(
  jobId: string,
  file: File,
  update: (fn: (prev: ImageJob[]) => ImageJob[]) => void
) {
  try {
    const { url, remoteUrl, key } = await getPresignedUrl(file.name, file.type)

    update((jobs) =>
      jobs.map((j) =>
        j.id === jobId ? { ...j, uploadStatus: "uploading" as UploadStatus } : j
      )
    )

    await uploadToS3(url, file)

    update((jobs) =>
      jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              remoteUrl,
              s3Key: key,
              uploadStatus: "uploaded" as UploadStatus,
              // prefer remote URL so previews load from S3 once available
              originalUrl: remoteUrl,
            }
          : j
      )
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed"
    update((jobs) =>
      jobs.map((j) =>
        j.id === jobId
          ? { ...j, uploadStatus: "error" as UploadStatus, error: msg }
          : j
      )
    )
    toast.error(`${file.name} upload failed`, { description: msg })
  }
}

/* ------------------------------------------------------------------ */
/* Background processing simulation                                      */
/* ------------------------------------------------------------------ */

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

async function simulateRemovedBackground(originalUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("No canvas context"))
        return
      }
      const size = 24
      for (let y = 0; y < canvas.height; y += size) {
        for (let x = 0; x < canvas.width; x += size) {
          const even = (x / size + y / size) % 2 === 0
          ctx.fillStyle = even ? "#e5e7eb" : "#f3f4f6"
          ctx.fillRect(x, y, size, size)
        }
      }
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const scale = Math.min(
        canvas.width / img.naturalWidth,
        canvas.height / img.naturalHeight
      )
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.filter = "grayscale(60%) contrast(110%)"
      ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h)
      ctx.filter = "none"
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = originalUrl
  })
}

/* ------------------------------------------------------------------ */
/* Store                                                                */
/* ------------------------------------------------------------------ */

export const useAppStore = create<StoreState>((set, get) => {
  let intervalId: ReturnType<typeof setInterval> | null = null

  function update(fn: (prev: ImageJob[]) => ImageJob[]) {
    set((s) => ({ jobs: fn(s.jobs) }))
  }

  function ensureEngine() {
    if (intervalId) return
    intervalId = setInterval(() => {
      const state = get()

      // pick the first queued job whose image is already uploaded
      const next = state.jobs.find(
        (j) => j.status === "queued" && j.uploadStatus === "uploaded"
      )
      if (!next) return

      set({
        jobs: state.jobs.map((j) =>
          j.id === next.id
            ? {
                ...j,
                status: "processing" as JobStatus,
                progress: j.progress + Math.random() * 15 + 5,
              }
            : j
        ),
      })

      const duration = 3000 + Math.random() * 5000
      const totalSteps = Math.max(3, Math.floor(duration / 600))
      let step = 0
      const ticker = setInterval(() => {
        step++
        set((s) => {
          const job = s.jobs.find((j) => j.id === next.id)
          if (!job) return s
          if (job.status === "error") {
            clearInterval(ticker)
            return s
          }
          const newProgress = Math.min(
            100,
            job.progress + (100 - job.progress) / (totalSteps - step + 1)
          )
          if (newProgress >= 100) {
            clearInterval(ticker)
            simulateRemovedBackground(job.originalUrl)
              .then((removedUrl) => {
                set((ss) => ({
                  jobs: ss.jobs.map((jj) =>
                    jj.id === next.id
                      ? {
                          ...jj,
                          status: "done" as JobStatus,
                          progress: 100,
                          removedUrl,
                          completedAt: Date.now(),
                        }
                      : jj
                  ),
                }))
                toast.success(`${job.fileName} is ready`, {
                  description: "Background removed",
                })
              })
              .catch(() => {
                set((ss) => ({
                  jobs: ss.jobs.map((jj) =>
                    jj.id === next.id
                      ? {
                          ...jj,
                          status: "error" as JobStatus,
                          error: "Processing failed",
                        }
                      : jj
                  ),
                }))
                toast.error(`${job.fileName} processing failed`)
              })
            return s
          }
          return {
            jobs: s.jobs.map((j) =>
              j.id === next.id ? { ...j, progress: newProgress } : j
            ),
          }
        })
      }, 600)
    }, 1200)
  }

  return {
    jobs: [],

    /** Add files — uploads start immediately; processing starts once uploaded. */
    addJobs: (files: File[]) => {
      const newJobs: ImageJob[] = files.map((file) => ({
        id: generateId(),
        fileName: file.name,
        originalUrl: URL.createObjectURL(file),
        status: "queued",
        uploadStatus: "idle",
        progress: 0,
        createdAt: Date.now(),
      }))

      set((s) => ({ jobs: [...s.jobs, ...newJobs] }))
      toast.info(
        `${newJobs.length} image${newJobs.length > 1 ? "s" : ""} added to queue`
      )

      // kick off uploads immediately (fire-and-forget)
      newJobs.forEach((job, i) => {
        const file = files[i]
        if (!file) return
        uploadImage(job.id, file, update).then(() => {
          // If the job is still queued and now uploaded, it will be picked up
          // on the next engine tick.
          ensureEngine()
        })
      })

      ensureEngine()
    },

    removeJob: (id) => {
      set((s) => {
        const target = s.jobs.find((j) => j.id === id)
        if (!target) return s

        // revoke local blob URLs
        if (target.originalUrl.startsWith("blob:"))
          URL.revokeObjectURL(target.originalUrl)
        if (target.removedUrl?.startsWith("blob:"))
          URL.revokeObjectURL(target.removedUrl)

        // attempt to clean up remote object (best-effort)
        if (target.s3Key) {
          deleteFromS3(target.s3Key).catch(() => {
            // silently ignore — the object will expire via lifecycle rules
          })
        }

        return { jobs: s.jobs.filter((j) => j.id !== id) }
      })
    },

    clearCompleted: () => {
      set((s) => {
        const completed = s.jobs.filter(
          (j) => j.status === "done" || j.status === "error"
        )
        completed.forEach((j) => {
          if (j.originalUrl?.startsWith("blob:"))
            URL.revokeObjectURL(j.originalUrl)
          if (j.removedUrl?.startsWith("blob:"))
            URL.revokeObjectURL(j.removedUrl)
          if (j.s3Key) {
            deleteFromS3(j.s3Key).catch(() => {
              // best-effort cleanup
            })
          }
        })
        return {
          jobs: s.jobs.filter(
            (j) => j.status !== "done" && j.status !== "error"
          ),
        }
      })
    },
  }
})
