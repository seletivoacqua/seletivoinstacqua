import { cacheService } from './cacheService';
import { requestDeduplicator } from './requestDeduplication';
import { performanceMonitor } from './performanceMonitor';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxfl0gWq3-dnZmYcz5AIHkpOyC1XdRb8QdaMRQTQZnn5sqyQZvV3qhCevhXuFHGYBk0/exec';

interface GoogleSheetsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

interface RequestOptions {
  cache?: boolean;
  cacheTTL?: number;
  deduplicate?: boolean;
}

async function makeRequest(
  action: string,
  params: any = {},
  options: RequestOptions = {}
): Promise<GoogleSheetsResponse> {
  const {
    cache = true,
    cacheTTL = 30000,
    deduplicate = true
  } = options;

  const cacheKey = `${action}:${JSON.stringify(params)}`;
  const startTime = Date.now();

  if (cache) {
    const cached = cacheService.get<GoogleSheetsResponse>(cacheKey);
    if (cached) {
      const duration = Date.now() - startTime;
      performanceMonitor.logRequest(action, duration, true);
      return cached;
    }
  }

  const executeRequest = async (): Promise<GoogleSheetsResponse> => {
    try {
      const queryParams = new URLSearchParams({ action, ...params });
      const url = `${SCRIPT_URL}?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (cache && data.success) {
        cacheService.set(cacheKey, data, cacheTTL);
      }

      const duration = Date.now() - startTime;
      performanceMonitor.logRequest(action, duration, false);

      return data;
    } catch (error) {
      console.error(`Erro na requisição ${action}:`, error);
      const duration = Date.now() - startTime;
      performanceMonitor.logRequest(action, duration, false);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na requisição'
      };
    }
  };

  if (deduplicate) {
    return requestDeduplicator.deduplicate(cacheKey, executeRequest);
  }

  return executeRequest();
}

export const googleSheetsService = {
  async getCandidates(filters?: any): Promise<GoogleSheetsResponse> {
    return makeRequest('getCandidates', filters);
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
    const result = await makeRequest('updateCandidateStatus', {
      registrationNumber,
      statusTriagem,
      ...options
    }, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getCandidates/);
      cacheService.invalidatePattern(/getCandidatesByStatus/);
      cacheService.invalidatePattern(/getReportStats/);
    }

    return result;
  },

  async getCandidatesByStatus(status: 'Classificado' | 'Desclassificado' | 'Revisar'): Promise<GoogleSheetsResponse> {
    console.log('📊 getCandidatesByStatus - Status:', status);
    const result = await makeRequest('getCandidatesByStatus', { status });
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
    return makeRequest('logMessage', {
      registrationNumber,
      messageType,
      recipient,
      subject,
      content,
      sentBy
    });
  },

  async getDisqualificationReasons(): Promise<GoogleSheetsResponse> {
    return makeRequest('getDisqualificationReasons');
  },

  async getMessageTemplates(messageType?: 'email' | 'sms'): Promise<GoogleSheetsResponse> {
    return makeRequest('getMessageTemplates', { messageType });
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

    const result = await makeRequest('sendMessages', {
      messageType,
      subject: subject || '',
      content,
      candidateIds,
      sentBy,
      fromAlias
    }, { cache: false, deduplicate: false });

    console.log('📦 Resposta recebida:', result);
    return result;
  },

  async updateMessageStatus(
    registrationNumbers: string[],
    messageType: 'email' | 'sms',
    status: string
  ): Promise<GoogleSheetsResponse> {
    const result = await makeRequest('updateMessageStatus', {
      registrationNumbers: registrationNumbers.join(','),
      messageType,
      status
    }, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getCandidates/);
    }

    return result;
  },

  async moveToInterview(candidateIds: string): Promise<GoogleSheetsResponse> {
    const result = await makeRequest('moveToInterview', { candidateIds }, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getCandidates/);
      cacheService.invalidatePattern(/getInterviewCandidates/);
    }

    return result;
  },

  async getInterviewCandidates(): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewCandidates');
  },

  async getInterviewers(): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewers');
  },

  async allocateToInterviewer(
    candidateIds: string,
    interviewerEmail: string,
    adminEmail: string
  ): Promise<GoogleSheetsResponse> {
    const result = await makeRequest('allocateToInterviewer', {
      candidateIds,
      interviewerEmail,
      adminEmail
    }, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getInterviewCandidates/);
      cacheService.invalidatePattern(/getInterviewerCandidates/);
    }

    return result;
  },

  async getInterviewerCandidates(interviewerEmail: string): Promise<GoogleSheetsResponse> {
    return makeRequest('getInterviewerCandidates', { interviewerEmail });
  },

  async saveInterviewEvaluation(evaluation: any): Promise<GoogleSheetsResponse> {
    const result = await makeRequest('saveInterviewEvaluation', evaluation, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getInterviewerCandidates/);
      cacheService.invalidatePattern(/getInterviewCandidates/);
      cacheService.invalidatePattern(/getReportStats/);
    }

    return result;
  },

  async getReportStats(): Promise<GoogleSheetsResponse> {
    return makeRequest('getReportStats');
  },

  async getReport(
    reportType: string,
    analystEmail?: string,
    interviewerEmail?: string
  ): Promise<GoogleSheetsResponse> {
    const params: any = { reportType };
    if (analystEmail) params.analystEmail = analystEmail;
    if (interviewerEmail) params.interviewerEmail = interviewerEmail;
    return makeRequest('getReport', params);
  },

  async getEmailAliases(): Promise<GoogleSheetsResponse> {
    return makeRequest('getEmailAliases');
  },

  async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
    const result = await makeRequest('saveScreening', screeningData, { cache: false, deduplicate: false });

    if (result.success) {
      cacheService.invalidatePattern(/getCandidates/);
      cacheService.invalidatePattern(/getCandidatesByStatus/);
      cacheService.invalidatePattern(/getReportStats/);
    }

    return result;
  },

  async fetchCandidates(): Promise<any[]> {
    const result = await makeRequest('getCandidates');
    if (result.success && result.data) {
      return result.data.candidates || result.data || [];
    }
    return [];
  },

  async getAnalysts(): Promise<GoogleSheetsResponse> {
    return makeRequest('getAnalysts');
  }
};
