"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import * as React from "react"
import { MobileTabBar, PageHeader } from "@/components/page-header"
import { QueueProvider } from "@/components/queue-provider"
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
    <QueueProvider>
      <div className="flex min-h-dvh flex-col">
        <PageHeader />
        {/* Reserve room for the mobile tab bar (and its safe-area) on phones. */}
        <div className="flex flex-1 flex-col pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] sm:pb-0">
          {children}
        </div>
        <MobileTabBar />
        <QueueWidget />
      </div>
    </QueueProvider>
  )
}
