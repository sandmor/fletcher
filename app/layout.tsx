import { Outfit } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider, ThemeHotkey } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { ConvexClientProvider } from "@/components/convex-client-provider"
import { ClerkProvider } from "@clerk/nextjs"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Fletcher — Background Removal",
  description:
    "Remove backgrounds from your images automatically. Upload, process, and download — all in seconds.",
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
        <ConvexClientProvider>
          <ClerkProvider>
            <ThemeProvider>
              <Toaster position="top-right" richColors closeButton />
              <ThemeHotkey />
              {children}
            </ThemeProvider>
          </ClerkProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
