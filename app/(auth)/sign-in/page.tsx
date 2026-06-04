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
import { Loader2 } from "lucide-react"
import { SSOButton, AuthSeparator } from "@/components/auth/sso-button"

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()
  const [step, setStep] = React.useState<"signIn" | "needs2FA">("signIn")
  const [code, setCode] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleFirstFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setLoading(true)

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.push("/")
      } else if (result.status === "needs_second_factor") {
        setStep("needs2FA")
      } else {
        setError(`Unhandled status: ${result.status}`)
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

  async function handleSecondFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setLoading(true)

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: code,
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.push("/")
      } else {
        setError(`Unhandled status: ${result.status}`)
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid code. Please try again."
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {step === "signIn" ? (
          <>
            <form onSubmit={handleFirstFactor} className="space-y-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
            <AuthSeparator />
            <SSOButton onClick={handleGoogleSSO} />
          </>
        ) : (
          <form onSubmit={handleSecondFactor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="2fa-code">Verification Code</Label>
              <p className="text-sm text-muted-foreground">
                We sent a verification code to {email}.
              </p>
              <Input
                id="2fa-code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Code
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => setStep("signIn")}
            >
              Back to login
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </p>
        <div id="clerk-captcha"></div>
      </CardFooter>
    </Card>
  )
}
