
import { Timestamp } from "firebase/firestore";

export type DeliveryStatus = 'pending' | 'accepted' | 'in-progress' | 'finished' | 'refused';
export type PaymentMethod = 'credit' | 'pix' | 'cash' | 'collect';

export type Delivery = {
  id: string;
  pickup: string;
  dropoff: string;
  price: number;
  status: DeliveryStatus;
  clientId: string;
  courierId?: string;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  finishedAt?: Timestamp;
  observations?: string;
  paid?: boolean; 
  paidByClient?: boolean;
  paymentMethod: PaymentMethod;
  cancelRequested?: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp;
  read: boolean;
};

export type ChatRoom = {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp;
  unreadCountAdmin: number;
  unreadCountUser: number;
  userName?: string; // Cache for display
  userRole?: 'client' | 'courier'; // Cache for display
};

export type UserProfile = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role: 'admin' | 'client' | 'courier';
  address?: string;
  userType?: string;
  cnpj?: string;
  pushSubscription?: string; // JSON string of the WebPush subscription
  createdAt: Timestamp;
  deliveryRate?: number;
  condoRateGoldemItalian?: number;
  condoRateMonteRey?: number;
  rateAricanduva?: number;
  rateApucarana?: number;
  rateSabaudia?: number;
  rateRolandia?: number;
  rateLondrina?: number;
  status?: 'online' | 'offline';
  lastLocation?: {
    lat: number;
    lng: number;
    updatedAt: Timestamp;
  };
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: Timestamp;
  read: boolean;
  icon: 'package' | 'wallet' | 'alert' | 'message';
  link?: string;
};

export type AppStatus = {
  id: string;
  adminOnline: boolean;
  lastUpdated: Timestamp;
};
