import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  // Mesma URL do layout para manter consistência e evitar ícones diferentes
  const iconUrl = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=512&h=512';
  
  return {
    name: 'Du Express',
    short_name: 'Du Express',
    description: 'App de gerenciamento de entregas e logística.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#13a4ec',
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
