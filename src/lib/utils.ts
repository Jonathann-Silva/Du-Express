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
  if (!unpaidDeliveries || !Array.isArray(unpaidDeliveries)) {
    return { isBlocked: false, hasDebt: false, isGracePeriod: false, debtAmount: 0 };
  }

  const now = new Date();
  const dayOfWeek = getDay(now); // 0=Dom, 1=Seg, ..., 3=Qua, 4=Qui, 5=Sex, 6=Sab

  // Se for Segunda (1), Terça (2) ou Quarta (3), o cliente está no prazo de graça para a semana que fechou no último sábado.
  // O bloqueio só é ATIVADO de Quinta (4) a Domingo (0).
  const isBlockPhase = dayOfWeek === 0 || dayOfWeek >= 4;

  const currentMonday = startOfWeek(now, { weekStartsOn: 1 });
  currentMonday.setHours(0, 0, 0, 0);

  const previousWeekDebt = unpaidDeliveries.filter(d => {
    // Proteção contra datas inválidas ou nulas
    if (!d.createdAt || typeof d.createdAt.toDate !== 'function') return false;
    
    const deliveryDate = d.createdAt.toDate();
    return isBefore(deliveryDate, currentMonday);
  });

  const totalDebt = unpaidDeliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  const oldDebtAmount = previousWeekDebt.reduce((sum, d) => sum + (d.price || 0), 0);

  if (!isBlockPhase) {
    return { 
        isBlocked: false, 
        hasDebt: totalDebt > 0, 
        isGracePeriod: true,
        debtAmount: totalDebt
    };
  }

  return {
    isBlocked: previousWeekDebt.length > 0,
    hasDebt: totalDebt > 0,
    isGracePeriod: false,
    debtAmount: oldDebtAmount
  };
}
