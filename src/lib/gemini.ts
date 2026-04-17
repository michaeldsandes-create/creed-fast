import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const analyzeClientCredit = async (clientData: any, financialHistory: any) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é um analista de crédito especialista em microcrédito. 
      Analise o seguinte cliente e dê um parecer técnico:
      
      DADOS DO CLIENTE:
      Nome: ${clientData.name}
      Valor Solicitado: ${clientData.requestedAmount}
      Observação do Cliente: ${clientData.observation}
      
      HISTÓRICO FINANCEIRO:
      Score Matemático: ${financialHistory.score}/100
      Classificação: ${financialHistory.classification}
      Percentual de Pagamento em Dia: ${financialHistory.on_time_percentage}%
      
      Responda em Português com:
      1. Um resumo da viabilidade (Aprovar, Rejeitar ou Atenção).
      2. Justificativa baseada no comportamento e observações.
      3. Uma sugestão de limite máximo seguro.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro na análise do Gemini:", error);
    return "Não foi possível realizar a análise de IA no momento.";
  }
};
