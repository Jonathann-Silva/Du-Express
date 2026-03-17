
import { io, Socket } from 'socket.io-client';

/**
 * CONFIGURAÇÃO DA VPS (SOCKET.IO SERVER)
 * 
 * Para que o GPS funcione na nova VPS, você deve rodar um servidor Node.js simples lá.
 * Exemplo de código para rodar na VPS (server.js):
 * 
 * const io = require('socket.io')(3001, { cors: { origin: "*" } });
 * io.on('connection', (socket) => {
 *   socket.on('update-location', (data) => {
 *     io.emit(`location-${data.courierId}`, data);
 *   });
 * });
 */

// Prioriza a variável de ambiente, caso contrário usa um placeholder para fácil edição
const SOCKET_URL = process.env.NEXT_PUBLIC_GPS_SERVER_URL || 'http://SEU_NOVO_IP_AQUI:3001';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    console.log('Conectando ao servidor de GPS:', SOCKET_URL);
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('✅ Conectado à VPS de GPS');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão com a VPS:', error.message);
    });
  }
  return socket;
};
