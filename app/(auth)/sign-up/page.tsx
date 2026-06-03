"use client"

import * as React from "react"
import { useSignUp } from "@clerk/nextjs/legacy"
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

export default function SignUpPage() {
  const { isLoaded, signUp } = useSignUp()
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      await signUp.create({
        emailAddress: email,
        password,
      })

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      })

      router.push("/verify")
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : ((err as { errors?: { longMessage?: string }[] })?.errors?.[0]
              ?.longMessage ?? "Sign up failed. Please try again.")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSSO() {
    if (!isLoaded) return
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start Google sign-up."
      setError(message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Create account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sign-up-email">Email</Label>
            <Input
              id="sign-up-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-up-password">Password</Label>
            <Input
              id="sign-up-password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-up-confirm">Confirm password</Label>
            <Input
              id="sign-up-confirm"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign up
          </Button>
        </form>

        <AuthSeparator />
        <SSOButton onClick={handleGoogleSSO} />
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign in
          </Link>
        </p>
        <div id="clerk-captcha"></div>
      </CardFooter>
    </Card>
  )
}
