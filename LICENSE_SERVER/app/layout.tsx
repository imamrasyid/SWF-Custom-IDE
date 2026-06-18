import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NinjaSage License Manager',
  description: 'License management dashboard for NinjaSage Modding Toolkit',
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
