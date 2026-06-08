import { Outfit } from "next/font/google"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { ThemeProvider, ThemeHotkey } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { ConvexClientProviderWithClerk } from "@/components/convex-client-provider"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Fletcher — Background Removal",
  description:
    "Remove backgrounds from your images automatically. Upload, process, and download — all in seconds.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", outfit.variable)}
    >
      <body>
        <ConvexClientProviderWithClerk>
          <ThemeProvider>
            <Toaster position="top-right" richColors closeButton />
            <ThemeHotkey />
            {children}
          </ThemeProvider>
        </ConvexClientProviderWithClerk>
      </body>
    </html>
  )
}
