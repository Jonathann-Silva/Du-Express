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

// URL atualizada para forçar a quebra de cache no iOS/Android
const APP_ICON_URL = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=512&h=512';

export const viewport: Viewport = {
  themeColor: '#13a4ec',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Du Express',
  description: 'Seu app de gerenciamento de entregas e logística.',
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
    icon: APP_ICON_URL,
    shortcut: APP_ICON_URL,
    apple: APP_ICON_URL,
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
