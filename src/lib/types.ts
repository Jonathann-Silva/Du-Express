
import { Timestamp } from "firebase/firestore";

export type DeliveryStatus = 'pending' | 'accepted' | 'in-progress' | 'finished' | 'refused';
export type PaymentMethod = 'credit' | 'pix' | 'cash';

export type Delivery = {
  id: string;
  pickup: string;
  dropoff: string;
  price: number;
  status: DeliveryStatus;
  clientId: string;
  courierId?: string;
  createdAt: Timestamp;
  finishedAt?: Timestamp;
  observations?: string;
  paid?: boolean; // Pago para o motoboy
  paidByClient?: boolean; // Pago pela loja ao admin
  paymentMethod: PaymentMethod;
};

export type AdminDeliveryStatus = 'pending' | 'accepted' | 'in-progress' | 'finished' | 'refused';

export type AdminDelivery = {
  id: string;
  clientName: string;
  status: AdminDeliveryStatus;
  courier?: {
    name: string;
    avatarId: string;
  };
  requestedTime: string;
  location?: string;
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
  fcmToken?: string;
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

export type Financials = {
  totalRevenue: number;
  totalPayouts: number;
  pendingPayouts: number;
  monthlyNetMargin: number;
  marginPercentage: number;
  chartData: { month: string; revenue: number }[];
};

export type HistoryReport = {
    id: string;
    courier: string;
    status: 'Finished' | 'Refused';
    timestamp: string;
    dateGroup: 'Today' | 'Yesterday';
    pickup: string;
    dropoff: string;
    client: string;
    price: number;
    reason?: string;
}

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: Timestamp;
  read: boolean;
  icon: 'package' | 'wallet' | 'alert';
  link?: string;
};

export type AppStatus = {
  id: string;
  adminOnline: boolean;
  lastUpdated: Timestamp;
};
