import { Client, Loan, Payment, AppSettings } from '../types';

export function mapSupabaseClient(data: any): Client {
  return {
    id: data.id,
    name: data.name,
    cpf: data.cpf,
    email: data.email,
    selfieUrl: data.selfie_url,
    address: data.address,
    requestedAmount: data.requested_amount,
    monthlyIncome: data.monthly_income,
    observation: data.observation,
    status: data.status,
    clientType: data.client_type,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
  };
}

export function mapSupabaseLoan(data: any): Loan {
  return {
    id: data.id,
    clientId: data.client_id,
    type: data.type,
    principal: data.principal,
    interestRate: data.interest_rate,
    totalAmount: data.total_amount,
    remainingAmount: data.remaining_amount,
    installments: data.installments,
    installmentValue: data.installment_value,
    status: data.status,
    startDate: data.start_date ? new Date(data.start_date) : new Date(),
    nextDueDate: data.next_due_date ? new Date(data.next_due_date) : new Date(),
  };
}

export function mapSupabasePayment(data: any): Payment {
  return {
    id: data.id,
    loanId: data.loan_id,
    clientId: data.client_id,
    amount: data.amount,
    date: data.date ? new Date(data.date) : new Date(),
    status: data.status,
    type: data.type,
    isLate: data.is_late,
    daysLate: data.days_late,
  };
}

export function mapSupabaseSettings(data: any): AppSettings {
  return {
    tema: data.tema,
    cor_primaria: data.cor_primaria,
    notificacao_email: data.notificacao_email,
    biometria: data.biometria,
    availableCapital: data.available_capital,
  };
}

export function mapClientToSupabase(client: Partial<Client>): any {
  const data: any = { ...client };
  if (data.selfieUrl !== undefined) { data.selfie_url = data.selfieUrl; delete data.selfieUrl; }
  if (data.requestedAmount !== undefined) { data.requested_amount = data.requestedAmount; delete data.requestedAmount; }
  if (data.monthlyIncome !== undefined) { data.monthly_income = data.monthlyIncome; delete data.monthlyIncome; }
  if (data.clientType !== undefined) { data.client_type = data.clientType; delete data.clientType; }
  if (data.createdAt !== undefined) { data.created_at = data.createdAt; delete data.createdAt; }
  if (data.updatedAt !== undefined) { data.updated_at = data.updatedAt; delete data.updatedAt; }
  return data;
}

export function mapLoanToSupabase(loan: Partial<Loan>): any {
  const data: any = { ...loan };
  if (data.clientId !== undefined) { data.client_id = data.clientId; delete data.clientId; }
  if (data.interestRate !== undefined) { data.interest_rate = data.interestRate; delete data.interestRate; }
  if (data.totalAmount !== undefined) { data.total_amount = data.totalAmount; delete data.totalAmount; }
  if (data.remainingAmount !== undefined) { data.remaining_amount = data.remainingAmount; delete data.remainingAmount; }
  if (data.installmentValue !== undefined) { data.installment_value = data.installmentValue; delete data.installmentValue; }
  if (data.startDate !== undefined) { data.start_date = data.startDate; delete data.startDate; }
  if (data.nextDueDate !== undefined) { data.next_due_date = data.nextDueDate; delete data.nextDueDate; }
  return data;
}

export function mapPaymentToSupabase(payment: Partial<Payment>): any {
  const data: any = { ...payment };
  if (data.loanId !== undefined) { data.loan_id = data.loanId; delete data.loanId; }
  if (data.clientId !== undefined) { data.client_id = data.clientId; delete data.clientId; }
  if (data.isLate !== undefined) { data.is_late = data.isLate; delete data.isLate; }
  if (data.daysLate !== undefined) { data.days_late = data.daysLate; delete data.daysLate; }
  return data;
}

export function mapSettingsToSupabase(settings: Partial<AppSettings>): any {
  const data: any = { ...settings };
  if (data.availableCapital !== undefined) { data.available_capital = data.availableCapital; delete data.availableCapital; }
  return data;
}
