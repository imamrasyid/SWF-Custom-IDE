import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WayangIDE License Manager',
  description: 'License management dashboard for WayangIDE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
