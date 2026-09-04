import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const analyzeClientCredit = async (clientData: any, financialHistory: any) => {
  try {
    if (!genAI) {
      throw new Error('Gemini API key is missing.');
    }

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

    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    return response.text || "Não foi possível realizar a análise de IA no momento.";
  } catch (error) {
    console.error("Erro na análise do Gemini:", error);
    return "Não foi possível realizar a análise de IA no momento.";
  }
};
