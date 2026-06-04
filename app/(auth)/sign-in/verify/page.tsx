"use client"

import * as React from "react"
import { useSignIn } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { OTPForm } from "@/components/auth/otp-form"

export default function SignInVerifyPage() {
  const { signIn } = useSignIn()
  const router = useRouter()
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  const handleVerify = React.useCallback(
    async (code: string) => {
      if (!signIn) return
      setError("")
      setLoading(true)

      try {
        const { error } = await signIn.mfa.verifyEmailCode({ code })

        if (error) {
          setError(error.longMessage || error.message || "Verification failed.")
          setLoading(false)
          return
        }

        if (signIn.status === "complete") {
          await signIn.finalize()
          router.push("/")
        } else {
          setError(`Verification requires further action: ${signIn.status}`)
        }
      } catch (err: any) {
        setError(
          err.errors?.[0]?.longMessage ?? err.message ?? "Verification failed."
        )
      } finally {
        setLoading(false)
      }
    },
    [signIn, router]
  )

  const handleResend = React.useCallback(async () => {
    if (!signIn) return
    setResending(true)
    setError("")

    try {
      const { error } = await signIn.mfa.sendEmailCode()
      if (error) setError(error.longMessage || "Failed to resend code.")
    } catch {
      setError("Failed to resend code.")
    } finally {
      setResending(false)
    }
  }, [signIn])

  return (
    <OTPForm
      title="Verify your device"
      description="We sent a 6-digit code to your email to verify this login attempt."
      loading={loading}
      resending={resending}
      error={error}
      onSubmit={handleVerify}
      onResend={handleResend}
      onBack={() => router.push("/sign-in")}
      backLabel="Back to sign in"
    />
  )
}
