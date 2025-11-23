const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxfl0gWq3-dnZmYcz5AIHkpOyC1XdRb8QdaMRQTQZnn5sqyQZvV3qhCevhXuFHGYBk0/exec';

interface GoogleSheetsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

async function fetchData(action: string, data: any = {}) {
  console.log('🔍 URL configurada:', SCRIPT_URL);
  console.log('🔍 Action:', action);
  console.log('🔍 Data:', data);

  const params = new URLSearchParams({
    action,
    ...Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>)
  });

  const url = `${SCRIPT_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Resposta:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro na comunicação com Google Apps Script:', error);
    throw error;
  }
}

export const googleSheetsService = {
  async getCandidates(filters?: any): Promise<GoogleSheetsResponse> {
    return fetchData('getCandidates', filters);
  },

  async updateCandidateStatus(
    registrationNumber: string,
    statusTriagem: 'Classificado' | 'Desclassificado' | 'Revisar',
    options?: {
      reasonId?: string;
      notes?: string;
      analystEmail?: string;
    }
  ): Promise<GoogleSheetsResponse> {
    return fetchData('updateCandidateStatus', {
      registrationNumber,
      statusTriagem,
      ...options
    });
  },

  async getCandidatesByStatus(status: 'Classificado' | 'Desclassificado' | 'Revisar'): Promise<GoogleSheetsResponse> {
    console.log('📊 getCandidatesByStatus - Status:', status);
    const result = await fetchData('getCandidatesByStatus', { status });
    console.log('📦 Dados recebidos:', result);
    return result;
  },

  async logMessage(
    registrationNumber: string,
    messageType: 'email' | 'sms',
    recipient: string,
    subject: string | null,
    content: string,
    sentBy: string
  ): Promise<GoogleSheetsResponse> {
    return fetchData('logMessage', {
      registrationNumber,
      messageType,
      recipient,
      subject,
      content,
      sentBy
    });
  },

  async getDisqualificationReasons(): Promise<GoogleSheetsResponse> {
    return fetchData('getDisqualificationReasons');
  },

  async getMessageTemplates(messageType?: 'email' | 'sms'): Promise<GoogleSheetsResponse> {
    return fetchData('getMessageTemplates', { messageType });
  },

  async sendMessages(
    messageType: 'email' | 'sms',
    subject: string,
    content: string,
    candidateIds: string,
    sentBy: string,
    fromAlias?: string
  ): Promise<GoogleSheetsResponse> {
    console.log('📤 Enviando requisição para Google Apps Script');
    console.log('  Tipo:', messageType);
    console.log('  IDs:', candidateIds);
    console.log('  Alias:', fromAlias);

    const result = await fetchData('sendMessages', {
      messageType,
      subject: subject || '',
      content,
      candidateIds,
      sentBy,
      fromAlias
    });

    console.log('📦 Resposta recebida:', result);
    return result;
  },

  async updateMessageStatus(
    registrationNumbers: string[],
    messageType: 'email' | 'sms',
    status: string
  ): Promise<GoogleSheetsResponse> {
    return fetchData('updateMessageStatus', {
      registrationNumbers: registrationNumbers.join(','),
      messageType,
      status
    });
  },

  async moveToInterview(candidateIds: string): Promise<GoogleSheetsResponse> {
    return fetchData('moveToInterview', { candidateIds });
  },

  async getInterviewCandidates(): Promise<GoogleSheetsResponse> {
    return fetchData('getInterviewCandidates');
  },

  async getInterviewers(): Promise<GoogleSheetsResponse> {
    return fetchData('getInterviewers');
  },

  async allocateToInterviewer(params: {
    candidateIds: string[] | string;
    interviewerEmail: string;
    adminEmail: string;
  }): Promise<GoogleSheetsResponse> {
    const candidateIdsString = Array.isArray(params.candidateIds)
      ? params.candidateIds.join(',')
      : params.candidateIds;

    return fetchData('allocateToInterviewer', {
      candidateIds: candidateIdsString,
      interviewerEmail: params.interviewerEmail,
      adminEmail: params.adminEmail
    });
  },

  async getInterviewerCandidates(interviewerEmail: string): Promise<GoogleSheetsResponse> {
    return fetchData('getInterviewerCandidates', { interviewerEmail });
  },

  async saveInterviewEvaluation(evaluation: any): Promise<GoogleSheetsResponse> {
    return fetchData('saveInterviewEvaluation', evaluation);
  },

  async getReportStats(): Promise<GoogleSheetsResponse> {
    return fetchData('getReportStats');
  },

  async getReport(
    reportType: string,
    analystEmail?: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    const params: any = { reportType };
    if (analystEmail) params.analystEmail = analystEmail;
    if (interviewerEmail) params.interviewerEmail = interviewerEmail;
    return fetchData('getReport', params);
  },

  async getEmailAliases(): Promise<GoogleSheetsResponse> {
    return fetchData('getEmailAliases');
  },

  async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
    return fetchData('saveScreening', screeningData);
  },

  async fetchCandidates(): Promise<any[]> {
    const result = await fetchData('getCandidates');
    if (result.success && result.data) {
      return result.data.candidates || result.data || [];
    }
    return [];
  },

  async getAnalysts(): Promise<GoogleSheetsResponse> {
    return fetchData('getAnalysts');
  }
};
