import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import FirebaseProvider from '@/firebase/client-provider';
import Script from 'next/script';
import { PWAUpdater } from '@/components/PWAUpdater';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

// URL do novo ícone fornecido (com dl=1 para garantir acesso direto à imagem e evitar cache)
const APP_ICON_URL = 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&dl=1';

export const viewport: Viewport = {
  themeColor: '#13a4ec',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Du Express',
  description: 'App de gerenciamento de entregas e logística.',
  applicationName: 'Du Express',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Du Express',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: APP_ICON_URL },
      { url: `${APP_ICON_URL}&v=3`, sizes: '192x192', type: 'image/png' }
    ],
    shortcut: APP_ICON_URL,
    apple: [
      { url: APP_ICON_URL, sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href='https://unpkg.com/maplibre-gl/dist/maplibre-gl.css' rel='stylesheet' />
        <link rel="apple-touch-icon" href={APP_ICON_URL} />
        {/* Meta tags explícitas para iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Du Express" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={cn(inter.variable, spaceGrotesk.variable, 'font-body antialiased')}>
        <FirebaseProvider>
          <PWAUpdater />
          {children}
          <Toaster />
        </FirebaseProvider>
        <Script src="https://sdk.mercadopago.com/js/v2" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
