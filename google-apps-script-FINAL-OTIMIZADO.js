// ============================================
// GOOGLE APPS SCRIPT - SISTEMA DE TRIAGEM COMPLETO
// VERSÃO OTIMIZADA PARA 5000+ CANDIDATOS
// Data: 2025
// ============================================

const CACHE_TTL = 60;
const CACHE_KEYS = {
  REPORT_DATA: 'report_data_v3',
  USERS: 'users_data_v3',
  STATS: 'stats_data_v3',
  INTERVIEWERS: 'interviewers_v3',
  REASONS: 'disqualification_reasons_v3'
};

// ============================================
// SERVIÇO DE CACHE AVANÇADO
// ============================================

class AdvancedCacheService {
  static getCache() {
    return CacheService.getScriptCache();
  }

  static getLock() {
    return LockService.getScriptLock();
  }

  static safeStringify(obj) {
    return JSON.stringify(obj, (key, value) =>
      value === undefined ? null : value
    );
  }

  static safeParse(str) {
    try {
      return str ? JSON.parse(str) : null;
    } catch (e) {
      console.warn('Cache parse error:', e);
      return null;
    }
  }

  static get(key) {
    const cached = this.getCache().get(key);
    return this.safeParse(cached);
  }

  static set(key, data, ttl = CACHE_TTL) {
    try {
      this.getCache().put(key, this.safeStringify(data), ttl);
      return true;
    } catch (error) {
      console.warn('Cache set error:', error);
      return false;
    }
  }

  static getWithFallback(key, fetchFunction, ttl = CACHE_TTL) {
    let data = this.get(key);

    if (data !== null) {
      console.log('Cache hit:', key);
      return data;
    }

    const lock = this.getLock();

    if (lock.tryLock(10000)) {
      try {
        data = this.get(key);
        if (data !== null) {
          console.log('Cache hit após lock:', key);
          return data;
        }

        console.log('Cache miss + lock adquirido - executando fetch:', key);
        data = fetchFunction();

        this.set(key, data, ttl);
        console.log('Cache atualizado com sucesso:', key);
      } catch (error) {
        console.error('Erro crítico no fetchFunction:', error);
      } finally {
        lock.releaseLock();
      }
    } else {
      console.warn('Lock não adquirido, retornando dados antigos ou nulos:', key);
      data = this.get(key) || fetchFunction();
    }

    return data;
  }
}

// ============================================
// CONFIGURAÇÕES GLOBAIS
// ============================================

const SPREADSHEET_ID = '1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY';
const SHEET_USUARIOS = 'USUARIOS';
const SHEET_CANDIDATOS = 'CANDIDATOS';
const SHEET_MOTIVOS = 'MOTIVOS';
const SHEET_MENSAGENS = 'MENSAGENS';
const SHEET_TEMPLATES = 'TEMPLATES';

const HEADER_ROWS = 1;
const COL_ID_PRIMARY = 'CPF';
const COL_ID_ALT = 'Número de Inscrição';

// ============================================
// FUNÇÕES AUXILIARES OTIMIZADAS
// ============================================

function _ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function _sheet(name) {
  return _ss().getSheetByName(name);
}

function _getHeaders_(sh) {
  const lastCol = sh.getLastColumn();
  return (lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : []);
}

function _colMap_(headers) {
  const m = {};
  headers.forEach((h, i) => m[h] = i);
  return m;
}

// ✅ OTIMIZADO: Busca sem carregar toda a planilha
function _findRowByValue_(sh, colIndex, searchValue) {
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return null;

  // Método 1: TextFinder (mais rápido)
  try {
    const column = sh.getRange(HEADER_ROWS + 1, colIndex + 1, lastRow - HEADER_ROWS, 1);
    const finder = column.createTextFinder(String(searchValue).trim());
    const result = finder.findNext();

    if (result) {
      return result.getRow();
    }
  } catch (e) {
    Logger.log('TextFinder falhou, usando busca em chunks:', e);
  }

  // Método 2: Busca em chunks (fallback)
  const chunkSize = 500;
  for (let start = HEADER_ROWS + 1; start <= lastRow; start += chunkSize) {
    const rows = Math.min(chunkSize, lastRow - start + 1);
    const values = sh.getRange(start, colIndex + 1, rows, 1).getValues();

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(searchValue).trim()) {
        return start + i;
      }
    }
  }

  return null;
}

// ✅ OTIMIZADO: Atualiza apenas colunas necessárias
function _updateRowColumns_(sh, row, colUpdates) {
  for (const [colIndex, value] of Object.entries(colUpdates)) {
    sh.getRange(row, parseInt(colIndex) + 1).setValue(value);
  }
}

// ✅ OTIMIZADO: Leitura em chunks para grandes volumes
function _readSheetInChunks_(name, chunkSize = 1000) {
  const sh = _sheet(name);
  if (!sh) return { sheet: null, headers: [], processChunk: null };

  const headers = _getHeaders_(sh);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow <= HEADER_ROWS || lastCol === 0) {
    return { sheet: sh, headers, processChunk: null };
  }

  return {
    sheet: sh,
    headers,
    processChunk: function(callback) {
      for (let start = HEADER_ROWS + 1; start <= lastRow; start += chunkSize) {
        const rows = Math.min(chunkSize, lastRow - start + 1);
        const values = sh.getRange(start, 1, rows, lastCol).getValues();

        for (let i = 0; i < values.length; i++) {
          const shouldContinue = callback(values[i], start + i);
          if (shouldContinue === false) return;
        }
      }
    }
  };
}

// ============================================
// CORS E ROTEAMENTO
// ============================================

function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    let action, params;

    if (e && e.postData && e.postData.contents) {
      try {
        const data = JSON.parse(e.postData.contents);
        action = data.action;
        params = data;
      } catch (parseError) {
        Logger.log('Erro ao fazer parse do JSON: ' + parseError);
        return createCorsResponse({
          success: false,
          error: 'JSON inválido: ' + parseError.toString()
        });
      }
    } else if (e && e.parameter) {
      action = e.parameter.action;
      params = e.parameter;
    } else {
      return createCorsResponse({
        success: false,
        error: 'Requisição inválida: parâmetros não encontrados'
      });
    }

    Logger.log('🔄 Ação recebida: ' + action);

    const actions = {
      'getUserRole': () => getUserRole(params),
      'getAnalysts': () => getAnalysts(params),
      'getCandidates': () => getCandidates(params),
      'assignCandidates': () => assignCandidates(params),
      'updateCandidateStatus': () => updateCandidateStatus(params),
      'getCandidatesByStatus': () => getCandidatesByStatus(params),
      'logMessage': () => logMessage(params),
      'getDisqualificationReasons': () => getDisqualificationReasons(),
      'getMessageTemplates': () => getMessageTemplates(params),
      'sendMessages': () => sendMessages(params),
      'updateMessageStatus': () => updateMessageStatus(params),
      'moveToInterview': () => moveToInterview(params),
      'getInterviewCandidates': () => getInterviewCandidates(params),
      'getInterviewers': () => getInterviewers(params),
      'getInterviewerCandidates': () => getInterviewerCandidates(params),
      'allocateToInterviewer': () => allocateToInterviewer(params),
      'updateInterviewStatus': () => updateInterviewStatus(params),
      'saveInterviewEvaluation': () => saveInterviewEvaluation(params),
      'getReportStats': () => getReportStats(params),
      'getReport': () => getReport(params),
      'getEmailAliases': () => getEmailAliases(),
      'saveScreening': () => saveScreening(params),
      'test': () => testConnection()
    };

    if (actions[action]) {
      try {
        const result = actions[action]();
        Logger.log('✅ Resultado: ' + JSON.stringify(result).substring(0, 200));
        return createCorsResponse({ success: true, data: result });
      } catch (actionError) {
        Logger.log('❌ Erro ao executar ação ' + action + ': ' + actionError.toString());
        return createCorsResponse({
          success: false,
          error: actionError.message || actionError.toString()
        });
      }
    } else {
      Logger.log('❌ Ação não encontrada: ' + action);
      return createCorsResponse({
        success: false,
        error: 'Ação não encontrada: ' + action
      });
    }
  } catch (error) {
    Logger.log('❌ Erro no handleRequest: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return createCorsResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

// ============================================
// FUNÇÕES DE USUÁRIOS
// ============================================

function initUsuariosSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USUARIOS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USUARIOS);
    sheet.getRange('A1:D1').setValues([['Email', 'Nome', 'Role', 'ID']]);
    const defaultUsers = [
      ['admin@email.com', 'Administrador', 'admin', 'admin@email.com'],
      ['analista@email.com', 'Analista', 'analista', 'analista@email.com']
    ];
    sheet.getRange(2, 1, defaultUsers.length, 4).setValues(defaultUsers);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  }
  return sheet;
}

function getUserRole(params) {
  try {
    const sheet = initUsuariosSheet();
    const data = sheet.getDataRange().getValues();
    const emailToFind = params.email ? params.email.toLowerCase().trim() : '';

    if (!emailToFind) {
      throw new Error('Email é obrigatório');
    }

    Logger.log('🔍 Procurando usuário: ' + emailToFind);

    for (let i = 1; i < data.length; i++) {
      const emailInSheet = data[i][0] ? data[i][0].toLowerCase().trim() : '';
      if (emailInSheet === emailToFind) {
        const rawRole = data[i][2];
        const normalizedRole = rawRole ? String(rawRole).toLowerCase().trim() : '';

        Logger.log('✅ Usuário encontrado: ' + emailInSheet + ' | Role: ' + normalizedRole);

        return {
          email: data[i][0],
          name: data[i][1] || data[i][0],
          role: normalizedRole,
          id: data[i][3] || data[i][0],
          active: true
        };
      }
    }

    Logger.log('❌ Usuário não encontrado: ' + emailToFind);
    throw new Error('Usuário não encontrado');
  } catch (error) {
    Logger.log('❌ Erro em getUserRole: ' + error.toString());
    throw error;
  }
}

function getAnalysts(params) {
  try {
    Logger.log('🔍 getAnalysts - Iniciando busca de analistas');
    const sheet = initUsuariosSheet();
    const data = sheet.getDataRange().getValues();
    Logger.log('📊 Total de linhas na planilha USUARIOS: ' + data.length);

    const analysts = [];

    for (let i = 1; i < data.length; i++) {
      const rawRole = data[i][2];
      const normalizedRole = rawRole ? String(rawRole).toLowerCase().trim() : '';

      if (normalizedRole === 'analista') {
        const analyst = {
          id: data[i][3] || data[i][0],
          email: data[i][0],
          name: data[i][1] || data[i][0],
          role: normalizedRole,
          active: true
        };
        analysts.push(analyst);
        Logger.log('✅ Analista encontrado: ' + analyst.email);
      }
    }

    Logger.log('📋 Total de analistas encontrados: ' + analysts.length);
    return { analysts: analysts };
  } catch (error) {
    Logger.log('❌ Erro em getAnalysts: ' + error.toString());
    throw error;
  }
}

// ============================================
// FUNÇÕES DE CANDIDATOS - OTIMIZADAS
// ============================================

function getCandidates(params) {
  const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
  if (!result.sheet || !result.processChunk) return { candidates: [] };

  const candidates = [];

  result.processChunk((row, rowNum) => {
    const obj = {};
    for (let j = 0; j < result.headers.length; j++) {
      obj[result.headers[j]] = row[j];
    }
    candidates.push(obj);
  });

  Logger.log(`✅ getCandidates retornou ${candidates.length} candidatos`);
  return { candidates: candidates };
}

function updateCandidateStatus(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  const statusCol = col['Status'];
  const cpfCol = col['CPF'];
  const regNumCol = col['Número de Inscrição'] ?? col['NUMEROINSCRICAO'];
  const analystCol = col['Analista'] ?? col['assigned_to'];
  const dateCol = col['Data Triagem'] ?? col['data_hora_triagem'];
  const reasonCol = col['Motivo Desclassificação'];
  const notesCol = col['Observações'] ?? col['screening_notes'];

  const searchKey = String(params.registrationNumber).trim();

  let row = _findRowByValue_(sh, cpfCol, searchKey);
  if (!row && regNumCol >= 0) {
    row = _findRowByValue_(sh, regNumCol, searchKey);
  }

  if (!row) throw new Error('Candidato não encontrado');

  const updates = {};
  if (statusCol >= 0) updates[statusCol] = params.statusTriagem;
  if (analystCol >= 0 && params.analystEmail) updates[analystCol] = params.analystEmail;
  if (dateCol >= 0) updates[dateCol] = getCurrentTimestamp();
  if (reasonCol >= 0 && params.reasonId) updates[reasonCol] = getDisqualificationReasonById(params.reasonId);
  if (notesCol >= 0 && params.notes) updates[notesCol] = params.notes;

  _updateRowColumns_(sh, row, updates);

  return { success: true, message: 'Status atualizado' };
}

function getCandidatesByStatus(params) {
  const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
  if (!result.sheet || !result.processChunk) return [];

  const col = _colMap_(result.headers);
  const statusCol = col['Status'];
  const cpfCol = col['CPF'];
  const emailSentCol = col['EMAIL_SENT'];
  const smsSentCol = col['SMS_SENT'];

  const filtered = [];

  result.processChunk((row, rowNum) => {
    if (row[statusCol] === params.status) {
      const obj = {};
      for (let j = 0; j < result.headers.length; j++) {
        obj[result.headers[j]] = row[j];
      }
      obj.id = row[cpfCol];
      obj.registration_number = row[cpfCol];

      obj.email_sent = emailSentCol >= 0 ? (row[emailSentCol] === 'Sim' || row[emailSentCol] === true || row[emailSentCol] === 'TRUE') : false;
      obj.sms_sent = smsSentCol >= 0 ? (row[smsSentCol] === 'Sim' || row[smsSentCol] === true || row[smsSentCol] === 'TRUE') : false;

      filtered.push(obj);
    }
  });

  Logger.log(`✅ getCandidatesByStatus retornou ${filtered.length} candidatos`);
  return filtered;
}

function assignCandidates(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  const cpfCol = col['CPF'];
  const assignedToCol = col['assigned_to'];
  const assignedByCol = col['assigned_by'];
  const assignedAtCol = col['assigned_at'];
  const statusCol = col['Status'];

  if (cpfCol == null) throw new Error('Coluna CPF não encontrada');

  const targetIds = String(params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const stamp = getCurrentTimestamp();
  let count = 0;

  for (const id of targetIds) {
    const row = _findRowByValue_(sh, cpfCol, id);
    if (!row) {
      Logger.log(`⚠️ CPF não encontrado: ${id}`);
      continue;
    }

    const updates = {};
    if (assignedToCol != null) updates[assignedToCol] = params.analystEmail || '';
    if (assignedByCol != null) updates[assignedByCol] = params.adminEmail || '';
    if (assignedAtCol != null) updates[assignedAtCol] = stamp;
    if (statusCol != null) updates[statusCol] = 'em_analise';

    _updateRowColumns_(sh, row, updates);
    count++;
  }

  return { success: true, assignedCount: count, message: `${count} candidatos alocados com sucesso` };
}

// ============================================
// LOG DE MENSAGENS
// ============================================

function initMensagensSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MENSAGENS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MENSAGENS);
    sheet.getRange('A1:H1').setValues([
      ['Data/Hora', 'Número Inscrição', 'Tipo', 'Destinatário', 'Assunto', 'Conteúdo', 'Enviado Por', 'Status']
    ]);
  }

  return sheet;
}

function logMessage(params) {
  try {
    const sheet = initMensagensSheet();
    const newRow = [
      getCurrentTimestamp(),
      params.registrationNumber,
      params.messageType,
      params.recipient,
      params.subject || '',
      params.content,
      params.sentBy,
      params.status || 'pendente'
    ];
    sheet.appendRow(newRow);
    return { success: true };
  } catch (error) {
    Logger.log('❌ Erro em logMessage: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// ============================================
// MOTIVOS DE DESCLASSIFICAÇÃO
// ============================================

function initMotivosSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MOTIVOS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MOTIVOS);
    sheet.getRange('A1:D1').setValues([['ID', 'Motivo', 'Tipo', 'Ativo']]);
    sheet.setFrozenRows(1);
  }

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 4).clearContent();

  const motivosFixos = [
    ['M001', 'Fora do prazo de inscrição', 'Fixo', 'Sim'],
    ['M002', 'Vaga preenchida internamente', 'Fixo', 'Sim'],
    ['M003', 'Desistência do candidato', 'Fixo', 'Sim'],
    ['M099', 'Outros (especificar em observações)', 'Fixo', 'Sim']
  ];

  const mapaNaoConformidade = {
    'checkrg-cpf': 'Documentação de RG/CPF irregular ou ausente',
    'check-cnh': 'CNH inválida, suspensa ou ausente',
    'check-experiencia': 'Experiência insuficiente ou não comprovada',
    'check-regularidade': 'Irregularidade em antecedentes ou documentação',
    'check-laudo': 'Laudo médico ausente ou inválido (PCD)',
    'check-curriculo': 'Currículo incompleto ou incompatível com a vaga'
  };

  const motivosDinamicos = Object.entries(mapaNaoConformidade)
    .map(([key, texto], i) => [`D${String(i + 1).padStart(3, '0')}`, texto, 'Dinâmico', 'Sim']);

  const todos = [...motivosFixos, ...motivosDinamicos];

  if (todos.length > 0) {
    sheet.getRange(2, 1, todos.length, 4).setValues(todos);
  }

  sheet.autoResizeColumns(1, 4);
  Logger.log(`Aba ${SHEET_MOTIVOS} criada/atualizada: ${motivosFixos.length} fixos + ${motivosDinamicos.length} dinâmicos`);
}

function getDisqualificationReasons() {
  return AdvancedCacheService.getWithFallback(
    CACHE_KEYS.REASONS || 'disqualification_reasons_v4',
    () => {
      try {
        let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MOTIVOS);
        if (!sheet || sheet.getLastRow() <= 1) {
          initMotivosSheet();
          sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MOTIVOS);
        }

        const data = sheet.getDataRange().getValues();
        const reasons = [];

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const id = String(row[0] || '').trim();
          const motivo = String(row[1] || '').trim();
          const tipo = String(row[2] || 'Fixo').trim();
          const ativo = String(row[3] || 'Sim').toLowerCase() === 'sim';

          if (id && motivo && ativo) {
            reasons.push({
              id,
              reason: motivo,
              type: tipo.toLowerCase(),
              is_active: true
            });
          }
        }

        reasons.sort((a, b) => {
          if (a.type === b.type) return a.reason.localeCompare(b.reason);
          return a.type === 'fixo' ? -1 : 1;
        });

        return reasons;

      } catch (error) {
        Logger.log('Erro crítico ao carregar motivos: ' + error);
        return [
          { id: 'M099', reason: 'Outros (especificar em observações)', type: 'fixo', is_active: true }
        ];
      }
    },
    600
  );
}

function getDisqualificationReasonById(reasonId) {
  const reasons = getDisqualificationReasons();
  const reason = reasons.find(r => r.id === reasonId);
  return reason ? reason.reason : 'Motivo não especificado';
}

// ============================================
// TEMPLATES
// ============================================

function initTemplatesSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_TEMPLATES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TEMPLATES);
    sheet.getRange('A1:E1').setValues([['ID', 'Nome', 'Tipo', 'Assunto', 'Conteúdo']]);

    const templates = [
      ['T001', 'Classificado - Email', 'email', 'Atualização do Processo Seletivo - Classificação',
       'Prezado(a) [NOME],\n\nTemos o prazer de informar que seu perfil foi classificado no processo seletivo para a vaga de [CARGO] na área de [AREA].\n\nNossa equipe entrará em contato em breve para dar continuidade ao processo.\n\nAgradecemos seu interesse e desejamos sucesso nesta etapa.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção\n\n--\nEste e-mail foi enviado automaticamente. Por favor, não responda esta mensagem.'],

      ['T002', 'Classificado - SMS', 'sms', '',
       'Olá [NOME]! Seu perfil foi classificado no processo para [CARGO]. Aguarde nosso contato para próximos passos.'],

      ['T003', 'Desclassificado - Email', 'email', 'Atualização do Processo Seletivo',
       'Prezado(a) [NOME],\n\nAgradecemos sinceramente seu interesse em fazer parte de nossa equipe e pelo tempo dedicado ao processo seletivo para a vaga de [CARGO].\n\nInformamos que, após análise criteriosa, seu perfil não foi selecionado para prosseguir nesta oportunidade.\n\nSeu currículo permanecerá em nosso banco de dados para futuras oportunidades compatíveis com seu perfil.\n\nDesejamos sucesso em sua jornada profissional.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção\n\n--\nEste e-mail foi enviado automaticamente. Por favor, não responda esta mensagem.'],

      ['T004', 'Em Revisão - Email', 'email', 'Processo Seletivo - Análise em Andamento',
       'Prezado(a) [NOME],\n\nConfirmamos o recebimento de sua inscrição para a vaga de [CARGO].\n\nSeu cadastro está atualmente em análise por nossa equipe de recrutamento. O processo de triagem está em andamento e todas as inscrições estão sendo cuidadosamente avaliadas.\n\nVocê receberá uma atualização sobre o status assim que a análise for concluída.\n\nAgradecemos sua paciência e interesse em nossa organização.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção\n\n--\nEste e-mail foi enviado automaticamente. Por favor, não responda esta mensagem.'],

      ['T005', 'Convite para Entrevista - Email', 'email', 'Convite para Próxima Etapa do Processo Seletivo',
       'Prezado(a) [NOME],\n\nÉ com satisfação que convidamos você para a próxima etapa do processo seletivo para a vaga de [CARGO].\n\nSeu perfil foi selecionado entre diversos candidatos e gostaríamos de conhecê-lo(a) melhor.\n\nNossa equipe entrará em contato em breve para agendar a entrevista e fornecer todos os detalhes.\n\nContamos com sua participação!\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção\n\n--\nEste e-mail foi enviado automaticamente. Por favor, não responda esta mensagem.']
    ];

    sheet.getRange(2, 1, templates.length, 5).setValues(templates);
    sheet.autoResizeColumns(1, 5);
    sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#f3f3f3');
  }

  return sheet;
}

function getMessageTemplates(params) {
  const sheet = initTemplatesSheet();
  const data = sheet.getDataRange().getValues();
  const templates = [];

  for (let i = 1; i < data.length; i++) {
    const messageType = params && params.messageType ? params.messageType : null;
    if (!messageType || data[i][2] === messageType) {
      templates.push({
        id: data[i][0],
        template_name: data[i][1],
        message_type: data[i][2],
        subject: data[i][3],
        content: data[i][4]
      });
    }
  }
  return templates;
}

// ============================================
// FUNÇÕES AUXILIARES PARA EMAIL
// ============================================

function getEmailAliases() {
  try {
    const aliases = GmailApp.getAliases();
    Logger.log('📧 Aliases disponíveis: ' + JSON.stringify(aliases));
    return aliases;
  } catch (error) {
    Logger.log('❌ Erro ao buscar aliases: ' + error.toString());
    return [];
  }
}

function _getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function _twilioEnabled_() {
  return !!(_getProp_('TWILIO_SID') && _getProp_('TWILIO_TOKEN') && _getProp_('TWILIO_FROM'));
}

function _formatE164_(phone) {
  if (!phone) return '';

  try {
    let cleaned = String(phone).replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');

    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    if (cleaned.length < 12) {
      throw new Error('Número muito curto: ' + cleaned);
    }

    if (cleaned.length > 13) {
      cleaned = cleaned.substring(0, 13);
    }

    return '+' + cleaned;

  } catch (error) {
    Logger.log('❌ Erro ao formatar telefone: ' + error.toString());
    return '';
  }
}

function _sendEmailGmail_(to, subject, body, alias) {
  try {
    Logger.log('📧 Enviando email para: ' + to);

    const options = {
      htmlBody: body,
      noReply: false,
      name: 'Processo Seletivo Instituto Acqua',
      replyTo: Session.getActiveUser().getEmail()
    };

    const aliases = GmailApp.getAliases();
    let finalAlias = null;

    if (alias && aliases.includes(alias)) {
      finalAlias = alias;
    } else if (aliases.length > 0) {
      finalAlias = aliases[0];
    }

    if (finalAlias) {
      options.from = finalAlias;
      options.replyTo = finalAlias;
    }

    GmailApp.sendEmail(to, subject, body, options);

    Logger.log('✅ Email enviado com sucesso');

    return {
      ok: true,
      from: options.from || Session.getActiveUser().getEmail(),
      displayName: 'Processo Seletivo Instituto Acqua',
      aliasUsed: !!finalAlias
    };

  } catch (e) {
    Logger.log('❌ Erro ao enviar email: ' + e.toString());

    try {
      GmailApp.sendEmail(to, subject, body, {
        name: 'Processo Seletivo Instituto Acqua'
      });
      return {
        ok: true,
        from: Session.getActiveUser().getEmail(),
        displayName: 'Processo Seletivo Instituto Acqua',
        fallback: true
      };
    } catch (fallbackError) {
      Logger.log('❌ Fallback também falhou: ' + fallbackError.toString());
    }

    return {
      ok: false,
      error: e.toString()
    };
  }
}

function _sendSmsTwilio_(to, body) {
  try {
    if (!_twilioEnabled_()) {
      Logger.log('⚠️ Twilio não configurado - SMS desabilitado');
      return {
        ok: false,
        skipped: true,
        error: 'Twilio não configurado.'
      };
    }

    if (!to) {
      throw new Error('Número de telefone é obrigatório');
    }

    const formattedTo = _formatE164_(to);

    if (!formattedTo.startsWith('+55') || formattedTo.length < 13) {
      throw new Error('Número de telefone brasileiro inválido: ' + formattedTo);
    }

    Logger.log('📱 Enviando SMS para: ' + formattedTo);

    const sid = _getProp_('TWILIO_SID');
    const token = _getProp_('TWILIO_TOKEN');
    const from = _getProp_('TWILIO_FROM');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

    const payload = {
      To: formattedTo,
      From: from,
      Body: body
    };

    const options = {
      method: 'POST',
      payload: payload,
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      const responseData = JSON.parse(responseText);
      Logger.log('✅ SMS enviado com sucesso - SID: ' + responseData.sid);
      return {
        ok: true,
        sid: responseData.sid,
        status: responseData.status
      };
    } else {
      Logger.log('❌ Erro Twilio: ' + responseText);
      return {
        ok: false,
        error: `Twilio HTTP ${responseCode}`,
        responseCode: responseCode
      };
    }

  } catch (error) {
    Logger.log('❌ Erro crítico ao enviar SMS: ' + error.toString());

    return {
      ok: false,
      error: 'Erro de conexão: ' + error.toString()
    };
  }
}

function _pickEmailFromRow_(headers, row) {
  const colMap = _colMap_(headers);
  const emailColumns = ['EMAIL', 'EMAIL1', 'EMAIL2', 'E_MAIL', 'E-MAIL'];

  for (const colName of emailColumns) {
    if (colMap[colName] >= 0) {
      const email = String(row[colMap[colName]]).trim();
      if (email && email.includes('@')) {
        return email;
      }
    }
  }

  return null;
}

function _pickPhoneFromRow_(headers, row) {
  const colMap = _colMap_(headers);
  const phoneColumns = ['TELEFONE', 'CELULAR', 'PHONE', 'TELEFONE1', 'CELULAR1'];

  for (const colName of phoneColumns) {
    if (colMap[colName] >= 0) {
      const phone = String(row[colMap[colName]]).trim();
      if (phone && phone.replace(/\D/g, '').length >= 10) {
        return phone;
      }
    }
  }

  return null;
}

function _applyTemplate_(text, candidate) {
  if (!text) return '';

  const cargos = [candidate.CARGOADMIN, candidate.CARGOASSIS].filter(Boolean).join(' | ') || '';

  return String(text)
    .replace(/\[NOME\]/g, candidate.NOMECOMPLETO || candidate.NOMESOCIAL || '')
    .replace(/\[CARGO\]/g, cargos)
    .replace(/\[AREA\]/g, candidate.AREAATUACAO || '');
}

// ============================================
// ENVIO DE MENSAGENS
// ============================================

function sendMessages(params) {
  Logger.log('📤 sendMessages iniciado');

  const messageType = params.messageType;
  const subject = params.subject || '';
  const content = params.content || '';
  const candidateIds = params.candidateIds || '';
  const sentBy = params.sentBy || 'system';
  const fromAlias = params.fromAlias || '';

  if (!content) {
    throw new Error('Conteúdo da mensagem é obrigatório');
  }

  if (messageType === 'email' && !subject) {
    throw new Error('Assunto é obrigatório para emails');
  }

  const result = _readSheetInChunks_(SHEET_CANDIDATOS, 500);
  if (!result.sheet) throw new Error('Planilha de candidatos não encontrada');

  const col = _colMap_(result.headers);
  const cpfCol = col['CPF'];

  const targetIds = candidateIds.split(',').map(s => s.trim()).filter(Boolean);
  const targetSet = new Set(targetIds);

  Logger.log('📋 Candidatos alvo: ' + targetIds.length);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  result.processChunk((row, rowNum) => {
    const cpf = String(row[cpfCol]).trim();

    if (!targetSet.has(cpf)) return;

    const candidate = {};
    for (let j = 0; j < result.headers.length; j++) {
      candidate[result.headers[j]] = row[j];
    }

    const nome = candidate.NOMECOMPLETO || candidate.NOMESOCIAL || 'Candidato';
    let recipient, sendResult;

    if (messageType === 'email') {
      recipient = _pickEmailFromRow_(result.headers, row);

      if (!recipient) {
        Logger.log('⚠️ Sem email: ' + nome);
        results.push({
          candidateId: cpf,
          candidateName: nome,
          success: false,
          error: 'Email não cadastrado'
        });
        failCount++;
        return;
      }

      const personalizedSubject = _applyTemplate_(subject, candidate);
      const personalizedContent = _applyTemplate_(content, candidate);

      sendResult = _sendEmailGmail_(recipient, personalizedSubject, personalizedContent, fromAlias);

      logMessage({
        registrationNumber: cpf,
        messageType: 'email',
        recipient: recipient,
        subject: personalizedSubject,
        content: personalizedContent,
        sentBy: sentBy,
        status: sendResult.ok ? 'enviado' : 'falhou'
      });

    } else if (messageType === 'sms') {
      recipient = _pickPhoneFromRow_(result.headers, row);

      if (!recipient) {
        Logger.log('⚠️ Sem telefone: ' + nome);
        results.push({
          candidateId: cpf,
          candidateName: nome,
          success: false,
          error: 'Telefone não cadastrado'
        });
        failCount++;
        return;
      }

      const personalizedContent = _applyTemplate_(content, candidate);
      sendResult = _sendSmsTwilio_(recipient, personalizedContent);

      if (sendResult.skipped) {
        results.push({
          candidateId: cpf,
          candidateName: nome,
          success: false,
          error: 'Twilio não configurado'
        });
        failCount++;
        return;
      }

      logMessage({
        registrationNumber: cpf,
        messageType: 'sms',
        recipient: recipient,
        subject: '',
        content: personalizedContent,
        sentBy: sentBy,
        status: sendResult.ok ? 'enviado' : 'falhou'
      });

    } else {
      throw new Error('Tipo de mensagem inválido: ' + messageType);
    }

    if (sendResult.ok) {
      successCount++;
      results.push({
        candidateId: cpf,
        candidateName: nome,
        success: true
      });

      _updateMessageStatusInCandidates_(cpf, messageType);
    } else {
      failCount++;
      results.push({
        candidateId: cpf,
        candidateName: nome,
        success: false,
        error: sendResult.error || 'Erro desconhecido'
      });
    }
  });

  Logger.log('✅ Sucesso: ' + successCount);
  Logger.log('❌ Falhas: ' + failCount);

  return {
    successCount: successCount,
    failCount: failCount,
    results: results
  };
}

function _updateMessageStatusInCandidates_(cpf, messageType) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    if (!sh) return;

    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const cpfCol = col['CPF'];

    let targetCol;
    if (messageType === 'email') {
      targetCol = col['EMAIL_SENT'];
    } else if (messageType === 'sms') {
      targetCol = col['SMS_SENT'];
    }

    if (targetCol === undefined || targetCol < 0) {
      Logger.log('⚠️ Coluna ' + (messageType === 'email' ? 'EMAIL_SENT' : 'SMS_SENT') + ' não encontrada');
      return;
    }

    const row = _findRowByValue_(sh, cpfCol, cpf);

    if (!row) {
      Logger.log('⚠️ Candidato não encontrado para atualizar status de mensagem: ' + cpf);
      return;
    }

    sh.getRange(row, targetCol + 1).setValue('Sim');
    Logger.log('✅ Status de mensagem atualizado para ' + cpf + ' - ' + messageType);

  } catch (error) {
    Logger.log('❌ Erro ao atualizar status de mensagem: ' + error.toString());
  }
}

function updateMessageStatus(params) {
  try {
    Logger.log('📝 updateMessageStatus iniciado');

    const registrationNumber = params.registrationNumber;
    const messageType = params.messageType;

    if (!registrationNumber) {
      throw new Error('Número de inscrição é obrigatório');
    }

    if (!messageType || (messageType !== 'email' && messageType !== 'sms')) {
      throw new Error('Tipo de mensagem inválido. Use "email" ou "sms"');
    }

    const sh = _sheet(SHEET_CANDIDATOS);
    if (!sh) {
      throw new Error('Planilha de candidatos não encontrada');
    }

    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const cpfCol = col['CPF'];
    const regNumCol = col['Número de Inscrição'];

    let targetCol;
    if (messageType === 'email') {
      targetCol = col['EMAIL_SENT'];
    } else if (messageType === 'sms') {
      targetCol = col['SMS_SENT'];
    }

    if (targetCol === undefined || targetCol < 0) {
      const colName = messageType === 'email' ? 'EMAIL_SENT' : 'SMS_SENT';
      throw new Error('Coluna ' + colName + ' não encontrada.');
    }

    const searchKey = String(registrationNumber).trim();
    let row = _findRowByValue_(sh, cpfCol, searchKey);
    if (!row && regNumCol >= 0) {
      row = _findRowByValue_(sh, regNumCol, searchKey);
    }

    if (!row) {
      throw new Error('Candidato não encontrado: ' + registrationNumber);
    }

    sh.getRange(row, targetCol + 1).setValue('Sim');

    Logger.log('✅ Status de mensagem atualizado: ' + registrationNumber + ' - ' + messageType + ' = Sim');

    return {
      success: true,
      message: 'Status de mensagem atualizado com sucesso',
      registrationNumber: registrationNumber,
      messageType: messageType,
      status: 'Sim'
    };

  } catch (error) {
    Logger.log('❌ Erro em updateMessageStatus: ' + error.toString());
    throw error;
  }
}

// ============================================
// FUNÇÕES DE ENTREVISTA
// ============================================

function getInterviewCandidates(params) {
  try {
    const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
    if (!result.sheet || !result.processChunk) return [];

    const col = _colMap_(result.headers);
    const statusEntrevistaCol = col['status_entrevista'];
    const cpfCol = col['CPF'];
    const regNumCol = col['Número de Inscrição'];
    const emailSentCol = col['EMAIL_SENT'];
    const smsSentCol = col['SMS_SENT'];

    if (statusEntrevistaCol === undefined) {
      Logger.log('⚠️ Coluna status_entrevista não encontrada');
      return [];
    }

    const candidates = [];

    result.processChunk((row, rowNum) => {
      const statusEntrevista = row[statusEntrevistaCol];

      if (statusEntrevista === 'Aguardando' || statusEntrevista === 'aguardando') {
        const candidate = {};
        result.headers.forEach((header, index) => {
          candidate[header] = row[index];
        });
        candidate.id = row[cpfCol] || row[regNumCol];
        candidate.registration_number = row[regNumCol] || row[cpfCol];

        candidate.email_sent = emailSentCol >= 0 ? (row[emailSentCol] === 'Sim' || row[emailSentCol] === true || row[emailSentCol] === 'TRUE') : false;
        candidate.sms_sent = smsSentCol >= 0 ? (row[smsSentCol] === 'Sim' || row[smsSentCol] === true || row[smsSentCol] === 'TRUE') : false;

        candidates.push(candidate);
      }
    });

    Logger.log('📋 Candidatos para entrevista: ' + candidates.length);
    return candidates;
  } catch (error) {
    Logger.log('❌ Erro em getInterviewCandidates: ' + error.toString());
    throw error;
  }
}

function moveToInterview(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const statusEntrevistaCol = col['status_entrevista'];
    const cpfCol = col['CPF'];
    const emailSentCol = col['EMAIL_SENT'];
    const smsSentCol = col['SMS_SENT'];

    if (statusEntrevistaCol === undefined || statusEntrevistaCol < 0) {
      throw new Error('Coluna status_entrevista não encontrada');
    }

    const candidateIds = String(params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
    Logger.log('📋 Movendo ' + candidateIds.length + ' candidatos para entrevista');

    let movedCount = 0;

    for (const cpf of candidateIds) {
      const row = _findRowByValue_(sh, cpfCol, cpf);
      if (!row) {
        Logger.log('⚠️ CPF não encontrado: ' + cpf);
        continue;
      }

      const hasEmail = emailSentCol >= 0 && sh.getRange(row, emailSentCol + 1).getValue() === 'Sim';
      const hasSms = smsSentCol >= 0 && sh.getRange(row, smsSentCol + 1).getValue() === 'Sim';

      if (!hasEmail && !hasSms) {
        Logger.log('⚠️ Candidato ' + cpf + ' não recebeu mensagens. Pulando.');
        continue;
      }

      sh.getRange(row, statusEntrevistaCol + 1).setValue('Aguardando');
      movedCount++;
      Logger.log('✅ ' + cpf + ' movido para entrevista');
    }

    Logger.log('✅ Total movidos: ' + movedCount);
    return {
      success: true,
      movedCount: movedCount,
      message: movedCount + ' candidato(s) movido(s) para entrevista'
    };
  } catch (error) {
    Logger.log('❌ Erro em moveToInterview: ' + error.toString());
    throw error;
  }
}

function getInterviewers(params) {
  try {
    const sheet = initUsuariosSheet();
    const data = sheet.getDataRange().getValues();
    const interviewers = [];

    for (let i = 1; i < data.length; i++) {
      const rawRole = data[i][2];
      const normalizedRole = rawRole ? String(rawRole).toLowerCase().trim() : '';

      if (normalizedRole === 'entrevistador') {
        interviewers.push({
          id: data[i][3] || data[i][0],
          email: data[i][0],
          name: data[i][1] || data[i][0],
          role: normalizedRole,
          active: true
        });
      }
    }

    Logger.log('👥 Entrevistadores encontrados: ' + interviewers.length);
    return interviewers;
  } catch (error) {
    Logger.log('❌ Erro em getInterviewers: ' + error.toString());
    throw error;
  }
}

function getInterviewerCandidates(params) {
  try {
    const interviewerEmail = params.interviewerEmail;

    if (!interviewerEmail) {
      throw new Error('Email do entrevistador é obrigatório');
    }

    Logger.log('🔍 Buscando candidatos do entrevistador: ' + interviewerEmail);

    const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
    if (!result.sheet || !result.processChunk) {
      Logger.log('⚠️ Nenhum candidato encontrado na planilha');
      return [];
    }

    const col = _colMap_(result.headers);
    const entrevistadorCol = col['entrevistador'];
    const cpfCol = col['CPF'];
    const regNumCol = col['Número de Inscrição'];

    if (entrevistadorCol === undefined || entrevistadorCol < 0) {
      Logger.log('⚠️ Coluna entrevistador não encontrada');
      return [];
    }

    const candidates = [];
    const normalizedEmail = interviewerEmail.toLowerCase().trim();

    result.processChunk((row, rowNum) => {
      const candidateInterviewer = row[entrevistadorCol];
      const normalizedInterviewer = candidateInterviewer ? String(candidateInterviewer).toLowerCase().trim() : '';

      if (normalizedInterviewer === normalizedEmail) {
        const candidate = {};
        result.headers.forEach((header, index) => {
          candidate[header] = row[index];
        });
        candidate.id = row[cpfCol] || row[regNumCol];
        candidate.registration_number = row[regNumCol] || row[cpfCol];

        candidates.push(candidate);
      }
    });

    Logger.log('✅ Candidatos encontrados para ' + interviewerEmail + ': ' + candidates.length);
    return candidates;
  } catch (error) {
    Logger.log('❌ Erro em getInterviewerCandidates: ' + error.toString());
    throw error;
  }
}

function allocateToInterviewer(params) {
  const startTime = Date.now();
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const entrevistadorCol = col['entrevistador'];
    const dataEntrevistaCol = col['data_entrevista'];
    const cpfCol = col['CPF'];

    if (entrevistadorCol === undefined) {
      throw new Error('Coluna "entrevistador" não encontrada na planilha');
    }

    const candidateIds = String(params.candidateIds || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const interviewerEmail = String(params.interviewerEmail || '').trim();

    if (candidateIds.length === 0) {
      return { success: false, error: 'Nenhum candidato selecionado' };
    }
    if (!interviewerEmail) {
      return { success: false, error: 'E-mail do entrevistador não informado' };
    }

    Logger.log(`Alocando ${candidateIds.length} candidato(s) para: ${interviewerEmail}`);

    const timestamp = getCurrentTimestamp();
    let allocatedCount = 0;

    for (const cpf of candidateIds) {
      const row = _findRowByValue_(sh, cpfCol, cpf);
      if (!row) {
        Logger.log(`CPF não encontrado: ${cpf}`);
        continue;
      }

      const updates = {};
      updates[entrevistadorCol] = interviewerEmail;
      if (dataEntrevistaCol !== undefined) {
        updates[dataEntrevistaCol] = timestamp;
      }

      _updateRowColumns_(sh, row, updates);
      allocatedCount++;
      Logger.log(`${cpf} → alocado para ${interviewerEmail}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    Logger.log(`Total alocados: ${allocatedCount} em ${elapsed}s`);

    return {
      success: true,
      allocatedCount,
      message: `${allocatedCount} candidato(s) alocado(s) com sucesso para ${interviewerEmail}`
    };

  } catch (error) {
    Logger.log('Erro crítico em allocateToInterviewer: ' + error.toString());
    Logger.log(error.stack);
    return {
      success: false,
      error: 'Falha ao alocar candidatos',
      details: error.toString()
    };
  }
}

function updateInterviewStatus(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const statusEntrevistaCol = col['status_entrevista'];
    const entrevistadorCol = col['entrevistador'];
    const dataEntrevistaCol = col['data_entrevista'];
    const cpfCol = col['CPF'];
    const regNumCol = col['Número de Inscrição'];

    const searchKey = String(params.registrationNumber).trim();
    let row = _findRowByValue_(sh, cpfCol, searchKey);
    if (!row && regNumCol >= 0) {
      row = _findRowByValue_(sh, regNumCol, searchKey);
    }

    if (!row) throw new Error('Candidato não encontrado');

    const updates = {};
    if (statusEntrevistaCol >= 0) updates[statusEntrevistaCol] = params.status;
    if (entrevistadorCol >= 0 && params.interviewerEmail) updates[entrevistadorCol] = params.interviewerEmail;
    if (dataEntrevistaCol >= 0) updates[dataEntrevistaCol] = getCurrentTimestamp();

    _updateRowColumns_(sh, row, updates);

    Logger.log('✅ Status de entrevista atualizado');
    return { success: true, message: 'Status atualizado' };
  } catch (error) {
    Logger.log('❌ Erro em updateInterviewStatus: ' + error.toString());
    throw error;
  }
}

function saveInterviewEvaluation(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const cpfCol = col['CPF'];
    const searchKey = String(params.candidateId).trim();

    let row = _findRowByValue_(sh, cpfCol, searchKey);

    if (!row) {
      Logger.log('❌ Candidato não encontrado: ' + searchKey);
      throw new Error('Candidato não encontrado: ' + searchKey);
    }

    Logger.log('📝 Salvando avaliação do candidato na linha: ' + row);

    const secao1 = (Number(params.formacao_adequada) + Number(params.graduacoes_competencias)) * 2;
    const secao2 = (Number(params.descricao_processos) + Number(params.terminologia_tecnica) + Number(params.calma_clareza)) * 2;
    const secao3 = Number(params.escalas_flexiveis) + Number(params.adaptabilidade_mudancas) + Number(params.ajustes_emergencia);
    const secao4 = Number(params.residencia);
    const secao5 = (Number(params.resolucao_conflitos) + Number(params.colaboracao_equipe) + Number(params.adaptacao_perfis)) * 2;
    const totalScore = secao1 + secao2 + secao3 + secao4 + secao5;

    Logger.log('📊 Pontuação calculada: ' + totalScore + '/120');

    const updates = {};

    if (col['status_entrevista'] >= 0) updates[col['status_entrevista']] = 'Avaliado';
    if (col['entrevistador'] >= 0) updates[col['entrevistador']] = params.interviewerEmail || '';
    if (col['data_entrevista'] >= 0) updates[col['data_entrevista']] = getCurrentTimestamp();
    if (col['interview_completed_at'] >= 0) updates[col['interview_completed_at']] = params.completed_at || getCurrentTimestamp();
    if (col['interview_score'] >= 0) updates[col['interview_score']] = totalScore;
    if (col['interview_result'] >= 0) updates[col['interview_result']] = params.resultado || '';
    if (col['interview_notes'] >= 0) updates[col['interview_notes']] = params.impressao_perfil || '';
    if (col['formacao_adequada'] >= 0) updates[col['formacao_adequada']] = params.formacao_adequada || '';
    if (col['graduacoes_competencias'] >= 0) updates[col['graduacoes_competencias']] = params.graduacoes_competencias || '';
    if (col['descricao_processos'] >= 0) updates[col['descricao_processos']] = params.descricao_processos || '';
    if (col['terminologia_tecnica'] >= 0) updates[col['terminologia_tecnica']] = params.terminologia_tecnica || '';
    if (col['calma_clareza'] >= 0) updates[col['calma_clareza']] = params.calma_clareza || '';
    if (col['escalas_flexiveis'] >= 0) updates[col['escalas_flexiveis']] = params.escalas_flexiveis || '';
    if (col['adaptabilidade_mudancas'] >= 0) updates[col['adaptabilidade_mudancas']] = params.adaptabilidade_mudancas || '';
    if (col['ajustes_emergencia'] >= 0) updates[col['ajustes_emergencia']] = params.ajustes_emergencia || '';
    if (col['residencia'] >= 0) updates[col['residencia']] = params.residencia || '';
    if (col['resolucao_conflitos'] >= 0) updates[col['resolucao_conflitos']] = params.resolucao_conflitos || '';
    if (col['colaboracao_equipe'] >= 0) updates[col['colaboracao_equipe']] = params.colaboracao_equipe || '';
    if (col['adaptacao_perfis'] >= 0) updates[col['adaptacao_perfis']] = params.adaptacao_perfis || '';

    _updateRowColumns_(sh, row, updates);

    Logger.log('✅ Avaliação de entrevista salva com sucesso');
    Logger.log('   - Candidato: ' + searchKey);
    Logger.log('   - Pontuação: ' + totalScore + '/120');
    Logger.log('   - Resultado: ' + params.resultado);

    return {
      success: true,
      message: 'Avaliação salva com sucesso',
      score: totalScore,
      resultado: params.resultado
    };
  } catch (error) {
    Logger.log('❌ Erro em saveInterviewEvaluation: ' + error.toString());
    Logger.log('   Stack: ' + error.stack);
    throw error;
  }
}

// ============================================
// RELATÓRIOS
// ============================================

function getReportStats(params) {
  return AdvancedCacheService.getWithFallback(
    CACHE_KEYS.STATS,
    () => {
      try {
        Logger.log('Gerando estatísticas de relatórios (cache miss)');

        const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
        if (!result.sheet || !result.processChunk) {
          return {
            classificados: 0,
            desclassificados: 0,
            entrevistaClassificados: 0,
            entrevistaDesclassificados: 0
          };
        }

        const col = _colMap_(result.headers);
        const statusCol = col['Status'];
        const statusEntrevistaCol = col['status_entrevista'];
        const interviewResultCol = col['interview_result'];

        let classificados = 0;
        let desclassificados = 0;
        let entrevistaClassificados = 0;
        let entrevistaDesclassificados = 0;

        result.processChunk((row, rowNum) => {
          const status = row[statusCol] ? String(row[statusCol]).trim() : '';
          const statusEntrevista = row[statusEntrevistaCol] ? String(row[statusEntrevistaCol]).trim() : '';
          const interviewResult = row[interviewResultCol] ? String(row[interviewResultCol]).trim() : '';

          if (status === 'Classificado') classificados++;
          else if (status === 'Desclassificado') desclassificados++;

          if (statusEntrevista === 'Avaliado') {
            if (interviewResult === 'Classificado') entrevistaClassificados++;
            else if (interviewResult === 'Desclassificado') entrevistaDesclassificados++;
          }
        });

        const stats = {
          classificados,
          desclassificados,
          entrevistaClassificados,
          entrevistaDesclassificados
        };

        Logger.log('Estatísticas geradas e armazenadas no cache');
        Logger.log(`   Classificados: ${classificados} | Desclassificados: ${desclassificados}`);

        return stats;

      } catch (error) {
        Logger.log('Erro crítico em getReportStats: ' + error.toString());
        throw error;
      }
    },
    60
  );
}

function getReport(params) {
  try {
    const reportType = params.reportType;
    const analystEmail = params.analystEmail;
    const interviewerEmail = params.interviewerEmail;

    Logger.log('📋 Gerando relatório: ' + reportType);
    if (analystEmail) Logger.log('   - Filtro por analista: ' + analystEmail);
    if (interviewerEmail) Logger.log('   - Filtro por entrevistador: ' + interviewerEmail);

    const result = _readSheetInChunks_(SHEET_CANDIDATOS, 1000);
    if (!result.sheet || !result.processChunk) {
      Logger.log('⚠️ Nenhum candidato encontrado');
      return [];
    }

    const col = _colMap_(result.headers);
    const statusCol = col['Status'];
    const analistaCol = col['Analista'];
    const statusEntrevistaCol = col['status_entrevista'];
    const interviewResultCol = col['interview_result'];
    const entrevistadorCol = col['entrevistador'];

    const candidates = [];

    result.processChunk((row, rowNum) => {
      const status = row[statusCol] ? String(row[statusCol]).trim() : '';
      const analista = row[analistaCol] ? String(row[analistaCol]).toLowerCase().trim() : '';
      const statusEntrevista = row[statusEntrevistaCol] ? String(row[statusEntrevistaCol]).trim() : '';
      const interviewResult = row[interviewResultCol] ? String(row[interviewResultCol]).trim() : '';
      const entrevistador = row[entrevistadorCol] ? String(row[entrevistadorCol]).toLowerCase().trim() : '';

      if (analystEmail && analista !== analystEmail.toLowerCase().trim()) {
        return;
      }

      if (interviewerEmail && entrevistador !== interviewerEmail.toLowerCase().trim()) {
        return;
      }

      let include = false;

      if (reportType === 'classificados' && status === 'Classificado') {
        include = true;
      } else if (reportType === 'desclassificados' && status === 'Desclassificado') {
        include = true;
      } else if (reportType === 'entrevista_classificados' && statusEntrevista === 'Avaliado' && interviewResult === 'Classificado') {
        include = true;
      } else if (reportType === 'entrevista_desclassificados' && statusEntrevista === 'Avaliado' && interviewResult === 'Desclassificado') {
        include = true;
      }

      if (include) {
        const candidate = {};
        result.headers.forEach((header, index) => {
          candidate[header] = row[index];
        });
        candidates.push(candidate);
      }
    });

    Logger.log('✅ Relatório gerado: ' + candidates.length + ' registros');
    return candidates;
  } catch (error) {
    Logger.log('❌ Erro em getReport: ' + error.toString());
    throw error;
  }
}

// ============================================
// TRIAGEM - OTIMIZADA
// ============================================

function saveScreening(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('📝 INICIANDO saveScreening (OTIMIZADO)');
    Logger.log('═══════════════════════════════════════');
    Logger.log('📋 Parâmetros recebidos:');
    Logger.log('   - candidateId: ' + params.candidateId);
    Logger.log('   - registrationNumber: ' + params.registrationNumber);
    Logger.log('   - cpf: ' + params.cpf);
    Logger.log('   - status (RAW): "' + params.status + '"');
    Logger.log('   - analystEmail: ' + params.analystEmail);

    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const searchKey = String(params.candidateId || params.registrationNumber || params.cpf).trim();

    const cpfCol = col['CPF'];
    const regNumCol = col['Número de Inscrição'];

    let row = _findRowByValue_(sh, cpfCol, searchKey);
    if (!row && regNumCol >= 0) {
      row = _findRowByValue_(sh, regNumCol, searchKey);
    }

    if (!row) {
      Logger.log('❌ Candidato não encontrado: ' + searchKey);
      throw new Error('Candidato não encontrado: ' + searchKey);
    }

    Logger.log('📍 Candidato encontrado na linha: ' + row);

    let statusFinal;
    if (params.status === 'classificado') {
      statusFinal = 'Classificado';
      Logger.log('   ✅ Status será: Classificado');
    } else if (params.status === 'desclassificado') {
      statusFinal = 'Desclassificado';
      Logger.log('   ❌ Status será: Desclassificado');
    } else {
      statusFinal = 'Desclassificado';
      Logger.log('   ⚠️ Status não reconhecido, usando padrão: Desclassificado');
    }

    const updates = {};

    if (col['Status'] >= 0) updates[col['Status']] = statusFinal;
    if (col['Analista'] >= 0 && params.analystEmail) updates[col['Analista']] = params.analystEmail;
    if (col['Data Triagem'] >= 0) updates[col['Data Triagem']] = params.screenedAt || getCurrentTimestamp();

    const convertDocument = (value) => {
      switch (value) {
        case 'conforme': return 'Sim';
        case 'nao_conforme': return 'Não';
        case 'nao_se_aplica':
        case null: return 'Não se aplica';
        default: return String(value || '');
      }
    };

    if (col['checkrg-cpf'] >= 0 && params['checkrg-cpf']) updates[col['checkrg-cpf']] = convertDocument(params['checkrg-cpf']);
    if (col['check-cnh'] >= 0 && params['check-cnh']) updates[col['check-cnh']] = convertDocument(params['check-cnh']);
    if (col['check-experiencia'] >= 0 && params['check-experiencia']) updates[col['check-experiencia']] = convertDocument(params['check-experiencia']);
    if (col['check-regularidade'] >= 0 && params['check-regularidade']) updates[col['check-regularidade']] = convertDocument(params['check-regularidade']);
    if (col['check-laudo'] >= 0 && params['check-laudo']) updates[col['check-laudo']] = convertDocument(params['check-laudo']);
    if (col['check-curriculo'] >= 0 && params['check-curriculo']) updates[col['check-curriculo']] = convertDocument(params['check-curriculo']);

    if (statusFinal === 'Classificado') {
      if (col['capacidade_tecnica'] >= 0 && params.capacidade_tecnica !== undefined) {
        updates[col['capacidade_tecnica']] = Number(params.capacidade_tecnica) || 0;
      }
      if (col['experiencia'] >= 0 && params.experiencia !== undefined) {
        updates[col['experiencia']] = Number(params.experiencia) || 0;
      }
      if (col['pontuacao_triagem'] >= 0) {
        updates[col['pontuacao_triagem']] = (Number(params.capacidade_tecnica) || 0) + (Number(params.experiencia) || 0);
      }
    }

    if (statusFinal === 'Desclassificado' && col['Motivo Desclassificação'] >= 0) {
      let motivo = '';
      const docsNaoConformes = [];

      if (params['checkrg-cpf'] === 'nao_conforme') docsNaoConformes.push('RG/CPF');
      if (params['check-cnh'] === 'nao_conforme') docsNaoConformes.push('CNH');
      if (params['check-experiencia'] === 'nao_conforme') docsNaoConformes.push('Experiência Profissional');
      if (params['check-regularidade'] === 'nao_conforme') docsNaoConformes.push('Regularidade Profissional');
      if (params['check-laudo'] === 'nao_conforme') docsNaoConformes.push('Laudo PCD');
      if (params['check-curriculo'] === 'nao_conforme') docsNaoConformes.push('Currículo');

      if (docsNaoConformes.length > 0) {
        motivo = `Documentos não conformes: ${docsNaoConformes.join(', ')}`;
      }

      if (params.disqualification_reason) {
        motivo = motivo ? `${motivo} | ${params.disqualification_reason}` : params.disqualification_reason;
      }

      if (!motivo) {
        motivo = 'Desclassificado pelo analista';
      }

      updates[col['Motivo Desclassificação']] = motivo;
    }

    if (col['Observações'] >= 0 && params.notes) {
      updates[col['Observações']] = params.notes;
    }

    _updateRowColumns_(sh, row, updates);

    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ TRIAGEM SALVA COM SUCESSO (OTIMIZADO)');
    Logger.log('   - Status final gravado: "' + statusFinal + '"');
    Logger.log('   - Linha: ' + row);
    Logger.log('   - Colunas atualizadas: ' + Object.keys(updates).length);
    Logger.log('═══════════════════════════════════════');

    return {
      success: true,
      message: 'Triagem salva com sucesso',
      candidateId: searchKey,
      status: statusFinal
    };
  } catch (error) {
    Logger.log('═══════════════════════════════════════');
    Logger.log('❌ ERRO EM saveScreening');
    Logger.log('   Erro: ' + error.toString());
    Logger.log('   Stack: ' + error.stack);
    Logger.log('═══════════════════════════════════════');

    return {
      success: false,
      error: 'Falha ao salvar triagem: ' + error.toString(),
      details: error.stack
    };
  }
}

// ============================================
// UTILITÁRIOS
// ============================================

function testConnection() {
  return {
    status: 'OK',
    timestamp: getCurrentTimestamp(),
    spreadsheetId: SPREADSHEET_ID
  };
}
