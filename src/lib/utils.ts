import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDay, startOfWeek, isBefore } from 'date-fns';
import type { Delivery } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Verifica se o cliente deve ser bloqueado.
 * Regra: Semana fecha Sábado. Pagamento até Quarta. Quinta-feira bloqueia se houver dívida de semanas passadas.
 */
export function checkClientBlockStatus(unpaidDeliveries: Delivery[]) {
  const now = new Date();
  const dayOfWeek = getDay(now); // 0=Dom, 1=Seg, ..., 3=Qua, 4=Qui, 5=Sex, 6=Sab

  // Se for Segunda (1), Terça (2) ou Quarta (3), o cliente está no prazo de graça para a semana que fechou no último sábado.
  // O bloqueio só é ATIVADO de Quinta (4) a Domingo (0).
  const isBlockPhase = dayOfWeek === 0 || dayOfWeek >= 4;

  if (!isBlockPhase) {
    return { isBlocked: false, hasDebt: unpaidDeliveries.length > 0, isGracePeriod: true };
  }

  // Se estamos na fase de bloqueio, verificamos se há dívidas de SEMANAS ANTERIORES.
  // "Semana anterior" é qualquer entrega criada ANTES desta segunda-feira atual.
  const currentMonday = startOfWeek(now, { weekStartsOn: 1 });
  currentMonday.setHours(0, 0, 0, 0);

  const previousWeekDebt = unpaidDeliveries.filter(d => {
    const deliveryDate = d.createdAt.toDate();
    return isBefore(deliveryDate, currentMonday);
  });

  return {
    isBlocked: previousWeekDebt.length > 0,
    hasDebt: unpaidDeliveries.length > 0,
    isGracePeriod: false,
    debtAmount: previousWeekDebt.reduce((sum, d) => sum + d.price, 0)
  };
}
