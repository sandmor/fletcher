import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

export const transparencyBackgroundStyle: CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(45deg, var(--color-muted) 25%, transparent 25%, transparent 75%, var(--color-muted) 75%, var(--color-muted)),
    repeating-linear-gradient(45deg, var(--color-muted) 25%, var(--color-background) 25%, var(--color-background) 75%, var(--color-muted) 75%, var(--color-muted))
  `,
  backgroundPosition: "0 0, 12px 12px",
  backgroundSize: "24px 24px",
  opacity: 0.5,
}

interface TransparencyBackgroundProps {
  className?: string
}

export function TransparencyBackground({
  className,
}: TransparencyBackgroundProps) {
  return (
    <div
      className={cn("absolute inset-0", className)}
      style={transparencyBackgroundStyle}
    />
  )
}
