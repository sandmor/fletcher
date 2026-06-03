import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider, ThemeHotkey } from "@/components/theme-provider"
import { PageHeader } from "@/components/page-header"
import { QueueWidget } from "@/components/queue-widget"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { ConvexClientProvider } from "@/components/convex-client-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ConvexClientProvider>
          <ThemeProvider>
            <Toaster position="top-right" richColors closeButton />
            <ThemeHotkey />
            <PageHeader />
            {children}
            <QueueWidget />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
