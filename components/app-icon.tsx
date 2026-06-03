import { cn } from "@/lib/utils"

interface AppIconProps {
  className?: string
  size?: number
  variant?: "solid" | "transparent"
}

export function AppIcon({
  className,
  size = 32,
  variant = "solid",
}: AppIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    >
      {variant === "solid" && (
        <rect width="32" height="32" rx="8" className="fill-primary" />
      )}

      <g transform="translate(1,1)">
        <g
          className={cn(
            "fill-none",
            variant === "solid"
              ? "stroke-primary-foreground"
              : "stroke-foreground"
          )}
        >
          <path
            d="M6,12 V6 H12"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18,6 H24 V12"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M24,18 V24 H18"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12,24 H6 V18"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <rect
          x="12"
          y="12"
          width="6"
          height="6"
          rx="1.5"
          transform="rotate(-15 15 15)"
          className={cn(
            variant === "solid" ? "fill-background" : "fill-primary"
          )}
        />
      </g>
    </svg>
  )
}
