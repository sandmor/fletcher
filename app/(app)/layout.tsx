"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import * as React from "react"
import { PageHeader } from "@/components/page-header"
import { QueueWidget } from "@/components/queue-widget"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/sign-in")
    }
  }, [isLoaded, userId, router])

  if (!isLoaded || !userId) {
    return null // Prevent flash
  }

  return (
    <>
      <PageHeader />
      {children}
      <QueueWidget />
    </>
  )
}
