"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ImageUp, Images, List } from "lucide-react"
import { AppIcon } from "@/components/app-icon"
import { ThemeToggle } from "@/components/theme-provider"
import { UserButton } from "@/components/user-button"
import { QueueList, useQueue } from "@/components/queue-provider"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Upload", icon: ImageUp },
  { href: "/results", label: "Results", icon: Images },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) =>
    pathname === href ||
    (href === "/results" && pathname.startsWith("/details"))
}

export function PageHeader() {
  const isActive = useIsActive()
  const { activeCount, isEmpty, isLoading } = useQueue()
  const [queueOpen, setQueueOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="app-container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center bg-primary transition-transform group-hover:scale-105">
                <AppIcon size={18} className="text-primary-foreground" />
              </div>
              <span className="hidden text-lg font-bold tracking-tight sm:inline">
                Fletcher
              </span>
            </Link>
            {/* Desktop / tablet inline nav — the bottom tab bar takes over on phones */}
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isLoading && !isEmpty && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="relative sm:hidden"
                aria-label="Open queue"
                onClick={() => setQueueOpen(true)}
              >
                <List className="h-4 w-4" />
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            )}
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      <Drawer open={queueOpen} onOpenChange={setQueueOpen}>
        <DrawerContent className="sm:hidden">
          <DrawerHeader>
            <DrawerTitle>Queue</DrawerTitle>
          </DrawerHeader>
          <QueueList
            showClearFinished
            className="pb-[calc(1rem+env(safe-area-inset-bottom))]"
          />
        </DrawerContent>
      </Drawer>
    </>
  )
}

/** Fixed bottom navigation shown only on phones, where the inline header nav is hidden. */
export function MobileTabBar() {
  const isActive = useIsActive()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-(--mobile-nav-h) items-stretch">
        {nav.map((item) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
