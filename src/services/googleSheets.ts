const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwbr9Vm-EJxPTxGEP12UtwWfeKTGU1LsCjnHxQzkY8a9AOOozLNeDKGcflIknT5_FOq/exec';

interface GoogleSheetsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class GoogleSheetsService {
  private async makeRequest(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<GoogleSheetsResponse> {
    try {
      console.log(`📤 ${method} ${action}:`, params);

      let url = SCRIPT_URL;
      let options: RequestInit = {
        method: method,
        headers: {
          'Accept': 'application/json',
        },
      };

      if (method === 'POST') {
        // POST com JSON no body
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json',
        };
        options.body = JSON.stringify({
          action,
          ...params
        });
      } else {
        // GET com query parameters
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null) {
            queryParams.append(key, String(params[key]));
          }
        });
        queryParams.append('action', action);
        url = `${url}?${queryParams.toString()}`;
      }

      const response = await fetch(url, options);

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

  // ==================== CANDIDATOS ====================
  async getCandidates(filters?: any): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getCandidates', filters, 'GET');
  }

  async getCandidatesByStatus(status: 'Classificado' | 'Desclassificado' | 'Revisar'): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getCandidatesByStatus', { status }, 'GET');
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
    return this.makeRequest('updateCandidateStatus', {
      registrationNumber,
      statusTriagem,
      ...options
    }, 'POST');
  }

  async assignCandidates(candidateIds: string[], analystEmail: string, adminEmail: string): Promise<GoogleSheetsResponse> {
    return this.makeRequest('assignCandidates', {
      candidateIds: candidateIds.join(','),
      analystEmail,
      adminEmail
    }, 'POST');
  }

  // ==================== TRIAGEM ====================
  async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
    return this.makeRequest('saveScreening', screeningData, 'POST');
  }

  // ==================== MENSAGENS ====================
  async getMessageTemplates(messageType?: 'email' | 'sms'): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getMessageTemplates', { messageType }, 'GET');
  }

  async getDisqualificationReasons(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getDisqualificationReasons', {}, 'GET');
  }

  async sendMessages(
    messageType: 'email' | 'sms',
    subject: string,
    content: string,
    candidateIds: string[],
    sentBy: string,
    fromAlias?: string
  ): Promise<GoogleSheetsResponse> {
    return this.makeRequest('sendMessages', {
      messageType,
      subject: subject || '',
      content,
      candidateIds: candidateIds.join(','),
      sentBy,
      fromAlias
    }, 'POST');
  }

  async logMessage(
    registrationNumber: string,
    messageType: 'email' | 'sms',
    recipient: string,
    subject: string | null,
    content: string,
    sentBy: string
  ): Promise<GoogleSheetsResponse> {
    return this.makeRequest('logMessage', {
      registrationNumber,
      messageType,
      recipient,
      subject,
      content,
      sentBy
    }, 'POST');
  }

  async updateMessageStatus(
    registrationNumbers: string[],
    messageType: 'email' | 'sms',
    status: string
  ): Promise<GoogleSheetsResponse> {
    return this.makeRequest('updateMessageStatus', {
      registrationNumbers: registrationNumbers.join(','),
      messageType,
      status
    }, 'POST');
  }

  // ==================== ENTREVISTAS ====================
  async getInterviewCandidates(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getInterviewCandidates', {}, 'GET');
  }

  async moveToInterview(candidateIds: string[]): Promise<GoogleSheetsResponse> {
    return this.makeRequest('moveToInterview', {
      candidateIds: candidateIds.join(',')
    }, 'POST');
  }

  async getInterviewers(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getInterviewers', {}, 'GET');
  }

  async getInterviewerCandidates(interviewerEmail: string): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getInterviewerCandidates', { interviewerEmail }, 'GET');
  }

  // ✅ CORREÇÃO: Agora recebe um objeto em vez de parâmetros separados
  async allocateToInterviewer(params: {
    candidateIds: string[];
    interviewerEmail: string;
    adminEmail: string;
  }): Promise<GoogleSheetsResponse> {
    return this.makeRequest('allocateToInterviewer', {
      candidateIds: params.candidateIds.join(','),
      interviewerEmail: params.interviewerEmail,
      adminEmail: params.adminEmail
    }, 'POST');
  }

  async updateInterviewStatus(
    registrationNumber: string,
    status: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    return this.makeRequest('updateInterviewStatus', {
      registrationNumber,
      status,
      interviewerEmail
    }, 'POST');
  }

  async saveInterviewEvaluation(evaluation: any): Promise<GoogleSheetsResponse> {
    return this.makeRequest('saveInterviewEvaluation', evaluation, 'POST');
  }

  // ==================== RELATÓRIOS ====================
  async getReportStats(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getReportStats', {}, 'GET');
  }

  async getReport(
    reportType: string,
    analystEmail?: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    const params: any = { reportType };
    if (analystEmail) params.analystEmail = analystEmail;
    if (interviewerEmail) params.interviewerEmail = interviewerEmail;
    
    return this.makeRequest('getReport', params, 'GET');
  }

  // ==================== USUÁRIOS ====================
  async getAnalysts(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getAnalysts', {}, 'GET');
  }

  async getUserRole(email: string): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getUserRole', { email }, 'GET');
  }

  // ==================== EMAIL ====================
  async getEmailAliases(): Promise<GoogleSheetsResponse> {
    return this.makeRequest('getEmailAliases', {}, 'GET');
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
    return this.makeRequest('test', {}, 'GET');
  }
}

// Instância única do serviço
export const googleSheetsService = new GoogleSheetsService();

// Função de teste rápido para debug
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

// Função para testar o salvamento de avaliação
export async function testSaveEvaluation(candidateId: string, interviewerEmail: string) {
  console.log('🧪 Testando salvamento de avaliação...');
  
  const testEvaluation = {
    candidateId,
    interviewerEmail,
    formacao_adequada: 3,
    graduacoes_competencias: 4,
    descricao_processos: 3,
    terminologia_tecnica: 4,
    calma_clareza: 5,
    escalas_flexiveis: 5,
    adaptabilidade_mudancas: 5,
    ajustes_emergencia: 5,
    residencia: 8,
    resolucao_conflitos: 4,
    colaboracao_equipe: 5,
    adaptacao_perfis: 4,
    impressao_perfil: 'Candidato teste com bom perfil técnico e boa comunicação.',
    resultado: 'Classificado'
  };

  try {
    const result = await googleSheetsService.saveInterviewEvaluation(testEvaluation);
    console.log('📝 Resultado do teste de avaliação:', result);
    return result;
  } catch (error) {
    console.error('💥 Erro no teste de avaliação:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
