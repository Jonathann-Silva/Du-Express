import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import FirebaseProvider from '@/firebase/client-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const APP_ICON_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s';

export const viewport: Viewport = {
  themeColor: '#13a4ec',
};

export const metadata: Metadata = {
  title: 'Lucas-Expresso',
  description: 'Seu app de gerenciamento de entregas.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lucas-Expresso',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href='https://unpkg.com/maplibre-gl/dist/maplibre-gl.css' rel='stylesheet' />
        <link rel="apple-touch-icon" href={APP_ICON_URL} />
      </head>
      <body className={cn(inter.variable, spaceGrotesk.variable, 'font-body antialiased')}>
        <FirebaseProvider>
          {children}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
