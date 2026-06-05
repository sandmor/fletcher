"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  PRESET_COLORS,
  normalizeHexColor,
  type BackgroundConfig,
} from "@/lib/background"
import { cn } from "@/lib/utils"

interface BackgroundPickerProps {
  value?: BackgroundConfig
  onChange: (background: BackgroundConfig) => void
  onClear: () => void
}

export function BackgroundPicker({
  value,
  onChange,
  onClear,
}: BackgroundPickerProps) {
  const activeColor = value?.color
  const customColor = activeColor ?? "#FFFFFF"

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Presets</Label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((preset) => {
            const isActive = activeColor === preset.value

            return (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() =>
                  onChange({ type: "solid", color: preset.value })
                }
                className={cn(
                  "aspect-square rounded-full border-2 transition-transform hover:scale-105",
                  isActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border"
                )}
                style={{ backgroundColor: preset.value }}
              />
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="custom-background-color" className="text-sm font-medium">
          Custom color
        </Label>
        <div className="flex items-center gap-3">
          <input
            id="custom-background-color"
            type="color"
            value={customColor}
            onChange={(event) => {
              const color = normalizeHexColor(event.target.value)
              onChange({ type: "solid", color })
            }}
            className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
          />
          <span className="font-mono text-sm text-muted-foreground">
            {customColor}
          </span>
        </div>
      </div>

      {value && (
        <Button variant="outline" onClick={onClear} className="w-full">
          Remove background
        </Button>
      )}
    </div>
  )
}
