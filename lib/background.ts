export type BackgroundConfig =
  | { type: "solid"; color: string }
  | { type: "image"; imageUrl: string; fileName?: string }

export const PRESET_COLORS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Black", value: "#000000" },
  { label: "Gray", value: "#6B7280" },
  { label: "Slate", value: "#334155" },
  { label: "Red", value: "#EF4444" },
  { label: "Orange", value: "#F97316" },
  { label: "Yellow", value: "#EAB308" },
  { label: "Green", value: "#22C55E" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Indigo", value: "#6366F1" },
  { label: "Purple", value: "#A855F7" },
  { label: "Pink", value: "#EC4899" },
] as const

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_PATTERN.test(color)
}

export function normalizeHexColor(color: string): string {
  const trimmed = color.trim()
  if (HEX_COLOR_PATTERN.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  const shortHex = /^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/.exec(trimmed)
  if (shortHex) {
    const [, r, g, b] = shortHex
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return "#FFFFFF"
}
