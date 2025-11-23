const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxfl0gWq3-dnZmYcz5AIHkpOyC1XdRb8QdaMRQTQZnn5sqyQZvV3qhCevhXuFHGYBk0/exec';

interface GoogleSheetsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

async function makeRequest(action: string, params: any = {}): Promise<GoogleSheetsResponse> {
  try {
    console.log(`📤 GET ${action}:`, params);

    const queryParams = new URLSearchParams();
    queryParams.append('action', action);

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryParams.append(key, String(params[key]));
      }
    });

    const url = `${SCRIPT_URL}?${queryParams.toString()}`;
    console.log(`🔗 URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📥 ${action} response:`, data);
    return data;

  } catch (error) {
    console.error(`❌ ${action} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na requisição'
    };
  }
}

class GoogleSheetsService {
  // ==================== CANDIDATOS ====================
  async getCandidates(filters?: any): Promise<GoogleSheetsResponse> {
    return makeRequest('getCandidates', filters);
  }

  async getCandidatesByStatus(status: 'Classificado' | 'Desclassificado' | 'Revisar'): Promise<GoogleSheetsResponse> {
    return makeRequest('getCandidatesByStatus', { status });
  }

  async updateCandidateStatus(
    registrationNumber: string,
    statusTriagem: 'Classificado' | 'Desclassificado' | 'Revisar',
    options?: {
      reasonId?: string;
      notes?: string;
      analystEmail?: string;
    }
  ): Promise<GoogleSheetsResponse> {
    return makeRequest('updateCandidateStatus', {
      registrationNumber,
      statusTriagem,
      ...options
    });
  }

  async assignCandidates(candidateIds: string[], analystEmail: string, adminEmail: string): Promise<GoogleSheetsResponse> {
    return makeRequest('assignCandidates', {
      candidateIds: candidateIds.join(','),
      analystEmail,
      adminEmail
    });
  }

  // ==================== TRIAGEM ====================
  async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
    return makeRequest('saveScreening', screeningData);
  }

  // ==================== MENSAGENS ====================
  async getMessageTemplates(messageType?: 'email' | 'sms'): Promise<GoogleSheetsResponse> {
    return makeRequest('getMessageTemplates', { messageType });
  }

  async getDisqualificationReasons(): Promise<GoogleSheetsResponse> {
    return makeRequest('getDisqualificationReasons', {});
  }

  async sendMessages(
    messageType: 'email' | 'sms',
    subject: string,
    content: string,
    candidateIds: string[],
    sentBy: string,
    fromAlias?: string
  ): Promise<GoogleSheetsResponse> {
    return makeRequest('sendMessages', {
      messageType,
      subject: subject || '',
      content,
      candidateIds: candidateIds.join(','),
      sentBy,
      fromAlias
    });
  }

  async logMessage(
    registrationNumber: string,
    messageType: 'email' | 'sms',
    recipient: string,
    subject: string | null,
    content: string,
    sentBy: string
  ): Promise<GoogleSheetsResponse> {
    return makeRequest('logMessage', {
      registrationNumber,
      messageType,
      recipient,
      subject,
      content,
      sentBy
    });
  }

  async updateMessageStatus(
    registrationNumbers: string[],
    messageType: 'email' | 'sms',
    status: string
  ): Promise<GoogleSheetsResponse> {
    return makeRequest('updateMessageStatus', {
      registrationNumbers: registrationNumbers.join(','),
      messageType,
      status
    });
  }

  // ==================== ENTREVISTAS ====================
  async getInterviewCandidates(): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewCandidates', {});
  }

  async moveToInterview(candidateIds: string[]): Promise<GoogleSheetsResponse> {
    return makeRequest('moveToInterview', {
      candidateIds: candidateIds.join(',')
    });
  }

  async getInterviewers(): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewers', {});
  }

  async getInterviewerCandidates(interviewerEmail: string): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewerCandidates', { interviewerEmail });
  }

  // ✅ Mantém a mesma assinatura de objeto
  async allocateToInterviewer(params: {
    candidateIds: string[];
    interviewerEmail: string;
    adminEmail: string;
  }): Promise<GoogleSheetsResponse> {
    return makeRequest('allocateToInterviewer', {
      candidateIds: params.candidateIds.join(','),
      interviewerEmail: params.interviewerEmail,
      adminEmail: params.adminEmail
    });
  }

  async updateInterviewStatus(
    registrationNumber: string,
    status: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    return makeRequest('updateInterviewStatus', {
      registrationNumber,
      status,
      interviewerEmail
    });
  }

  async saveInterviewEvaluation(evaluation: any): Promise<GoogleSheetsResponse> {
    return makeRequest('saveInterviewEvaluation', evaluation);
  }

  // ==================== RELATÓRIOS ====================
  async getReportStats(): Promise<GoogleSheetsResponse> {
    return makeRequest('getReportStats', {});
  }

  async getReport(
    reportType: string,
    analystEmail?: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    const params: any = { reportType };
    if (analystEmail) params.analystEmail = analystEmail;
    if (interviewerEmail) params.interviewerEmail = interviewerEmail;
    
    return makeRequest('getReport', params);
  }

  // ==================== USUÁRIOS ====================
  async getAnalysts(): Promise<GoogleSheetsResponse> {
    return makeRequest('getAnalysts', {});
  }

  async getUserRole(email: string): Promise<GoogleSheetsResponse> {
    return makeRequest('getUserRole', { email });
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const result = await this.getUserRole(email);
    if (result.success && result.data) {
      return {
        id: result.data.email,
        email: result.data.email,
        name: result.data.name || result.data.nome || result.data.email,
        role: result.data.role,
        active: true
      };
    }
    return null;
  }

  async getUserById(id: string): Promise<any | null> {
    return this.getUserByEmail(id);
  }

  // ==================== EMAIL ====================
  async getEmailAliases(): Promise<GoogleSheetsResponse> {
    return makeRequest('getEmailAliases', {});
  }

  // ==================== UTILITÁRIOS ====================
  async fetchCandidates(): Promise<any[]> {
    const result = await this.getCandidates();
    if (result.success && result.data) {
      return result.data.candidates || result.data || [];
    }
    return [];
  }

  async testConnection(): Promise<GoogleSheetsResponse> {
    return makeRequest('test', {});
  }

  async testCors(): Promise<GoogleSheetsResponse> {
    return makeRequest('testCors', {});
  }
}

// Instância única do serviço
export const googleSheetsService = new GoogleSheetsService();

// Função de teste rápido
export async function testGoogleSheetsConnection() {
  console.log('🧪 Testando conexão com Google Sheets...');
  
  try {
    const result = await googleSheetsService.testConnection();
    console.log('🔗 Resultado do teste:', result);
    return result;
  } catch (error) {
    console.error('💥 Erro no teste de conexão:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
