"use client"

import * as React from "react"
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

interface OTPFormProps {
  title: string
  description: string
  error?: string
  loading: boolean
  resending?: boolean
  onSubmit: (code: string) => void
  onResend?: () => void
  onBack: () => void
  backLabel?: string
}

export function OTPForm({
  title,
  description,
  error,
  loading,
  resending,
  onSubmit,
  onResend,
  onBack,
  backLabel = "Back",
}: OTPFormProps) {
  const [code, setCode] = React.useState("")

  // Auto-submit when 6 digits are entered
  React.useEffect(() => {
    if (code.length === 6) {
      onSubmit(code)
    }
  }, [code, onSubmit])

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          onClick={() => onSubmit(code)}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>

        {onResend && (
          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t receive a code?{" "}
            <button
              type="button"
              onClick={onResend}
              disabled={resending || loading}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </p>
        )}

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onBack}
          disabled={loading}
        >
          {backLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
