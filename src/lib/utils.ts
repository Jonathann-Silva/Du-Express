import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDay, startOfWeek, isBefore, subWeeks } from 'date-fns';
import type { Delivery } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Verifica se o cliente deve ser bloqueado.
 * Regra: Ciclo Seg-Sáb. Vencimento na Quarta subsequente.
 * Dívidas de 2 semanas ou mais bloqueiam IMEDIATAMENTE.
 * Dívida da semana que acabou de fechar bloqueia na QUINTA-FEIRA.
 */
export function checkClientBlockStatus(unpaidDeliveries: Delivery[]) {
  if (!unpaidDeliveries || !Array.isArray(unpaidDeliveries)) {
    return { isBlocked: false, hasDebt: false, isGracePeriod: false, debtAmount: 0 };
  }

  const now = new Date();
  const dayOfWeek = getDay(now); // 0=Dom, 1=Seg, ..., 4=Qui

  // Segunda-feira desta semana (Início do ciclo atual)
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
  thisMonday.setHours(0, 0, 0, 0);

  // Segunda-feira da semana passada (Início do ciclo que acabou de fechar)
  const lastMonday = subWeeks(thisMonday, 1);

  // 1. Dívida Crítica: Qualquer entrega finalizada ANTES da segunda-feira passada.
  // Já passou do prazo de carência há muito tempo.
  const criticalDebt = unpaidDeliveries.filter(d => {
    if (!d.createdAt || typeof d.createdAt.toDate !== 'function') return false;
    const deliveryDate = d.createdAt.toDate();
    return isBefore(deliveryDate, lastMonday);
  });

  // 2. Dívida Recente: Entregas da semana passada (entre a última segunda e esta segunda).
  // Estão no prazo de carência até Quarta-feira.
  const lastWeekDebt = unpaidDeliveries.filter(d => {
    if (!d.createdAt || typeof d.createdAt.toDate !== 'function') return false;
    const date = d.createdAt.toDate();
    return !isBefore(date, lastMonday) && isBefore(date, thisMonday);
  });

  // O bloqueio da dívida recente começa na Quinta-feira (4) e vai até Domingo (0)
  const isPastGracePeriod = dayOfWeek === 0 || dayOfWeek >= 4;

  const totalDebtAmount = unpaidDeliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  
  // BLOQUEIA SE:
  // - Tem dívida de 2 semanas atrás (sempre bloqueia)
  // - OU Tem dívida da semana passada e já passou de Quarta-feira
  const isBlocked = criticalDebt.length > 0 || (lastWeekDebt.length > 0 && isPastGracePeriod);

  return {
    isBlocked,
    hasDebt: totalDebtAmount > 0,
    isGracePeriod: !isPastGracePeriod && lastWeekDebt.length > 0 && criticalDebt.length === 0,
    debtAmount: totalDebtAmount
  };
}
