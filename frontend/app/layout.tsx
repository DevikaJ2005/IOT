import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IoT Face Security',
  description: 'Smart Face Recognition & IoT Access Control',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
