import { supabase } from '../lib/supabase';
import { mapSupabaseSettings } from '../lib/supabase-mapper';
import { AppSettings } from '../types';

// Cache the settings to avoid fetching from Supabase on every email sent
let cachedSettings: AppSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export const sendEmailNotification = async (
  to: string,
  subject: string,
  body: string
) => {
  // Fire and forget - don't block the caller
  _sendEmailNotificationAsync(to, subject, body).catch(console.error);
};

const _sendEmailNotificationAsync = async (
  to: string,
  subject: string,
  body: string
) => {
  try {
    const now = Date.now();
    if (!cachedSettings || now - lastFetchTime > CACHE_DURATION) {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'app').single();
      
      if (data) {
        cachedSettings = mapSupabaseSettings(data);
        lastFetchTime = now;
      }
    }
    
    if (cachedSettings) {
      if (cachedSettings.notificacao_email) {
        // Simulate sending email
        console.log(`[EMAIL ENVIADO] Para: ${to}`);
        console.log(`[ASSUNTO] ${subject}`);
        console.log(`[MENSAGEM] ${body}`);
        
        // In a real app, you would call a Cloud Function or an API endpoint here
        // e.g., await fetch('/api/send-email', { method: 'POST', body: JSON.stringify({ to, subject, body }) });
      } else {
        console.log(`[EMAIL IGNORADO] Notificações desativadas. Para: ${to}`);
      }
    }
  } catch (error) {
    console.error("Erro ao verificar configurações de email:", error);
  }
};
