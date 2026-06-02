import { create } from "zustand"
import { toast } from "sonner"
import type { JobStatus } from "./types"

export interface ImageJob {
  id: string
  fileName: string
  originalUrl: string
  removedUrl?: string
  status: JobStatus
  progress: number
  createdAt: number
  completedAt?: number
  error?: string
}

interface StoreState {
  jobs: ImageJob[]
  addJobs: (files: File[]) => void
  removeJob: (id: string) => void
  clearCompleted: () => void
}

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
      // draw checkered transparent background
      const size = 24
      for (let y = 0; y < canvas.height; y += size) {
        for (let x = 0; x < canvas.width; x += size) {
          const even = (x / size + y / size) % 2 === 0
          ctx.fillStyle = even ? "#e5e7eb" : "#f3f4f6"
          ctx.fillRect(x, y, size, size)
        }
      }
      // draw original image with slight desaturation to hint "removed bg"
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

export const useAppStore = create<StoreState>((set, get) => {
  let intervalId: ReturnType<typeof setInterval> | null = null

  function ensureEngine() {
    if (intervalId) return
    intervalId = setInterval(() => {
      const state = get()
      // find first queued
      const next = state.jobs.find((j) => j.status === "queued")
      if (!next) return

      // mark as processing
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
    addJobs: (files) => {
      const newJobs: ImageJob[] = files.map((file) => ({
        id: generateId(),
        fileName: file.name,
        originalUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
        createdAt: Date.now(),
      }))
      set((s) => ({ jobs: [...s.jobs, ...newJobs] }))
      toast.info(
        `${newJobs.length} image${newJobs.length > 1 ? "s" : ""} added to queue`
      )
      ensureEngine()
    },
    removeJob: (id) => {
      set((s) => {
        const target = s.jobs.find((j) => j.id === id)
        if (target?.originalUrl) URL.revokeObjectURL(target.originalUrl)
        if (target?.removedUrl) URL.revokeObjectURL(target.removedUrl)
        return { jobs: s.jobs.filter((j) => j.id !== id) }
      })
    },
    clearCompleted: () => {
      set((s) => {
        const completed = s.jobs.filter(
          (j) => j.status === "done" || j.status === "error"
        )
        completed.forEach((j) => {
          if (j.originalUrl) URL.revokeObjectURL(j.originalUrl)
          if (j.removedUrl) URL.revokeObjectURL(j.removedUrl)
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
