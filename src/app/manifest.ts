import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const iconUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s';
  
  return {
    name: 'Lucas Expresso',
    short_name: 'Lucas Expresso',
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
        purpose: 'any',
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
