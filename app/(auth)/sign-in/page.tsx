"use client"

import * as React from "react"
import { useSignIn } from "@clerk/nextjs/legacy"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { SSOButton, AuthSeparator } from "@/components/auth/sso-button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()

  // Standard auth state
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // 2FA / Device verification state
  const [needsEmailCode, setNeedsEmailCode] = React.useState(false)
  const [code, setCode] = React.useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setLoading(true)

    try {
      if (!needsEmailCode) {
        // Step 1: Initial sign-in with email and password
        const result = await signIn.create({
          identifier: email,
          password,
        })

        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId })
          router.push("/")
        } else if (result.status === "needs_second_factor") {
          // Clerk is requiring a verification code
          await signIn.prepareSecondFactor({
            strategy: "email_code",
          })
          setNeedsEmailCode(true)
        } else {
          // Catch-all for other unhandled statuses, safely handling null
          console.log("Unhandled sign-in status:", result.status)
          const statusText =
            result.status?.replace(/_/g, " ") || "unknown state"
          setError(`Sign in requires further action: ${statusText}`)
        }
      } else {
        // Step 2: Verify the email code
        const result = await signIn.attemptSecondFactor({
          strategy: "email_code",
          code,
        })

        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId })
          router.push("/")
        } else {
          // Catch-all for other 2FA statuses, safely handling null
          console.log("Unhandled 2FA status:", result.status)
          const statusText =
            result.status?.replace(/_/g, " ") || "unknown state"
          setError(`Verification requires further action: ${statusText}`)
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : ((err as { errors?: { longMessage?: string }[] })?.errors?.[0]
              ?.longMessage ?? "Sign in failed. Please try again.")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSSO() {
    if (!isLoaded) return
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start Google sign-in."
      setError(message)
    }
  }

  // Reset function if user wants to go back from the 2FA screen
  function handleBack() {
    setNeedsEmailCode(false)
    setCode("")
    setError("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          {needsEmailCode ? "Verify your device" : "Sign in"}
        </CardTitle>
        {needsEmailCode && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            For your security, please enter the verification code sent to{" "}
            <strong>{email}</strong>.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!needsEmailCode ? (
            // --- STEP 1: STANDARD LOGIN UI ---
            <>
              <div className="space-y-2">
                <Label htmlFor="sign-in-email">Email</Label>
                <Input
                  id="sign-in-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sign-in-password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="sign-in-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            // --- STEP 2: 2FA VERIFICATION UI ---
            <div className="flex flex-col items-center space-y-4">
              <Label htmlFor="verification-code" className="sr-only">
                Verification Code
              </Label>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
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
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (needsEmailCode && code.length < 6)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsEmailCode ? "Verify code" : "Sign in"}
          </Button>

          {needsEmailCode && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleBack}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          )}
        </form>

        {!needsEmailCode && (
          <>
            <AuthSeparator />
            <SSOButton onClick={handleGoogleSSO} />
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center gap-4">
        {!needsEmailCode && (
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </Link>
          </p>
        )}
        <div id="clerk-captcha"></div>
      </CardFooter>
    </Card>
  )
}
