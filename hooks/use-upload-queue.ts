"use client"

import { useCallback, useReducer, useRef } from "react"
import { useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { getPresignedUrl, uploadToS3 } from "@/lib/s3"
import { toast } from "sonner"

export type UploadStatus = "idle" | "uploading" | "uploaded" | "error"

export interface UploadItem {
  id: string
  file: File
  fileName: string
  previewUrl: string
  status: UploadStatus
  remoteUrl?: string
  s3Key?: string
  error?: string
}

type Action =
  | { type: "ADD"; items: UploadItem[] }
  | { type: "UPLOAD_START"; id: string }
  | { type: "UPLOAD_SUCCESS"; id: string; remoteUrl: string; s3Key: string }
  | { type: "UPLOAD_ERROR"; id: string; error: string }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR_ALL" }

function reducer(state: UploadItem[], action: Action): UploadItem[] {
  switch (action.type) {
    case "ADD":
      return [...state, ...action.items]
    case "UPLOAD_START":
      return state.map((i) =>
        i.id === action.id ? { ...i, status: "uploading" as UploadStatus } : i
      )
    case "UPLOAD_SUCCESS":
      return state.map((i) =>
        i.id === action.id
          ? {
              ...i,
              status: "uploaded" as UploadStatus,
              remoteUrl: action.remoteUrl,
              s3Key: action.s3Key,
              error: undefined,
            }
          : i
      )
    case "UPLOAD_ERROR":
      return state.map((i) =>
        i.id === action.id
          ? { ...i, status: "error" as UploadStatus, error: action.error }
          : i
      )
    case "REMOVE": {
      const target = state.find((i) => i.id === action.id)
      if (target?.previewUrl.startsWith("blob:"))
        URL.revokeObjectURL(target.previewUrl)
      return state.filter((i) => i.id !== action.id)
    }
    case "CLEAR_ALL": {
      for (const item of state) {
        if (item.previewUrl.startsWith("blob:"))
          URL.revokeObjectURL(item.previewUrl)
      }
      return []
    }
    default:
      return state
  }
}

export function useUploadQueue() {
  const [items, dispatch] = useReducer(reducer, [])
  const isSubmittingRef = useRef(false)

  const createJob = useMutation(api.jobs.createJob)
  const triggerModal = useAction(api.jobs.triggerModalJob)

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "idle" as UploadStatus,
    }))

    dispatch({ type: "ADD", items: newItems })
    toast.info(
      `${newItems.length} image${newItems.length > 1 ? "s" : ""} added`
    )

    // begin uploads in parallel
    newItems.forEach((item) => {
      dispatch({ type: "UPLOAD_START", id: item.id })
      getPresignedUrl(item.fileName, item.file.type)
        .then(({ url, remoteUrl, key }) =>
          uploadToS3(url, item.file).then(() => {
            dispatch({
              type: "UPLOAD_SUCCESS",
              id: item.id,
              remoteUrl,
              s3Key: key,
            })
          })
        )
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Upload failed"
          dispatch({ type: "UPLOAD_ERROR", id: item.id, error: msg })
          toast.error(`${item.fileName} upload failed`, { description: msg })
        })
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" })
  }, [])

  const submitAll = useCallback(async () => {
    if (isSubmittingRef.current) return
    const ready = items.filter(
      (i): i is UploadItem & { remoteUrl: string; s3Key: string } =>
        i.status === "uploaded" && !!i.remoteUrl && !!i.s3Key
    )
    if (ready.length === 0) {
      toast.info("No uploads ready to submit")
      return
    }

    isSubmittingRef.current = true
    try {
      await Promise.all(
        ready.map(async (item) => {
          const jobId = await createJob({
            inputUrl: item.remoteUrl,
            fileName: item.fileName,
          })
          await triggerModal({ jobId, inputUrl: item.remoteUrl })
          dispatch({ type: "REMOVE", id: item.id })
        })
      )
      toast.success(
        `${ready.length} job${ready.length > 1 ? "s" : ""} submitted`
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed"
      toast.error("Failed to submit jobs", { description: msg })
    } finally {
      isSubmittingRef.current = false
    }
  }, [items, createJob, triggerModal])

  const uploadingCount = items.filter((i) => i.status === "uploading").length
  const readyCount = items.filter((i) => i.status === "uploaded").length
  const canSubmit = readyCount > 0 && uploadingCount === 0

  return {
    items,
    addFiles,
    removeItem,
    clearAll,
    submitAll,
    uploadingCount,
    readyCount,
    canSubmit,
  }
}
