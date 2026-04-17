import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Loan, LoanStatus } from '../types';

export function getLoanStatus(loan: Loan): LoanStatus {
  if (loan.status === 'paid') return 'paid';
  
  if (loan.nextDueDate) {
    const dueDate = loan.nextDueDate?.toDate ? loan.nextDueDate.toDate() : new Date(loan.nextDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return 'overdue';
    } else {
      return 'active';
    }
  }
  
  return loan.status;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function maskCurrency(value: string) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return '';
  const numberValue = parseFloat(cleaned) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
}

export function unmaskCurrency(value: string) {
  if (!value) return 0;
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return 0;
  return parseFloat(cleaned) / 100;
}

export function formatCpf(cpf: string) {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function maskCpf(value: string) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d{0,3})/, '$1.$2');
  if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
}

export function validateCpf(cpf: string): boolean {
  if (!cpf) return false;
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  
  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;

  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;

  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}
