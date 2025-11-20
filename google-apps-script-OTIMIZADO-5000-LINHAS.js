// ============================================
// GOOGLE APPS SCRIPT - OTIMIZADO PARA 5000+ CANDIDATOS
// ============================================

const CACHE_TTL = 60;
const CACHE_KEYS = {
  REPORT_DATA: 'report_data_v3',
  USERS: 'users_data_v3',
  STATS: 'stats_data_v3',
  INTERVIEWERS: 'interviewers_v3',
  REASONS: 'disqualification_reasons_v3'
};

// Serviço de Cache Avançado
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

const SPREADSHEET_ID = '1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY';
const SHEET_USUARIOS = 'USUARIOS';
const SHEET_CANDIDATOS = 'CANDIDATOS';
const SHEET_MOTIVOS = 'MOTIVOS';
const SHEET_MENSAGENS = 'MENSAGENS';
const SHEET_TEMPLATES = 'TEMPLATES';

const HEADER_ROWS = 1;
const COL_ID_PRIMARY = 'CPF';
const COL_ID_ALT = 'Número de Inscrição';

function _ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function _sheet(name){ return _ss().getSheetByName(name); }

function _getHeaders_(sh){
  const lastCol = sh.getLastColumn();
  return (lastCol ? sh.getRange(1,1,1,lastCol).getValues()[0] : []);
}

function _colMap_(headers){
  const m = {};
  headers.forEach((h,i)=> m[h]=i);
  return m;
}

// ============================================
// BUSCA OTIMIZADA - SEM CARREGAR TODA PLANILHA
// ============================================

function _findRowByValue_(sh, colIndex, searchValue) {
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return null;

  const column = sh.getRange(HEADER_ROWS + 1, colIndex + 1, lastRow - HEADER_ROWS, 1);
  const finder = column.createTextFinder(String(searchValue).trim());
  const result = finder.findNext();

  if (result) {
    return result.getRow();
  }

  // Fallback: busca linear em chunks
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

// ============================================
// ATUALIZAÇÃO OTIMIZADA - APENAS COLUNAS NECESSÁRIAS
// ============================================

function _updateRowColumns_(sh, row, colUpdates) {
  for (const [colIndex, value] of Object.entries(colUpdates)) {
    sh.getRange(row, parseInt(colIndex) + 1).setValue(value);
  }
}

// ============================================
// LEITURA EM CHUNKS PARA GRANDES VOLUMES
// ============================================

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

// [Continua com as demais funções do script original, aplicando as mesmas otimizações onde necessário...]

// ============================================
// TRIAGEM - OTIMIZADA
// ============================================

function saveScreening(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('📝 INICIANDO saveScreening (OTIMIZADO)');
    Logger.log('═══════════════════════════════════════');

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
    } else if (params.status === 'desclassificado') {
      statusFinal = 'Desclassificado';
    } else {
      statusFinal = 'Desclassificado';
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

// [IMPORTANTE: As funções restantes (getDisqualificationReasons, sendMessages, moveToInterview, etc.)
// devem ser copiadas do script original, pois não foram alteradas ou precisam apenas de ajustes menores]
