
import { io, Socket } from 'socket.io-client';

// Substitua pelo IP Público da sua Oracle VPS ou seu domínio
const SOCKET_URL = process.env.NEXT_PUBLIC_GPS_SERVER_URL || 'http://seu-ip-da-vps:3001';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
};
