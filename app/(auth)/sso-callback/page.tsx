import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

export default function SSOCallback() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
