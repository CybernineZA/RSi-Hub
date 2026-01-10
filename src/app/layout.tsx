import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RSi Hub',
  description: 'Operations & logistics hub for Reaper Strategic Industries (Foxhole).',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  )
}
