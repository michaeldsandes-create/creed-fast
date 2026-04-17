export type ClientStatus = 'Em análise' | 'Aprovado' | 'Rejeitado' | 'Aguardando caixa';
export type LoanType = 'simple' | 'installment';
export type LoanStatus = 'active' | 'paid' | 'overdue';

export interface Client {
  id: string;
  name: string;
  cpf: string;
  email: string;
  selfieUrl?: string;
  address?: string;
  requestedAmount?: number;
  monthlyIncome?: number;
  observation?: string;
  status: ClientStatus;
  clientType?: 'ouro' | 'medio' | 'ruim';
  createdAt: any;
  updatedAt: any;
}

export interface Loan {
  id: string;
  clientId: string;
  type: LoanType;
  principal: number;
  interestRate: number;
  totalAmount: number;
  remainingAmount: number;
  installments?: number;
  installmentValue?: number;
  status: LoanStatus;
  startDate: any;
  nextDueDate: any;
}

export interface Payment {
  id: string;
  loanId: string;
  clientId: string;
  amount: number;
  date: any;
  status: 'paid';
  type?: 'full' | 'partial' | 'interest';
  isLate?: boolean;
  daysLate?: number;
  jurosAtrasoPago?: number;
}

export interface AppSettings {
  tema: 'claro' | 'escuro';
  cor_primaria: string;
  notificacao_email: boolean;
  biometria: boolean;
  availableCapital?: number;
}
