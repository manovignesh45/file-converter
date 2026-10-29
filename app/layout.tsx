import './globals.css'
import PwaSetup from '../components/PwaSetup'

// Use system fonts as a more reliable alternative
const systemFont = {
  className: 'font-system'
}

export const metadata = {
  title: 'File Converter - Professional Image Processing Platform',
  description: 'Convert, compress, resize, and process images with our powerful online tool',
  applicationName: 'ConvertPro',
  appleWebApp: {
    capable: true,
    title: 'ConvertPro',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Lets the installed app draw under notches; layouts pad with env(safe-area-inset-*).
  viewportFit: 'cover',
  themeColor: '#4f46e5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={systemFont.className}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          {children}
        </div>
        <PwaSetup />
      </body>
    </html>
  )
}
