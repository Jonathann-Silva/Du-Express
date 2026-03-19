import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  // Versão 16 - Cache buster para garantir atualização do ícone e estrutura
  const iconUrl = 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1&v=16';
  
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
