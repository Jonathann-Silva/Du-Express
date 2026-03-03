import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const iconUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s';
  
  return {
    name: 'Lucas-Expresso',
    short_name: 'LucasExpresso',
    description: 'App de gerenciamento de entregas e logística.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff', // Branco puro é melhor para o splash screen do iOS
    theme_color: '#13a4ec',
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png', // Certifique-se que a imagem é realmente PNG
        purpose: 'any',
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any', // No iOS, 'any' funciona melhor que 'maskable' para evitar bordas estranhas
      },
    ],
  }
}