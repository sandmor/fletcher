"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ImageUp, Images } from "lucide-react"
import { ThemeToggle } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Upload", icon: ImageUp },
  { href: "/results", label: "Results", icon: Images },
]

export function PageHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <ImageUp className="h-4 w-4" />
            </div>
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">
              Fletcher
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
