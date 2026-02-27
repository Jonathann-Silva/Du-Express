import type { Delivery, User, Client, Courier, Financials, HistoryReport, AdminDelivery, Notification } from './types';

export const deliveryStatuses = [
  { name: 'Pendente', count: 8, key: 'pending' },
  { name: 'Aceito', count: 5, key: 'accepted' },
  { name: 'Em Andamento', count: 12, key: 'in-progress' },
  { name: 'Finalizado', count: 24, key: 'finished' },
  { name: 'Recusado', count: 2, key: 'refused' },
];

export const recentRequests: Delivery[] = [
  {
    id: 'ORD-9921',
    pickup: 'Gourmet Burger Kitchen, Centro',
    dropoff: 'Apartamentos Skyline, 12º Andar',
    price: 18.50,
    timestamp: 'há 2 minutos',
    status: 'pending',
  },
  {
    id: 'ORD-9918',
    pickup: 'Quick Mart, Lado Oeste',
    dropoff: 'Pinecrest Office Park',
    price: 12.00,
    timestamp: 'há 5 minutos',
    status: 'pending',
  },
];

export const adminDeliveries: AdminDelivery[] = [
  {
    id: '#DLV-4829',
    clientName: 'TechCorp Logistics',
    status: 'pending',
    requestedTime: 'há 5 minutos',
  },
  {
    id: '#DLV-3910',
    clientName: 'Urban Eats Co.',
    status: 'in-progress',
    courier: {
      name: 'John Doe',
      avatarId: 'courier-john-doe'
    },
    requestedTime: 'há 12 minutos',
    location: 'Rua Principal Sul (2.4km de distância)'
  },
  {
    id: '#DLV-1209',
    clientName: 'Speedy Retail',
    status: 'finished',
    courier: {
      name: 'Marco Silva',
      avatarId: 'courier-marco-silva'
    },
    requestedTime: 'há 45 minutos',
  },
   {
    id: '#DLV-4830',
    clientName: 'Central Perks',
    status: 'pending',
    requestedTime: 'há 22 minutos',
  },
];


export const financialData: Financials = {
  totalRevenue: 12450.00,
  totalPayouts: 8120.00,
  pendingPayouts: 1240.00,
  monthlyNetMargin: 4330.00,
  marginPercentage: 34.7,
  chartData: [
    { month: 'Jan', revenue: 40 },
    { month: 'Fev', revenue: 55 },
    { month: 'Mar', revenue: 75 },
    { month: 'Abr', revenue: 95 },
    { month: 'Mai', revenue: 60 },
    { month: 'Jun', revenue: 45 },
    { month: 'Jul', revenue: 35 },
  ],
};

export const deliveryRates = [
  {
    clientName: 'Burger Joint Co.',
    details: 'Raio: 5km base',
    clientPays: 4.50,
    courierEarns: 3.20,
    avatar: 'client-portrait-burger',
  },
  {
    clientName: 'Green Pharmacy',
    details: 'Entrega Prioritária',
    clientPays: 6.00,
    courierEarns: 4.10,
    avatar: 'client-portrait-pharmacy',
  },
];

export const clients: Client[] = [
    { id: '#LOJ-8829', name: 'Sede Burger Barn', type: 'Fast Food', status: 'active', avatar: 'BB', password: 'password', hasSetPassword: true},
    { id: '#LOJ-1022', name: 'Loja Green Flora', type: 'Flores', status: 'inactive', avatar: 'GF', password: 'password', hasSetPassword: true},
    { id: '#LOJ-9441', name: 'Central Sushi Time', type: 'Japonês', status: 'active', avatar: 'ST', password: 'password', hasSetPassword: true},
    { id: '#LOJ-2390', name: 'Esquina da Pizza', type: 'Italiano', status: 'active', avatar: 'PC', password: 'password', hasSetPassword: true},
    { id: '#LOJ-5562', name: 'Mega Mercado', type: 'Mercearia', status: 'inactive', avatar: 'MM', password: 'password', hasSetPassword: true},
    { id: '#LOJ-NEW', name: 'Primeiro Acesso', type: 'Demo', status: 'active', avatar: 'PA', password: '', hasSetPassword: false },
];

export const couriers: Courier[] = [
    { id: '#MOT-001', name: 'Marcos Silva', type: 'Motocicleta', status: 'active', avatar: 'MS', password: 'password', hasSetPassword: true},
    { id: '#MOT-002', name: 'Andre Santos', type: 'Carro', status: 'active', avatar: 'AS', password: 'password', hasSetPassword: true},
    { id: '#MOT-003', name: 'Maria Lima', type: 'Motocicleta', status: 'inactive', avatar: 'ML', password: 'password', hasSetPassword: true},
];

export const historyReports: HistoryReport[] = [
    {
        id: '#ORD-9421',
        courier: 'Marcos Silva',
        status: 'Finalizado',
        timestamp: '14:20 PM',
        dateGroup: 'Hoje',
        pickup: 'Av. Paulista, 1000 - Bela Vista',
        dropoff: 'Rua Oscar Freire, 500 - Jardins',
        client: 'Sushi Express Ltd.',
        price: 32.50
    },
    {
        id: '#ORD-9388',
        courier: 'Andre Santos',
        status: 'Recusado',
        timestamp: '11:05 AM',
        dateGroup: 'Hoje',
        pickup: 'Shopping Eldorado',
        dropoff: 'Estação Pinheiros',
        client: 'Burger House',
        price: 0,
        reason: 'Falha no veículo relatada pelo entregador.'
    },
    {
        id: '#ORD-9300',
        courier: 'Felipe Costa',
        status: 'Finalizado',
        timestamp: '18:45 PM',
        dateGroup: 'Ontem',
        pickup: 'Av. Faria Lima, 3500',
        dropoff: 'Itaim Bibi',
        client: 'Mega Store',
        price: 18.90
    },
];

export const clientRecentOrders = [
    {
      id: '#DL-8842',
      destination: 'Central do Centro',
      status: 'EM TRÂNSITO',
      eta: '15 min',
      courierAvatar: 'courier-profile-2'
    },
    {
      id: '#DL-8839',
      destination: 'Estação Norte',
      status: 'CONCLUÍDO',
      time: 'Entregue há 2 horas',
      price: 12.50
    },
    {
      id: '#DL-8831',
      destination: 'Praça do Lado Oeste',
      status: 'CONCLUÍDO',
      time: 'Entregue Ontem',
      price: 18.20
    }
  ];
  
export const clientHistory = [
    {
        id: '#49201',
        destination: 'Av. Paulista, 1000',
        date: '24 de Out, 2023 • 14:30',
        status: 'Concluído',
        price: 15.50,
        courier: 'Ricardo S.',
        package: 'Caixa de Documentos',
        mapImage: 'map-image-1'
    },
    {
        id: '#49188',
        destination: 'Rua Oscar Freire, 580',
        date: '23 de Out, 2023 • 09:15',
        status: 'Cancelado',
        price: 0,
        reason: 'Usuário cancelou o pedido',
        mapImage: 'map-image-1'
    },
    {
        id: '#49155',
        destination: 'Alameda Santos, 222',
        date: '22 de Out, 2023 • 18:05',
        status: 'Concluído',
        price: 22.30,
        courier: 'Maria L.',
        package: 'Entrega de Comida',
        mapImage: 'map-image-1'
    },
];

export const courierTasks = [
  {
    type: 'Entrega Expressa',
    price: 12.40,
    pickup: 'Shopping Central - Praça de Alimentação',
    dropoff: 'Avenida Sempre-Viva, 742',
    isPrimary: true
  },
  {
    type: 'Padrão',
    price: 8.20,
    pickup: 'Farmácia Mais - Centro',
    dropoff: 'Hospital da Misericórdia - Ala B',
    isPrimary: false
  },
  {
    type: 'Pacote',
    price: 15.75,
    pickup: 'Armazém de Tecnologia - Porto A',
    dropoff: 'Centro de Negócios - Torre 1',
    isPrimary: false
  }
];

export const courierEarnings = [
    { id: '#4521', date: '28 de Set, 2023 • 14:20', amount: 12.50, status: 'Finalizado' },
    { id: '#4518', date: '28 de Set, 2023 • 12:45', amount: 8.00, status: 'Finalizado' },
    { id: '#4512', date: '27 de Set, 2023 • 19:10', amount: 15.20, status: 'Finalizado' },
    { id: '#4509', date: '27 de Set, 2023 • 18:05', amount: 10.50, status: 'Finalizado' },
    { id: '#4501', date: '26 de Set, 2023 • 11:30', amount: 22.00, status: 'Finalizado' },
];

export const notifications: Notification[] = [];
