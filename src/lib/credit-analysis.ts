import { Client, Loan } from '../types';
import { differenceInDays } from 'date-fns';

export interface CreditAnalysisResult {
  cliente: {
    nome: string;
    renda: number;
    historico: string;
  };
  analise_credito: {
    status: 'APROVADO' | 'EM ANÁLISE' | 'REPROVADO' | 'AGUARDANDO CAIXA';
    score: number;
    motivo: string;
    sugestao: string;
  };
  calculo: {
    valor_total: number;
    valor_parcela: number;
    lucro_total: number;
    juros_mensal: number;
  };
  inadimplencia: {
    dias_atraso: number;
    classificacao: 'Nenhuma' | 'Leve' | 'Médio' | 'Grave';
    acoes_sugeridas: string[];
  };
  sugestoes: {
    parcelas_ideais: number;
    ajuste_valor: number;
    recomendacao: string;
  };
}

export function analyzeCredit(
  client: Client | null,
  requestedAmount: number,
  installments: number,
  interestRate: number, // monthly %
  availableCapital: number,
  clientLoans: Loan[]
): CreditAnalysisResult {
  const renda = client?.monthlyIncome || 0;
  
  // Calculate Loan
  const juros_mensal = requestedAmount * (interestRate / 100);
  const lucro_total = juros_mensal * installments;
  const valor_total = requestedAmount + lucro_total;
  const valor_parcela = valor_total / installments;

  // Analyze History
  const hasDelays = clientLoans.some(l => l.status === 'overdue');
  const hasHistory = clientLoans.length > 0;
  let historico = hasHistory ? (hasDelays ? 'Com atrasos' : 'Bom pagador') : 'Sem histórico';

  // Credit Analysis Rules
  let status: 'APROVADO' | 'EM ANÁLISE' | 'REPROVADO' | 'AGUARDANDO CAIXA' = 'EM ANÁLISE';
  let score = 100;
  let motivo = '';
  let sugestao = '';

  if (requestedAmount > availableCapital && availableCapital > 0) {
    status = 'AGUARDANDO CAIXA';
    score -= 20;
    motivo = 'Capital indisponível em caixa.';
    sugestao = `Reduzir valor para R$ ${availableCapital.toFixed(2)} ou aguardar recebimentos.`;
  } else if (renda > 0 && valor_parcela > renda * 0.3) {
    status = 'REPROVADO';
    score -= 50;
    motivo = 'Parcela compromete mais de 30% da renda.';
    const maxParcela = renda * 0.3;
    const parcelasIdeais = Math.ceil(valor_total / maxParcela);
    sugestao = `Aumentar para ${parcelasIdeais} parcelas ou reduzir valor solicitado.`;
  } else if (hasDelays) {
    status = 'REPROVADO';
    score -= 60;
    motivo = 'Histórico de atrasos.';
    sugestao = 'Bloquear novo empréstimo até regularização.';
  } else if (!hasHistory) {
    status = 'EM ANÁLISE';
    score -= 30;
    motivo = 'Primeiro empréstimo, sem histórico.';
    sugestao = 'Aprovar valor menor para criar histórico.';
  } else {
    status = 'APROVADO';
    motivo = 'Cliente com bom histórico e margem disponível.';
    sugestao = 'Aprovação automática.';
  }

  // Calculate Overdue
  let dias_atraso = 0;
  let classificacao: 'Nenhuma' | 'Leve' | 'Médio' | 'Grave' = 'Nenhuma';
  let acoes_sugeridas: string[] = [];

  const overdueLoan = clientLoans.find(l => l.status === 'overdue');
  if (overdueLoan && overdueLoan.nextDueDate) {
    const dueDate = overdueLoan.nextDueDate.toDate ? overdueLoan.nextDueDate.toDate() : new Date(overdueLoan.nextDueDate);
    if (!isNaN(dueDate.getTime())) {
      dias_atraso = differenceInDays(new Date(), dueDate);
      
      if (dias_atraso > 60) {
        classificacao = 'Grave';
        acoes_sugeridas = ['Bloquear novo empréstimo', 'Cobrança judicial/negativação'];
      } else if (dias_atraso > 30) {
        classificacao = 'Médio';
        acoes_sugeridas = ['Cobrança automática', 'Contato telefônico'];
      } else if (dias_atraso > 0) {
        classificacao = 'Leve';
        acoes_sugeridas = ['Enviar lembrete (WhatsApp/SMS)'];
      }
    }
  }

  // Extra Intelligence
  let parcelas_ideais = installments;
  let ajuste_valor = requestedAmount;
  let recomendacao = '';

  if (renda > 0) {
    const maxParcela = renda * 0.3;
    if (valor_parcela > maxParcela) {
      parcelas_ideais = Math.ceil(valor_total / maxParcela);
      ajuste_valor = (maxParcela * installments) / (1 + (interestRate/100)*installments);
      recomendacao = `Reduzir valor para R$ ${ajuste_valor.toFixed(2)} ou aumentar para ${parcelas_ideais} parcelas.`;
    } else {
      recomendacao = 'Condições ideais para o perfil.';
    }
  } else {
    recomendacao = 'Cadastre a renda mensal para obter sugestões precisas.';
  }

  return {
    cliente: {
      nome: client?.name || 'Desconhecido',
      renda,
      historico
    },
    analise_credito: {
      status,
      score: Math.max(0, score),
      motivo,
      sugestao
    },
    calculo: {
      valor_total,
      valor_parcela,
      lucro_total,
      juros_mensal
    },
    inadimplencia: {
      dias_atraso,
      classificacao,
      acoes_sugeridas
    },
    sugestoes: {
      parcelas_ideais,
      ajuste_valor,
      recomendacao
    }
  };
}
