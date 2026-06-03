"use client"

import * as React from "react"
import { useSignUp } from "@clerk/nextjs/legacy"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export default function VerifyPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  async function handleVerify() {
    if (!isLoaded || code.length < 6) return
    setError("")
    setLoading(true)

    try {
      const result = await signUp.attemptEmailAddressVerification({ code })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.push("/")
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : ((err as { errors?: { longMessage?: string }[] })?.errors?.[0]
              ?.longMessage ?? "Verification failed. Please try again.")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!isLoaded) return
    setResending(true)
    setError("")

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
    } catch {
      setError("Failed to resend code.")
    } finally {
      setResending(false)
    }
  }

  // Auto-submit when 6 digits are entered
  React.useEffect(() => {
    if (code.length === 6) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a 6-digit verification code to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={loading}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        <Button
          className="w-full"
          disabled={loading || code.length < 6}
          onClick={handleVerify}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </CardContent>
    </Card>
  )
}
