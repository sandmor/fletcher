"use client"

import * as React from "react"
import { useSignUp } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { OTPForm } from "@/components/auth/otp-form"

export default function SignUpVerifyPage() {
  const { signUp } = useSignUp()
  const router = useRouter()
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  const handleVerify = React.useCallback(
    async (code: string) => {
      if (!signUp) return
      setError("")
      setLoading(true)

      try {
        const { error } = await signUp.verifications.verifyEmailCode({ code })

        if (error) {
          setError(error.longMessage || error.message || "Verification failed.")
          setLoading(false)
          return
        }

        if (signUp.status === "complete") {
          await signUp.finalize()
          router.push("/")
        } else {
          setError(`Verification requires further action: ${signUp.status}`)
        }
      } catch (err: any) {
        // Fallback for unexpected exceptions
        setError(
          err.errors?.[0]?.longMessage ?? err.message ?? "An error occurred."
        )
      } finally {
        setLoading(false)
      }
    },
    [signUp, router]
  )

  const handleResend = React.useCallback(async () => {
    if (!signUp) return
    setResending(true)
    setError("")

    try {
      const { error } = await signUp.verifications.sendEmailCode()
      if (error) setError(error.longMessage || "Failed to resend code.")
    } catch {
      setError("Failed to resend code.")
    } finally {
      setResending(false)
    }
  }, [signUp])

  return (
    <OTPForm
      title="Check your email"
      description="We sent a 6-digit verification code to your email address to complete your registration."
      loading={loading}
      resending={resending}
      error={error}
      onSubmit={handleVerify}
      onResend={handleResend}
      onBack={() => router.push("/sign-up")}
      backLabel="Back to sign up"
    />
  )
}
