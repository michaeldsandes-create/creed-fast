export type TipoCliente = 'ouro' | 'medio' | 'ruim';

export interface DadosEmprestimo {
  data_emprestimo: Date;
  data_vencimento: Date;
  data_pagamento?: Date | null;
  tipo_cliente: TipoCliente;
}

export interface ResultadoJuros {
  dias_atraso: number;
  valor_juros_total: number;
}

/**
 * Calcula os juros por atraso de um empréstimo.
 * 
 * Regras:
 * - dias_atraso = data_pagamento - data_vencimento
 * - Se não pagou (data_pagamento nula), usa a data atual.
 * - Juros diário: Ouro (R$ 18), Médio (R$ 25), Ruim (R$ 25).
 * - Se não houver atraso, juros = 0.
 * - Não permite dias negativos.
 */
export function calcularJurosAtraso(emprestimo: DadosEmprestimo): ResultadoJuros {
  const { data_vencimento, data_pagamento, tipo_cliente } = emprestimo;

  // Validação básica das datas
  if (!(data_vencimento instanceof Date) || isNaN(data_vencimento.getTime())) {
    throw new Error("Data de vencimento inválida.");
  }

  // Define a data final para o cálculo (data de pagamento ou data atual se não pago)
  let dataFim: Date;
  if (data_pagamento instanceof Date && !isNaN(data_pagamento.getTime())) {
    dataFim = data_pagamento;
  } else {
    dataFim = new Date(); // Usa a data atual se ainda não pagou
  }

  // Zera as horas para calcular apenas a diferença de dias (evita problemas de fuso/horário)
  const vencimento = new Date(data_vencimento.getFullYear(), data_vencimento.getMonth(), data_vencimento.getDate());
  const fim = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());

  // Calcula a diferença em milissegundos
  const diffTime = fim.getTime() - vencimento.getTime();
  
  // Calcula a diferença em dias
  let diasAtraso = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Não permite dias negativos (se pagou antes ou no dia do vencimento)
  if (diasAtraso < 0) {
    diasAtraso = 0;
  }

  // Define o valor do juros diário com base no tipo de cliente
  let valorJurosDiario = 0;
  switch (tipo_cliente) {
    case 'ouro':
      valorJurosDiario = 18.00;
      break;
    case 'medio':
    case 'ruim':
      valorJurosDiario = 25.00;
      break;
    default:
      throw new Error("Tipo de cliente inválido. Use 'ouro', 'medio' ou 'ruim'.");
  }

  // Calcula o juros total
  const valorJurosTotal = diasAtraso > 0 ? diasAtraso * valorJurosDiario : 0;

  return {
    dias_atraso: diasAtraso,
    valor_juros_total: valorJurosTotal
  };
}
