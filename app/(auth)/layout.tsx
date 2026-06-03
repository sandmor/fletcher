import { AppIcon } from "@/components/app-icon"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <AppIcon size={20} className="text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">Fletcher</span>
      </div>
      <div className="animate-fade-in w-full max-w-sm">{children}</div>
    </div>
  )
}
