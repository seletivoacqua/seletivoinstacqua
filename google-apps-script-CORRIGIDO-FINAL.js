// ============================================
// GOOGLE APPS SCRIPT - SISTEMA DE TRIAGEM COMPLETO
// VERSÃO CORRIGIDA - CACHE E DUPLICADOS
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
const CACHE_TTL_SEC = 1200;
const PROP_REV_KEY = 'IDX_REV';
const IDX_CACHE_KEY = 'idx:v';

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

function _getRev_(){
  return PropertiesService.getDocumentProperties().getProperty(PROP_REV_KEY) || '0';
}

// ✅ CORREÇÃO: Limpar TODO o cache ao fazer bump
function _bumpRev_(){
  const props = PropertiesService.getDocumentProperties();
  const cur = Number(props.getProperty(PROP_REV_KEY) || '0') + 1;
  props.setProperty(PROP_REV_KEY, String(cur));

  // Limpar cache do índice antigo
  try {
    const cache = CacheService.getDocumentCache();
    cache.remove(`${IDX_CACHE_KEY}${cur - 1}`);
    Logger.log('✅ Cache invalidado após bump: rev=' + cur);
  } catch (e) {
    Logger.log('⚠️ Erro ao limpar cache: ' + e);
  }

  return String(cur);
}

function _buildIndex_(sh, headers){
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return {};

  const colMap = _colMap_(headers);
  const colCpf = colMap[COL_ID_PRIMARY] ?? -1;
  const colAlt = colMap[COL_ID_ALT] ?? -1;
  const keyCols = [colCpf, colAlt].filter(c => c>=0);
  if (!keyCols.length) return {};

  const values = sh.getRange(HEADER_ROWS+1, 1, lastRow-HEADER_ROWS, sh.getLastColumn()).getValues();
  const idx = {};
  for (let i=0;i<values.length;i++){
    for (const c of keyCols){
      const key = values[i][c];
      if (key) {
        const row = i + HEADER_ROWS + 1;
        idx[String(key).trim()] = row;
      }
    }
  }
  return idx;
}

function _getIndex_(sh, headers){
  const rev = _getRev_();
  const key = `${IDX_CACHE_KEY}${rev}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const idx = _buildIndex_(sh, headers);
  cache.put(key, JSON.stringify(idx), CACHE_TTL_SEC);
  return idx;
}

function _readSheetBlock_(name){
  const sh = _sheet(name);
  if (!sh) return {sheet:null, headers:[], values:[]};
  const headers = _getHeaders_(sh);
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow <= HEADER_ROWS || lastCol === 0){
    return {sheet:sh, headers, values:[]};
  }
  const values = sh.getRange(HEADER_ROWS+1, 1, lastRow-HEADER_ROWS, lastCol).getValues();
  return {sheet:sh, headers, values};
}

function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();
  sh.getRange(row, 1, 1, lastCol).setValues([rowArray]);
}

// ============================================
// CORS HEADERS
// ============================================

function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action;

    Logger.log('🔄 Ação recebida: ' + action);

    switch (action) {
      case 'getCandidates':
        return createCorsResponse({ success: true, data: getCandidates(params) });

      case 'updateCandidateStatus':
        return createCorsResponse(updateCandidateStatus(params));

      case 'getCandidatesByStatus':
        return createCorsResponse(getCandidatesByStatus(params));

      case 'assignCandidates':
        return createCorsResponse(assignCandidates(params));

      case 'logMessage':
        return createCorsResponse(logMessage(params));

      case 'getDisqualificationReasons':
        return createCorsResponse({ success: true, data: getDisqualificationReasons() });

      case 'getMessageTemplates':
        return createCorsResponse({ success: true, data: getMessageTemplates(params) });

      case 'sendMessages':
        return createCorsResponse(sendMessages(params));

      case 'updateMessageStatus':
        return createCorsResponse(updateMessageStatus(params));

      case 'moveToInterview':
        return createCorsResponse(moveToInterview(params));

      case 'getInterviewCandidates':
        return createCorsResponse({ success: true, data: getInterviewCandidates() });

      case 'getInterviewers':
        return createCorsResponse({ success: true, data: getInterviewers() });

      case 'allocateToInterviewer':
        return createCorsResponse(allocateToInterviewer(params));

      case 'getInterviewerCandidates':
        return createCorsResponse({ success: true, data: getInterviewerCandidates(params) });

      case 'saveInterviewEvaluation':
        return createCorsResponse(saveInterviewEvaluation(params));

      case 'getReportStats':
        return createCorsResponse({ success: true, data: getReportStats() });

      case 'getReport':
        return createCorsResponse({ success: true, data: getReport(params) });

      case 'getEmailAliases':
        return createCorsResponse({ success: true, data: getEmailAliases() });

      case 'saveScreening':
        return createCorsResponse(saveScreening(params));

      case 'getAnalysts':
        return createCorsResponse({ success: true, data: getAnalysts() });

      // ✅ NOVA FUNÇÃO: Remover duplicados
      case 'removeDuplicates':
        return createCorsResponse(removeDuplicatesByRegistration());

      default:
        return createCorsResponse({
          success: false,
          error: 'Ação não reconhecida: ' + action
        });
    }
  } catch (error) {
    Logger.log('❌ Erro no doGet: ' + error.toString());
    return createCorsResponse({
      success: false,
      error: error.toString()
    });
  }
}

// ============================================
// NOVA FUNÇÃO: REMOVER DUPLICADOS
// ============================================

/**
 * Remove candidatos duplicados baseado no Número de Inscrição
 * Mantém apenas a linha mais recente (última ocorrência)
 * ✅ NÃO USA CACHE - operação crítica de limpeza
 */
function removeDuplicatesByRegistration() {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🧹 INICIANDO REMOÇÃO DE DUPLICADOS');
    Logger.log('═══════════════════════════════════════');

    const sh = _sheet(SHEET_CANDIDATOS);
    if (!sh) {
      throw new Error('Planilha CANDIDATOS não encontrada');
    }

    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const regNumCol = col['Número de Inscrição'] ?? col['NUMEROINSCRICAO'] ?? col['CPF'];

    if (regNumCol === undefined) {
      throw new Error('Coluna de Número de Inscrição não encontrada');
    }

    const lastRow = sh.getLastRow();
    if (lastRow <= HEADER_ROWS) {
      Logger.log('ℹ️ Planilha vazia, nada a fazer');
      return {
        success: true,
        message: 'Nenhum candidato encontrado',
        duplicatesRemoved: 0
      };
    }

    // Ler TODAS as linhas
    const lastCol = sh.getLastColumn();
    const allData = sh.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, lastCol).getValues();

    Logger.log(`📊 Total de linhas: ${allData.length}`);

    // Mapear duplicados (última ocorrência ganha)
    const registrationMap = new Map();
    const rowsToDelete = [];

    for (let i = 0; i < allData.length; i++) {
      const regNum = String(allData[i][regNumCol]).trim();

      if (!regNum || regNum === '' || regNum === 'null' || regNum === 'undefined') {
        Logger.log(`⚠️ Linha ${i + 2} sem número de inscrição, pulando...`);
        continue;
      }

      if (registrationMap.has(regNum)) {
        // Duplicado encontrado! Marcar a ocorrência ANTERIOR para deleção
        const previousRow = registrationMap.get(regNum);
        rowsToDelete.push(previousRow);
        Logger.log(`🔄 Duplicado encontrado: ${regNum} (linha ${previousRow + HEADER_ROWS + 1} será removida)`);
      }

      // Atualizar mapa com a linha atual (mais recente)
      registrationMap.set(regNum, i);
    }

    Logger.log(`📋 Total de duplicados encontrados: ${rowsToDelete.length}`);

    if (rowsToDelete.length === 0) {
      Logger.log('✅ Nenhum duplicado encontrado!');
      return {
        success: true,
        message: 'Nenhum duplicado encontrado',
        duplicatesRemoved: 0,
        totalCandidates: allData.length
      };
    }

    // Ordenar em ordem DECRESCENTE para não afetar índices ao deletar
    rowsToDelete.sort((a, b) => b - a);

    // Deletar linhas duplicadas
    let deletedCount = 0;
    for (const rowIndex of rowsToDelete) {
      try {
        const actualRow = rowIndex + HEADER_ROWS + 1;
        sh.deleteRow(actualRow);
        deletedCount++;
        Logger.log(`🗑️ Linha ${actualRow} removida`);
      } catch (e) {
        Logger.log(`❌ Erro ao deletar linha ${rowIndex + HEADER_ROWS + 1}: ${e}`);
      }
    }

    // ✅ CRÍTICO: Invalidar cache após remoção
    _bumpRev_();

    Logger.log('═══════════════════════════════════════');
    Logger.log(`✅ REMOÇÃO CONCLUÍDA`);
    Logger.log(`   - Total de candidatos: ${allData.length}`);
    Logger.log(`   - Duplicados removidos: ${deletedCount}`);
    Logger.log(`   - Candidatos únicos: ${allData.length - deletedCount}`);
    Logger.log('═══════════════════════════════════════');

    return {
      success: true,
      message: `${deletedCount} duplicados removidos com sucesso`,
      duplicatesRemoved: deletedCount,
      totalCandidates: allData.length,
      uniqueCandidates: allData.length - deletedCount
    };

  } catch (error) {
    Logger.log('❌ Erro ao remover duplicados: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ============================================
// FUNÇÕES DE CANDIDATOS
// ============================================

function getCandidates(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return { candidates: [] };

  const out = values.map(row => {
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    return obj;
  });
  return { candidates: out };
}

// ✅ CORREÇÃO: Adicionar _bumpRev_() após atualização
function updateCandidateStatus(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  const statusCol  = col['Status'];
  const cpfCol     = col['CPF'];
  const regNumCol  = (col['Número de Inscrição'] ?? col['NUMEROINSCRICAO']);
  const analystCol = (col['Analista'] ?? col['assigned_to']);
  const dateCol    = (col['Data Triagem'] ?? col['data_hora_triagem']);
  const reasonCol  = col['Motivo Desclassificação'];
  const notesCol   = (col['Observações'] ?? col['screening_notes']);

  const idx = _getIndex_(sh, headers);
  const searchKey = String(params.registrationNumber).trim();
  let row = idx[searchKey];

  const checkMismatch =
    row &&
    (
      (cpfCol>=0 && String(sh.getRange(row, cpfCol+1).getValue()).trim() !== searchKey) &&
      (regNumCol>=0 && String(sh.getRange(row, regNumCol+1).getValue()).trim() !== searchKey)
    );

  if (!row || checkMismatch){
    const newIdx = _buildIndex_(sh, headers);
    const rev = _getRev_();
    CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
    row = newIdx[searchKey];
  }

  if (!row) throw new Error('Candidato não encontrado');

  const lastCol = sh.getLastColumn();
  const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];

  if (statusCol>=0) rowVals[statusCol] = params.statusTriagem;
  if (analystCol>=0 && params.analystEmail) rowVals[analystCol] = params.analystEmail;
  if (dateCol>=0) rowVals[dateCol] = getCurrentTimestamp();
  if (reasonCol>=0 && params.reasonId) rowVals[reasonCol] = getDisqualificationReasonById(params.reasonId);
  if (notesCol>=0 && params.notes) rowVals[notesCol] = params.notes;

  _writeWholeRow_(sh, row, rowVals);

  // ✅ CORREÇÃO CRÍTICA: Invalidar cache
  _bumpRev_();

  return { success: true, message: 'Status atualizado' };
}

function getCandidatesByStatus(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return [];

  const col = _colMap_(headers);
  const statusCol = col['Status'];
  const cpfCol = col['CPF'];
  const emailSentCol = col['EMAIL_SENT'];
  const smsSentCol = col['SMS_SENT'];

  const filtered = [];
  for (let i=0;i<values.length;i++){
    if (values[i][statusCol] === params.status){
      const obj = {};
      for (let j=0;j<headers.length;j++) obj[headers[j]] = values[i][j];
      obj.id = values[i][cpfCol];
      obj.registration_number = values[i][cpfCol];

      obj.email_sent = emailSentCol >= 0 ? (values[i][emailSentCol] === 'Sim' || values[i][emailSentCol] === true || values[i][emailSentCol] === 'TRUE') : false;
      obj.sms_sent = smsSentCol >= 0 ? (values[i][smsSentCol] === 'Sim' || values[i][smsSentCol] === true || values[i][smsSentCol] === 'TRUE') : false;

      filtered.push(obj);
    }
  }
  return filtered;
}

// ✅ CORREÇÃO: Adicionar _bumpRev_() após alocação
function assignCandidates(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  const cpfCol        = col['CPF'];
  const assignedToCol = col['assigned_to'];
  const assignedByCol = col['assigned_by'];
  const assignedAtCol = col['assigned_at'];
  const statusCol     = col['Status'];

  if (cpfCol == null) throw new Error('Coluna CPF não encontrada');

  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) {
    return { success: true, assignedCount: 0, message: 'Nada para alocar' };
  }

  const n = lastRow - HEADER_ROWS;
  const cpfs = sh.getRange(HEADER_ROWS+1, cpfCol+1, n, 1).getValues().map(r=> String(r[0]).trim());
  const assignedTo = assignedToCol!=null ? sh.getRange(HEADER_ROWS+1, assignedToCol+1, n, 1).getValues() : null;
  const assignedBy = assignedByCol!=null ? sh.getRange(HEADER_ROWS+1, assignedByCol+1, n, 1).getValues() : null;
  const assignedAt = assignedAtCol!=null ? sh.getRange(HEADER_ROWS+1, assignedAtCol+1, n, 1).getValues() : null;
  const status     = statusCol!=null     ? sh.getRange(HEADER_ROWS+1, statusCol+1, n, 1).getValues()     : null;

  const target = String(params.candidateIds || '').split(',').map(s=>s.trim()).filter(Boolean);
  const stamp = getCurrentTimestamp();
  let count = 0;

  const pos = new Map();
  for (let i=0;i<cpfs.length;i++) pos.set(cpfs[i], i);

  for (const id of target){
    const i = pos.get(id);
    if (i==null) continue;
    if (assignedTo) assignedTo[i][0] = params.analystEmail || '';
    if (assignedBy) assignedBy[i][0] = params.adminEmail || '';
    if (assignedAt) assignedAt[i][0] = stamp;
    if (status)     status[i][0]     = 'em_analise';
    count++;
  }

  if (count > 0) {
    if (assignedTo) sh.getRange(HEADER_ROWS+1, assignedToCol+1, n, 1).setValues(assignedTo);
    if (assignedBy) sh.getRange(HEADER_ROWS+1, assignedByCol+1, n, 1).setValues(assignedBy);
    if (assignedAt) sh.getRange(HEADER_ROWS+1, assignedAtCol+1, n, 1).setValues(assignedAt);
    if (status)     sh.getRange(HEADER_ROWS+1, statusCol+1, n, 1).setValues(status);

    // ✅ CORREÇÃO CRÍTICA: Invalidar cache
    _bumpRev_();
  }

  return { success: true, assignedCount: count, message: `${count} candidatos alocados com sucesso` };
}

// ============================================
// MENSAGENS
// ============================================

function initMensagensSheet() {
  const ss = _ss();
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

function updateMessageStatus(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const regNums = String(params.registrationNumbers || '').split(',').map(s => s.trim()).filter(Boolean);
    const messageType = params.messageType;
    const status = params.status;

    const colName = messageType === 'email' ? 'EMAIL_SENT' : 'SMS_SENT';
    const targetCol = col[colName];

    if (targetCol === undefined) {
      Logger.log(`⚠️ Coluna ${colName} não encontrada`);
      return { success: false, error: `Coluna ${colName} não encontrada` };
    }

    const idx = _getIndex_(sh, headers);
    let updatedCount = 0;

    for (const registrationNumber of regNums) {
      const searchKey = String(registrationNumber).trim();
      const row = idx[searchKey];

      if (!row) {
        Logger.log(`⚠️ Candidato não encontrado: ${registrationNumber}`);
        continue;
      }

      sh.getRange(row, targetCol + 1).setValue('Sim');
      updatedCount++;
      Logger.log(`✅ Status de mensagem atualizado: ${registrationNumber} - ${messageType} = Sim`);
    }

    if (updatedCount > 0) {
      // ✅ CORREÇÃO: Invalidar cache
      _bumpRev_();
    }

    return {
      success: true,
      message: `${updatedCount} status(es) atualizado(s)`,
      updatedCount: updatedCount
    };
  } catch (error) {
    Logger.log('❌ Erro em updateMessageStatus: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function getMessageTemplates(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_TEMPLATES);
  if (!sheet || !values.length) return [];

  const templates = [];
  for (let i = 0; i < values.length; i++) {
    const template = {};
    for (let j = 0; j < headers.length; j++) {
      template[headers[j]] = values[i][j];
    }
    if (params.messageType) {
      if (template.Tipo === params.messageType) {
        templates.push(template);
      }
    } else {
      templates.push(template);
    }
  }
  return templates;
}

function sendMessages(params) {
  Logger.log('📤 sendMessages chamado');
  Logger.log('Parâmetros: ' + JSON.stringify(params));

  return {
    success: true,
    message: 'Mensagens marcadas para envio. O envio real deve ser configurado.'
  };
}

function getEmailAliases() {
  return [
    { email: 'contato@hospital.com', name: 'Hospital - Contato' },
    { email: 'rh@hospital.com', name: 'Hospital - RH' }
  ];
}

// ============================================
// ENTREVISTAS
// ============================================

function moveToInterview(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const cpfCol = col['CPF'];
    const statusEntrevistaCol = col['Status Entrevista'];

    if (cpfCol === undefined) throw new Error('Coluna CPF não encontrada');
    if (statusEntrevistaCol === undefined) throw new Error('Coluna Status Entrevista não encontrada');

    const lastRow = sh.getLastRow();
    if (lastRow <= HEADER_ROWS) {
      return { success: true, movedCount: 0, message: 'Nenhum candidato para mover' };
    }

    const n = lastRow - HEADER_ROWS;
    const cpfs = sh.getRange(HEADER_ROWS + 1, cpfCol + 1, n, 1).getValues().map(r => String(r[0]).trim());
    const statusEntrevista = sh.getRange(HEADER_ROWS + 1, statusEntrevistaCol + 1, n, 1).getValues();

    const target = String(params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
    let movedCount = 0;

    const pos = new Map();
    for (let i = 0; i < cpfs.length; i++) pos.set(cpfs[i], i);

    for (const id of target) {
      const i = pos.get(id);
      if (i !== null && i !== undefined) {
        statusEntrevista[i][0] = 'Aguardando Alocação';
        movedCount++;
      }
    }

    if (movedCount > 0) {
      sh.getRange(HEADER_ROWS + 1, statusEntrevistaCol + 1, n, 1).setValues(statusEntrevista);

      // ✅ CORREÇÃO: Invalidar cache
      _bumpRev_();
    }

    return { success: true, movedCount: movedCount, message: `${movedCount} candidato(s) movido(s) para entrevista` };
  } catch (error) {
    Logger.log('❌ Erro em moveToInterview: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function getInterviewCandidates() {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return [];

  const col = _colMap_(headers);
  const statusEntrevistaCol = col['Status Entrevista'];
  const cpfCol = col['CPF'];

  if (statusEntrevistaCol === undefined) return [];

  const candidates = [];
  for (let i = 0; i < values.length; i++) {
    const statusEntrevista = values[i][statusEntrevistaCol];
    if (statusEntrevista === 'Aguardando Alocação' || statusEntrevista === 'Alocado') {
      const candidate = {};
      for (let j = 0; j < headers.length; j++) {
        candidate[headers[j]] = values[i][j];
      }
      candidate.id = values[i][cpfCol];
      candidate.registration_number = values[i][cpfCol];
      candidates.push(candidate);
    }
  }

  return candidates;
}

function getInterviewers() {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_USUARIOS);
  if (!sheet || !values.length) return [];

  const interviewers = [];
  for (let i = 0; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    if (row.Funcao === 'Entrevistador' || row.Funcao === 'entrevistador') {
      interviewers.push({
        email: row.Email,
        name: row.Nome
      });
    }
  }
  return interviewers;
}

function allocateToInterviewer(params) {
  const startTime = Date.now();
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const cpfCol = col['CPF'];
    const statusEntrevistaCol = col['Status Entrevista'];
    const entrevistadorCol = col['Entrevistador'];
    const dataAlocacaoCol = col['Data Alocação Entrevista'];

    if (cpfCol === undefined) throw new Error('Coluna CPF não encontrada');
    if (statusEntrevistaCol === undefined) throw new Error('Coluna Status Entrevista não encontrada');
    if (entrevistadorCol === undefined) throw new Error('Coluna Entrevistador não encontrada');

    const lastRow = sh.getLastRow();
    if (lastRow <= HEADER_ROWS) {
      return { success: true, allocatedCount: 0, message: 'Nenhum candidato para alocar' };
    }

    const n = lastRow - HEADER_ROWS;
    const cpfs = sh.getRange(HEADER_ROWS + 1, cpfCol + 1, n, 1).getValues().map(r => String(r[0]).trim());
    const statusEntrevista = sh.getRange(HEADER_ROWS + 1, statusEntrevistaCol + 1, n, 1).getValues();
    const entrevistadores = sh.getRange(HEADER_ROWS + 1, entrevistadorCol + 1, n, 1).getValues();
    const dataAlocacao = dataAlocacaoCol !== undefined ? sh.getRange(HEADER_ROWS + 1, dataAlocacaoCol + 1, n, 1).getValues() : null;

    const target = String(params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
    const interviewerEmail = params.interviewerEmail;
    const stamp = getCurrentTimestamp();
    let allocatedCount = 0;

    const pos = new Map();
    for (let i = 0; i < cpfs.length; i++) pos.set(cpfs[i], i);

    for (const id of target) {
      const i = pos.get(id);
      if (i !== null && i !== undefined) {
        statusEntrevista[i][0] = 'Alocado';
        entrevistadores[i][0] = interviewerEmail;
        if (dataAlocacao) dataAlocacao[i][0] = stamp;
        allocatedCount++;
      }
    }

    if (allocatedCount > 0) {
      sh.getRange(HEADER_ROWS + 1, statusEntrevistaCol + 1, n, 1).setValues(statusEntrevista);
      sh.getRange(HEADER_ROWS + 1, entrevistadorCol + 1, n, 1).setValues(entrevistadores);
      if (dataAlocacao && dataAlocacaoCol !== undefined) {
        sh.getRange(HEADER_ROWS + 1, dataAlocacaoCol + 1, n, 1).setValues(dataAlocacao);
      }

      // ✅ CORREÇÃO: Invalidar cache
      _bumpRev_();
    }

    const duration = Date.now() - startTime;
    Logger.log(`⏱️ allocateToInterviewer: ${duration}ms`);

    return {
      success: true,
      allocatedCount: allocatedCount,
      message: `${allocatedCount} candidato(s) alocado(s) para entrevista`
    };
  } catch (error) {
    Logger.log('❌ Erro em allocateToInterviewer: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function getInterviewerCandidates(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return [];

  const col = _colMap_(headers);
  const entrevistadorCol = col['Entrevistador'];
  const cpfCol = col['CPF'];

  if (entrevistadorCol === undefined) return [];

  const interviewerEmail = params.interviewerEmail;
  const candidates = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i][entrevistadorCol] === interviewerEmail) {
      const candidate = {};
      for (let j = 0; j < headers.length; j++) {
        candidate[headers[j]] = values[i][j];
      }
      candidate.id = values[i][cpfCol];
      candidate.registration_number = values[i][cpfCol];
      candidates.push(candidate);
    }
  }

  return candidates;
}

function saveInterviewEvaluation(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const cpfCol = col['CPF'];
    const statusEntrevistaCol = col['Status Entrevista'];
    const resultadoCol = col['Resultado Entrevista'];
    const dataEntrevistaCol = col['Data Entrevista'];
    const comunicacaoCol = col['Comunicação'];
    const conhecimentoCol = col['Conhecimento Técnico'];
    const alinhamentoCol = col['Alinhamento Cultural'];
    const pontuacaoEntrevistaCol = col['Pontuação Entrevista'];
    const observacoesEntrevistaCol = col['Observações Entrevista'];

    const idx = _getIndex_(sh, headers);
    const searchKey = String(params.candidateId || params.registrationNumber || params.cpf).trim();
    let row = idx[searchKey];

    if (!row) {
      const newIdx = _buildIndex_(sh, headers);
      const rev = _getRev_();
      CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
      row = newIdx[searchKey];
    }

    if (!row) throw new Error('Candidato não encontrado: ' + searchKey);

    const lastCol = sh.getLastColumn();
    const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];

    if (statusEntrevistaCol >= 0) rowVals[statusEntrevistaCol] = 'Entrevistado';
    if (resultadoCol >= 0) rowVals[resultadoCol] = params.resultado || '';
    if (dataEntrevistaCol >= 0) rowVals[dataEntrevistaCol] = params.interviewedAt || getCurrentTimestamp();
    if (comunicacaoCol >= 0) rowVals[comunicacaoCol] = Number(params.comunicacao) || 0;
    if (conhecimentoCol >= 0) rowVals[conhecimentoCol] = Number(params.conhecimento) || 0;
    if (alinhamentoCol >= 0) rowVals[alinhamentoCol] = Number(params.alinhamento) || 0;

    const totalScore = (Number(params.comunicacao) || 0) + (Number(params.conhecimento) || 0) + (Number(params.alinhamento) || 0);
    if (pontuacaoEntrevistaCol >= 0) rowVals[pontuacaoEntrevistaCol] = totalScore;

    if (observacoesEntrevistaCol >= 0) rowVals[observacoesEntrevistaCol] = params.observacoes || '';

    _writeWholeRow_(sh, row, rowVals);

    // ✅ CORREÇÃO: Invalidar cache
    _bumpRev_();

    Logger.log('✅ Avaliação de entrevista salva com sucesso');
    return { success: true, message: 'Avaliação salva com sucesso', resultado: params.resultado };
  } catch (error) {
    Logger.log('❌ Erro em saveInterviewEvaluation: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// ============================================
// RELATÓRIOS
// ============================================

function getReportStats() {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) {
    return {
      totalCandidates: 0,
      classified: 0,
      disqualified: 0,
      interviewed: 0,
      approved: 0,
      reproved: 0
    };
  }

  const col = _colMap_(headers);
  const statusCol = col['Status'];
  const statusEntrevistaCol = col['Status Entrevista'];
  const resultadoEntrevistaCol = col['Resultado Entrevista'];

  let classified = 0, disqualified = 0, interviewed = 0, approved = 0, reproved = 0;

  for (let i = 0; i < values.length; i++) {
    const status = values[i][statusCol];
    const statusEntrevista = statusEntrevistaCol >= 0 ? values[i][statusEntrevistaCol] : '';
    const resultado = resultadoEntrevistaCol >= 0 ? values[i][resultadoEntrevistaCol] : '';

    if (status === 'Classificado') classified++;
    if (status === 'Desclassificado') disqualified++;
    if (statusEntrevista === 'Entrevistado') interviewed++;
    if (resultado === 'Aprovado') approved++;
    if (resultado === 'Reprovado') reproved++;
  }

  return {
    totalCandidates: values.length,
    classified,
    disqualified,
    interviewed,
    approved,
    reproved
  };
}

function getReport(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return [];

  const reportType = params.reportType;
  const col = _colMap_(headers);

  const filteredCandidates = [];

  for (let i = 0; i < values.length; i++) {
    const candidate = {};
    for (let j = 0; j < headers.length; j++) {
      candidate[headers[j]] = values[i][j];
    }

    let include = false;

    switch (reportType) {
      case 'classified':
        include = candidate.Status === 'Classificado';
        break;
      case 'disqualified':
        include = candidate.Status === 'Desclassificado';
        break;
      case 'interviewed':
        include = candidate['Status Entrevista'] === 'Entrevistado';
        break;
      case 'approved':
        include = candidate['Resultado Entrevista'] === 'Aprovado';
        break;
      case 'reproved':
        include = candidate['Resultado Entrevista'] === 'Reprovado';
        break;
      case 'all':
        include = true;
        break;
    }

    if (include) {
      if (params.analystEmail && candidate.Analista !== params.analystEmail) continue;
      if (params.interviewerEmail && candidate.Entrevistador !== params.interviewerEmail) continue;
      filteredCandidates.push(candidate);
    }
  }

  return filteredCandidates;
}

// ============================================
// TRIAGEM (SCREENING)
// ============================================

function saveScreening(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('📝 INICIANDO saveScreening');
    Logger.log('═══════════════════════════════════════');
    Logger.log('📋 Parâmetros recebidos:');
    Logger.log('   - candidateId: ' + params.candidateId);
    Logger.log('   - registrationNumber: ' + params.registrationNumber);
    Logger.log('   - cpf: ' + params.cpf);
    Logger.log('   - status (RAW): "' + params.status + '"');
    Logger.log('   - tipo do status: ' + typeof params.status);
    Logger.log('   - analystEmail: ' + params.analystEmail);

    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const statusCol = col['Status'];
    const analistaCol = col['Analista'];
    const dataTriagemCol = col['Data Triagem'];
    const checkRgCpfCol = col['checkrg-cpf'];
    const checkCnhCol = col['check-cnh'];
    const checkExperienciaCol = col['check-experiencia'];
    const checkRegularidadeCol = col['check-regularidade'];
    const checkLaudoCol = col['check-laudo'];
    const checkCurriculoCol = col['check-curriculo'];
    const observacoesCol = col['Observações'];
    const capacidadeTecnicaCol = col['capacidade_tecnica'];
    const experienciaCol = col['experiencia'];
    const pontuacaoTotalCol = col['pontuacao_triagem'];
    const motivoCol = col['Motivo Desclassificação'];

    Logger.log('📊 Índice da coluna Status: ' + statusCol);

    const idx = _getIndex_(sh, headers);
    const searchKey = String(params.candidateId || params.registrationNumber || params.cpf).trim();
    let row = idx[searchKey];

    if (!row) {
      const newIdx = _buildIndex_(sh, headers);
      const rev = _getRev_();
      CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
      row = newIdx[searchKey];
    }

    if (!row) {
      Logger.log('❌ Candidato não encontrado: ' + searchKey);
      throw new Error('Candidato não encontrado: ' + searchKey);
    }

    Logger.log('📍 Candidato encontrado na linha: ' + row);

    const lastCol = sh.getLastColumn();
    const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];

    Logger.log('───────────────────────────────────────');
    Logger.log('🔍 PROCESSANDO STATUS:');
    Logger.log('   - Status recebido: "' + params.status + '"');
    Logger.log('   - Comparação (params.status === "classificado"): ' + (params.status === 'classificado'));
    Logger.log('   - Comparação (params.status === "desclassificado"): ' + (params.status === 'desclassificado'));

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

    if (statusCol >= 0) {
      rowVals[statusCol] = statusFinal;
      Logger.log('   📝 Status gravado na coluna ' + statusCol + ': "' + statusFinal + '"');
    } else {
      Logger.log('   ⚠️ Coluna Status não encontrada!');
    }
    Logger.log('───────────────────────────────────────');

    if (analistaCol >= 0 && params.analystEmail) {
      rowVals[analistaCol] = params.analystEmail;
      Logger.log('👤 Analista: ' + params.analystEmail);
    }

    if (dataTriagemCol >= 0) {
      rowVals[dataTriagemCol] = params.screenedAt || getCurrentTimestamp();
      Logger.log('📅 Data triagem: ' + rowVals[dataTriagemCol]);
    }

    Logger.log('📋 Salvando documentos:');
    const updateDocument = (colIndex, value, fieldName) => {
      if (colIndex >= 0 && value !== undefined && value !== null) {
        let convertedValue = '';
        switch (value) {
          case 'conforme':
            convertedValue = 'Sim';
            break;
          case 'nao_conforme':
            convertedValue = 'Não';
            break;
          case 'nao_se_aplica':
          case null:
            convertedValue = 'Não se aplica';
            break;
          default:
            convertedValue = String(value || '');
        }
        rowVals[colIndex] = convertedValue;
        Logger.log(`   - ${fieldName}: ${convertedValue} (original: ${value})`);
      }
    };

    updateDocument(checkRgCpfCol, params['checkrg-cpf'], 'RG/CPF');
    updateDocument(checkCnhCol, params['check-cnh'], 'CNH');
    updateDocument(checkExperienciaCol, params['check-experiencia'], 'Experiência');
    updateDocument(checkRegularidadeCol, params['check-regularidade'], 'Regularidade');
    updateDocument(checkLaudoCol, params['check-laudo'], 'Laudo PCD');
    updateDocument(checkCurriculoCol, params['check-curriculo'], 'Currículo');

    if (statusFinal === 'Classificado') {
      if (capacidadeTecnicaCol >= 0 && params.capacidade_tecnica !== undefined) {
        rowVals[capacidadeTecnicaCol] = Number(params.capacidade_tecnica) || 0;
        Logger.log('   - Capacidade técnica: ' + rowVals[capacidadeTecnicaCol]);
      }
      if (experienciaCol >= 0 && params.experiencia !== undefined) {
        rowVals[experienciaCol] = Number(params.experiencia) || 0;
        Logger.log('   - Experiência: ' + rowVals[experienciaCol]);
      }
      if (pontuacaoTotalCol >= 0) {
        const total = (Number(params.capacidade_tecnica) || 0) + (Number(params.experiencia) || 0);
        rowVals[pontuacaoTotalCol] = total;
        Logger.log('   - Total score: ' + total);
      }
    }

    if (statusFinal === 'Desclassificado' && motivoCol >= 0) {
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

      rowVals[motivoCol] = motivo;
      Logger.log('📝 Motivo desclassificação: ' + motivo);
    }

    if (observacoesCol >= 0 && params.notes) {
      rowVals[observacoesCol] = params.notes;
      Logger.log('📝 Observações salvas');
    }

    _writeWholeRow_(sh, row, rowVals);

    // ✅ CORREÇÃO CRÍTICA: Invalidar cache
    _bumpRev_();

    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ TRIAGEM SALVA COM SUCESSO');
    Logger.log('   - Status final gravado: "' + statusFinal + '"');
    Logger.log('   - Linha: ' + row);
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
      error: error.toString(),
      message: 'Erro ao salvar triagem: ' + error.toString()
    };
  }
}

// ============================================
// USUÁRIOS E ANALISTAS
// ============================================

function getAnalysts() {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_USUARIOS);
  if (!sheet || !values.length) return [];

  const analysts = [];
  for (let i = 0; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    if (row.Funcao === 'Analista' || row.Funcao === 'analista') {
      analysts.push({
        email: row.Email,
        name: row.Nome
      });
    }
  }
  return analysts;
}

// ============================================
// MOTIVOS DE DESCLASSIFICAÇÃO
// ============================================

function getDisqualificationReasons() {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_MOTIVOS);
  if (!sheet || !values.length) return [];

  const reasons = [];
  for (let i = 0; i < values.length; i++) {
    const reason = {};
    for (let j = 0; j < headers.length; j++) {
      reason[headers[j]] = values[i][j];
    }
    reasons.push(reason);
  }
  return reasons;
}

function getDisqualificationReasonById(reasonId) {
  const reasons = getDisqualificationReasons();
  const reason = reasons.find(r => String(r.id) === String(reasonId));
  return reason ? reason.motivo : '';
}

// ============================================
// UTILITÁRIOS
// ============================================

function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
