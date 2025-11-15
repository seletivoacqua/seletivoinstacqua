// ============================================
// SISTEMA DE TRIAGEM – VERSÃO 2.0 COMPLETA
// CORS + COLUNAS + CASE INSENSITIVE + SETUP AUTOMÁTICO
// ============================================

const SPREADSHEET_ID = '1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY';
const SHEET_USUARIOS = 'USUARIOS';
const SHEET_CANDIDATOS = 'CANDIDATOS';
const SHEET_MOTIVOS = 'MOTIVOS';
const SHEET_MENSAGENS = 'MENSAGENS';
const SHEET_TEMPLATES = 'TEMPLATES';

const HEADER_ROWS = 1;
const COL_ID_PRIMARY = 'CPF';
const COL_ID_ALT = 'NUMEROINSCRICAO';
const CACHE_TTL_SEC = 1200;
const PROP_REV_KEY = 'IDX_REV';
const IDX_CACHE_KEY = 'idx:v';

function _ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function _sheet(name) { return _ss().getSheetByName(name); }

// ============================================
// NORMALIZAÇÃO DE CABEÇALHOS (REMOVE ACENTOS, ESPAÇOS, _)
// ============================================
function _normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function _getHeaders_(sh) {
  const lastCol = sh.getLastColumn();
  return (lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : []);
}

function _colMap_(headers) {
  const m = {};
  headers.forEach((h, i) => {
    m[h] = i;                     // original
    m[_normalizeHeader(h)] = i;   // normalizado
  });
  return m;
}

// ============================================
// CACHE E ÍNDICE
// ============================================
function _getRev_() {
  return PropertiesService.getDocumentProperties().getProperty(PROP_REV_KEY) || '0';
}

function _bumpRev_() {
  const props = PropertiesService.getDocumentProperties();
  const cur = Number(props.getProperty(PROP_REV_KEY) || '0') + 1;
  props.setProperty(PROP_REV_KEY, String(cur));
  return String(cur);
}

function _buildIndex_(sh, headers) {
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return {};

  const colMap = _colMap_(headers);
  const colCpf = colMap[COL_ID_PRIMARY] ?? colMap['cpf'] ?? -1;
  const colAlt = colMap[COL_ID_ALT] ?? colMap['numerodeinscricao'] ?? -1;
  const keyCols = [colCpf, colAlt].filter(c => c >= 0);
  if (!keyCols.length) return {};

  const values = sh.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, sh.getLastColumn()).getValues();
  const idx = {};
  for (let i = 0; i < values.length; i++) {
    for (const c of keyCols) {
      const key = values[i][c];
      if (key) {
        const row = i + HEADER_ROWS + 1;
        idx[String(key).trim()] = row;
      }
    }
  }
  return idx;
}

function _getIndex_(sh, headers) {
  const rev = _getRev_();
  const key = `${IDX_CACHE_KEY}${rev}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const idx = _buildIndex_(sh, headers);
  cache.put(key, JSON.stringify(idx), CACHE_TTL_SEC);
  return idx;
}

function _readSheetBlock_(name) {
  const sh = _sheet(name);
  if (!sh) return { sheet: null, headers: [], values: [] };
  const headers = _getHeaders_(sh);
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow <= HEADER_ROWS || lastCol === 0) {
    return { sheet: sh, headers, values: [] };
  }
  const values = sh.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, lastCol).getValues();
  return { sheet: sh, headers, values };
}

function _writeWholeRow_(sh, row, rowArray) {
  const lastCol = sh.getLastColumn();
  sh.getRange(row, 1, 1, lastCol).setValues([rowArray]);
}

// ============================================
// CORS COMPLETO
// ============================================
function createCorsResponse(data) {
  // Converte os dados para JSON
  const json = JSON.stringify(data);

  // Monta a resposta com cabeçalhos CORS no início (hack seguro)
  const response = [
    ')]}\'\n', // Proteção contra JSON hijacking
    json
  ].join('');

  // Cria o output
  const output = ContentService.createTextOutput(response);
  output.setMimeType(ContentService.MimeType.JAVASCRIPT); // JAVASCRIPT, não JSON!

  // Define cabeçalhos CORS (OBRIGATÓRIO)
  output.setResponseHeader('Access-Control-Allow-Origin', '*');
  output.setResponseHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setResponseHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  output.setResponseHeader('Access-Control-Allow-Credentials', 'true');
  output.setResponseHeader('Vary', 'Origin');

  return output;
}

// ============================================
// ROTEAMENTO (com OPTIONS)
// ============================================
// ========================================
// CORS FUNCIONA SEM CABEÇALHOS (APPS SCRIPT 2025)
// ========================================
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    let action, params;

    // POST com JSON
    if (e && e.postData && e.postData.contents) {
      const data = JSON.parse(e.postData.contents);
      action = data.action;
      params = data;
    } 
    // GET com parâmetros
    else if (e && e.parameter) {
      action = e.parameter.action;
      params = e.parameter;
    } 
    else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Nenhuma ação' }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    let result;

    // TESTE
    if (action === 'test') {
      result = { status: 'OK', time: new Date().toISOString() };
    }
    // OUTRAS AÇÕES
    else if (action === 'getUserRole') {
      result = getUserRole(params);
    }
    else if (action === 'getAnalysts') {
      result = getAnalysts();
    }
    else {
      throw new Error('Ação não encontrada: ' + action);
    }

    // RETORNA JSON (CORS AUTOMÁTICO)
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function routeAction(action, params) {
 
    const actions = {
      'getUserRole': () => getUserRole(params),
      'getAnalysts': () => getAnalysts(),
      'getCandidates': () => getCandidates(),
      'assignCandidates': () => assignCandidates(params),
      'updateCandidateStatus': () => updateCandidateStatus(params),
      'getCandidatesByStatus': () => getCandidatesByStatus(params),
      'logMessage': () => logMessage(params),
      'getDisqualificationReasons': () => getDisqualificationReasons(),
      'getMessageTemplates': () => getMessageTemplates(params),
      'sendMessages': () => sendMessages(params),
      'updateMessageStatus': () => updateMessageStatus(params),
      'moveToInterview': () => moveToInterview(params),
      'getInterviewCandidates': () => getInterviewCandidates(),
      'getInterviewers': () => getInterviewers(),
      'getInterviewerCandidates': () => getInterviewerCandidates(params),
      'allocateToInterviewer': () => allocateToInterviewer(params),
      'updateInterviewStatus': () => updateInterviewStatus(params),
      'saveInterviewEvaluation': () => saveInterviewEvaluation(params),
      'getReportStats': () => getReportStats(),
      'getReport': () => getReport(params),
      'getEmailAliases': () => getEmailAliases(),
      'test': () => testConnection(),
      'setup': () => setupAllSheets()
    };

    if (!actions[action]) throw new Error('Ação não encontrada: ' + action);
  return actions[action]();
}

// ============================================
// SETUP AUTOMÁTICO (RODE UMA VEZ)
// ============================================
function setupAllSheets() {
  initUsuariosSheet();
  initMotivosSheet();
  initMensagensSheet();
  initTemplatesSheet();
  addStatusColumnIfNotExists();
  _bumpRev_();
  return { success: true, message: 'Setup completo!' };
}

// ============================================
// USUÁRIOS
// ============================================
function initUsuariosSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USUARIOS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USUARIOS);
    sheet.getRange('A1:G1').setValues([['Email', 'Nome', 'Role', 'ID', 'DataCriacao', 'Ativo', 'Password']]);
    const defaultUsers = [
      ['rayannyrego@gmail.com', 'Rayanny Rego', 'admin', 'rayannyrego@gmail.com', '07/11/2025', 'TRUE', 'Admin@2024!Hospital'],
      ['incom.slz@gmail.com', 'Analista Teste', 'analista', 'incom.slz@gmail.com', '07/11/2025', 'TRUE', 'Teste@2024'],
      ['nbconsultoriasistema@gmail.com', 'Entrevistador Teste', 'entrevistador', 'nbconsultoriasistema@gmail.com', '12/11/2025', 'TRUE', 'Teste@2024']
    ];
    sheet.getRange(2, 1, defaultUsers.length, 7).setValues(defaultUsers);
    sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  } else {
    // CORREÇÃO CRÍTICA: Verificar e adicionar coluna ID na posição correta
    const headers = _getHeaders_(sheet);
    const idIndex = headers.indexOf('ID');

    if (idIndex === -1) {
      Logger.log('⚠️ Coluna ID não encontrada na planilha USUARIOS');
      Logger.log('📋 Estrutura atual:', headers.join(', '));

      // Inserir coluna ID após Role (posição D)
      sheet.insertColumnAfter(3); // Insere coluna após C (Role)
      sheet.getRange(1, 4).setValue('ID').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');

      // Preencher IDs existentes com emails
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const email = data[i][0]; // Coluna A
        if (email) {
          sheet.getRange(i + 1, 4).setValue(email); // Coluna D
        }
      }

      Logger.log('✅ Coluna ID adicionada na posição D');
      Logger.log('✅ IDs preenchidos com emails');
    }

    // Log da estrutura final
    const finalHeaders = _getHeaders_(sheet);
    Logger.log('📋 Estrutura final da planilha USUARIOS:');
    finalHeaders.forEach((h, i) => {
      Logger.log(`  [${String.fromCharCode(65 + i)}] ${h}`);
    });
  }
  return sheet;
}

function getUserRole(params) {
  const sheet = initUsuariosSheet();
  const data = sheet.getDataRange().getValues();
  const emailToFind = params.email?.toLowerCase().trim();

  if (!emailToFind) throw new Error('Email obrigatório');

  for (let i = 1; i < data.length; i++) {
    const email = data[i][0]?.toLowerCase().trim();
    if (email === emailToFind) {
      // CORREÇÃO: Normaliza o role para lowercase para garantir compatibilidade
      const rawRole = String(data[i][2]).toLowerCase().trim();

      return {
        email: data[i][0],
        name: data[i][1] || data[i][0],
        role: rawRole, // Retorna sempre em lowercase
        id: data[i][3] || data[i][0],
        active: true
      };
    }
  }
  throw new Error('Usuário não encontrado');
}

function getAnalysts() {
  const sheet = initUsuariosSheet();
  const data = sheet.getDataRange().getValues();
  const analysts = [];

  for (let i = 1; i < data.length; i++) {
    const role = String(data[i][2]).toLowerCase().trim();
    if (role === 'analista') {
      analysts.push({
        id: data[i][3],
        email: data[i][0],
        name: data[i][1] || data[i][0],
        role: 'analista',
        active: true
      });
    }
  }
  return { analysts };
}

function getInterviewers() {
  const sheet = initUsuariosSheet();
  const data = sheet.getDataRange().getValues();
  const interviewers = [];

  for (let i = 1; i < data.length; i++) {
    const role = String(data[i][2]).toLowerCase().trim();
    if (role === 'entrevistador') {
      interviewers.push({
        id: data[i][3],
        email: data[i][0],
        name: data[i][1] || data[i][0],
        role: 'entrevistador',
        active: true
      });
    }
  }
  return interviewers;
}

// ============================================
// CANDIDATOS
// ============================================
function getCandidates() {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return { candidates: [] };
  return {
    candidates: values.map(row => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      return obj;
    })
  };
}

function updateCandidateStatus(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  const statusCol = col['Status'] ?? col['status'];
  const cpfCol = col['CPF'] ?? col['cpf'];
  const regNumCol = col['NUMEROINSCRICAO'] ?? col['numerodeinscricao'];
  const analystCol = col['Analista'] ?? col['analista'] ?? col['assigned_to'];
  const dateCol = col['Data Triagem'] ?? col['datatriagem'];
  const reasonCol = col['Motivo Desclassificação'] ?? col['motivodesclassificacao'];
  const notesCol = col['Observações'] ?? col['observacoes'];

  const idx = _getIndex_(sh, headers);
  const key = String(params.registrationNumber).trim();
  let row = idx[key];

  if (!row) {
    const newIdx = _buildIndex_(sh, headers);
    const rev = _getRev_();
    CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
    row = newIdx[key];
  }
  if (!row) throw new Error('Candidato não encontrado');

  const rowVals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  if (statusCol >= 0) rowVals[statusCol] = params.statusTriagem;
  if (analystCol >= 0 && params.analystEmail) rowVals[analystCol] = params.analystEmail;
  if (dateCol >= 0) rowVals[dateCol] = new Date().toISOString();
  if (reasonCol >= 0 && params.reasonId) rowVals[reasonCol] = getDisqualificationReasonById(params.reasonId);
  if (notesCol >= 0 && params.notes) rowVals[notesCol] = params.notes;

  _writeWholeRow_(sh, row, rowVals);
  _bumpRev_();
  return { success: true };
}

function getCandidatesByStatus(params) {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return [];

  const col = _colMap_(headers);
  const statusCol = col['Status'] ?? col['status'];
  if (statusCol === undefined) return [];

  const target = String(params.status).toLowerCase().trim();
  const filtered = [];

  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][statusCol]).toLowerCase().trim();
    if (status === target) {
      const obj = {};
      headers.forEach((h, j) => obj[h] = values[i][j]);
      obj.id = obj.CPF || obj.NUMEROINSCRICAO;
      obj.registration_number = obj.NUMEROINSCRICAO || obj.CPF;
      filtered.push(obj);
    }
  }
  return filtered;
}

// ============================================
// MOTIVOS DE DESCLASSIFICAÇÃO
// ============================================
function initMotivosSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MOTIVOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MOTIVOS);
    sheet.getRange('A1:C1').setValues([['ID', 'Motivo', 'Ativo']]);
    const motivos = [
      ['M001', 'Documentação incompleta', 'Sim'],
      ['M002', 'Não atende aos requisitos mínimos da vaga', 'Sim'],
      ['M003', 'Formação incompatível com a vaga', 'Sim'],
      ['M004', 'Experiência insuficiente', 'Sim'],
      ['M005', 'Documentos ilegíveis ou com qualidade inadequada', 'Sim'],
      ['M006', 'Dados inconsistentes ou contraditórios', 'Sim'],
      ['M007', 'Não apresentou documentos obrigatórios', 'Sim'],
      ['M008', 'Fora do prazo de inscrição', 'Sim'],
      ['M009', 'Outros motivos', 'Sim']
    ];
    sheet.getRange(2, 1, motivos.length, 3).setValues(motivos);
  }
  return sheet;
}

function getDisqualificationReasons() {
  const sheet = initMotivosSheet();
  const data = sheet.getDataRange().getValues();
  const reasons = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === 'Sim') {
      reasons.push({ id: data[i][0], reason: data[i][1], is_active: true });
    }
  }
  return reasons;
}

function getDisqualificationReasonById(reasonId) {
  const sheet = initMotivosSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === reasonId) return data[i][1];
  }
  return 'Motivo não especificado';
}

// ============================================
// MENSAGENS E TEMPLATES
// ============================================
function initMensagensSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MENSAGENS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MENSAGENS);
    sheet.getRange('A1:H1').setValues([['Data/Hora', 'Número Inscrição', 'Tipo', 'Destinatário', 'Assunto', 'Conteúdo', 'Enviado Por', 'Status']]);
  }
  return sheet;
}

function logMessage(params) {
  const sheet = initMensagensSheet();
  sheet.appendRow([
    new Date().toISOString(),
    params.registrationNumber,
    params.messageType,
    params.recipient,
    params.subject || '',
    params.content,
    params.sentBy,
    params.status || 'pendente'
  ]);
  return true;
}

function initTemplatesSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_TEMPLATES);
  if (!sheet) {  // CORRIGIDO: era !2sheet
    sheet = ss.insertSheet(SHEET_TEMPLATES);
    sheet.getRange('A1:E1').setValues([['ID', 'Nome', 'Tipo', 'Assunto', 'Conteúdo']]);
    const templates = [
      ['T001', 'Classificado - Email', 'email', 'Processo Seletivo - Você foi classificado!', 'Prezado(a) [NOME],\n\nParabéns! Você foi classificado(a) no processo seletivo para a vaga de [CARGO] na área [AREA].\n\nEm breve entraremos em contato com informações sobre as próximas etapas do processo.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção'],
      ['T002', 'Classificado - SMS', 'sms', '', 'Parabéns [NOME]! Você foi classificado no processo seletivo para [CARGO]. Aguarde contato para próximas etapas.'],
      ['T003', 'Desclassificado - Email', 'email', 'Processo Seletivo - Resultado da Análise', 'Prezado(a) [NOME],\n\nAgradecemos seu interesse em fazer parte da nossa equipe.\n\nInfelizmente, nesta etapa do processo seletivo, seu perfil não foi selecionado para a vaga de [CARGO].\n\nDesejamos muito sucesso em sua jornada profissional.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção'],
      ['T004', 'Em Revisão - Email', 'email', 'Processo Seletivo - Análise em Andamento', 'Prezado(a) [NOME],\n\nSeu cadastro para a vaga de [CARGO] está sendo revisado pela nossa equipe de análise.\n\nEm breve daremos retorno sobre o andamento do seu processo seletivo.\n\nAtenciosamente,\nEquipe de Recrutamento e Seleção']
    ];
    sheet.getRange(2, 1, templates.length, 5).setValues(templates);
  }
  return sheet;
}

function getMessageTemplates(params) {
  const sheet = initTemplatesSheet();
  const data = sheet.getDataRange().getValues();
  const templates = [];
  const messageType = params?.messageType;
  for (let i = 1; i < data.length; i++) {
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
// ENVIO DE MENSAGENS (TWILIO + GMAIL)
// ============================================
function getEmailAliases() {
  try {
    return GmailApp.getAliases();
  } catch (e) {
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
  let cleaned = String(phone).replace(/\D/g, '').replace(/^0+/, '');
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return '+' + cleaned;
}

function _sendSmsTwilio_(to, body) {
  if (!_twilioEnabled_()) return { ok: false, skipped: true, error: 'Twilio não configurado' };
  const sid = _getProp_('TWILIO_SID');
  const token = _getProp_('TWILIO_TOKEN');
  const from = _getProp_('TWILIO_FROM');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const payload = { To: _formatE164_(to), From: from, Body: body };
  const options = {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) }
  };
  try {
    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() >= 200 && res.getResponseCode() < 300 ? { ok: true } : { ok: false, error: res.getContentText() };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function _sendEmailGmail_(to, subject, body, alias) {
  try {
    const options = { htmlBody: body };
    if (alias) {
      const aliases = GmailApp.getAliases();
      if (aliases.includes(alias)) options.from = alias;
    }
    const msg = GmailApp.sendEmail(to, subject, body, options);
    return { ok: true, messageId: msg.getId(), from: options.from || Session.getActiveUser().getEmail() };
  } catch (e) {
    try {
      const msg = GmailApp.sendEmail(to, subject, body);
      return { ok: true, messageId: msg.getId(), from: Session.getActiveUser().getEmail(), fallback: true };
    } catch (e2) {
      return { ok: false, error: e2.toString() };
    }
  }
}

function _applyTemplate_(text, candidate) {
  if (!text) return '';
  return String(text)
    .replace(/\[NOME\]/g, candidate.NOMECOMPLETO || candidate.NOMESOCIAL || '')
    .replace(/\[CARGO\]/g, candidate.CARGOPRETENDIDO || '')
    .replace(/\[AREA\]/g, candidate.AREAATUACAO || '');
}

function _pickEmailFromRow_(headers, row) {
  const col = _colMap_(headers);
  const emailCol = col['Email'] ?? col['email'];
  return emailCol >= 0 ? String(row[emailCol]).trim() : '';
}

function _pickPhoneFromRow_(headers, row) {
  const col = _colMap_(headers);
  const phoneCol = col['Telefone'] ?? col['telefone'];
  return phoneCol >= 0 ? String(row[phoneCol]).trim() : '';
}

function _updateMessageStatusInCandidates_(cpf, messageType) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);
    const cpfCol = col['CPF'] ?? col['cpf'];
    const targetCol = messageType === 'email' ? (col['EMAIL_SENT'] ?? col['emailsent']) : (col['SMS_SENT'] ?? col['smssent']);
    if (targetCol === undefined || targetCol < 0) return;

    const idx = _getIndex_(sh, headers);
    const row = idx[String(cpf).trim()];
    if (row) sh.getRange(row, targetCol + 1).setValue('Sim');
  } catch (e) { }
}

function sendMessages(params) {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet) throw new Error('Planilha não encontrada');
  const col = _colMap_(headers);
  const cpfCol = col['CPF'] ?? col['cpf'];
  const regNumCol = col['NUMEROINSCRICAO'] ?? col['numerodeinscricao'];
  const targetIds = (params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  let successCount = 0, failCount = 0;

  for (let i = 0; i < values.length; i++) {
    const cpf = String(values[i][cpfCol] || '').trim();
    const regNum = String(values[i][regNumCol] || '').trim();
    const candidateId = cpf || regNum;

    if (!targetIds.includes(candidateId) && !targetIds.includes(cpf) && !targetIds.includes(regNum)) continue;

    const candidate = {};
    headers.forEach((h, j) => candidate[h] = values[i][j]);
    const nome = candidate.NOMECOMPLETO || candidate.NOMESOCIAL || 'Candidato';
    let recipient, result;

    if (params.messageType === 'email') {
      recipient = _pickEmailFromRow_(headers, values[i]);
      if (!recipient) {
        results.push({ candidateId: candidateId, candidateName: nome, success: false, error: 'Email não cadastrado' });
        failCount++; continue;
      }
      const subj = _applyTemplate_(params.subject, candidate);
      const body = _applyTemplate_(params.content, candidate);
      result = _sendEmailGmail_(recipient, subj, body, params.fromAlias);
      logMessage({ registrationNumber: candidateId, messageType: 'email', recipient, subject: subj, content: body, sentBy: params.sentBy, status: result.ok ? 'enviado' : 'falhou' });
    } else if (params.messageType === 'sms') {
      recipient = _pickPhoneFromRow_(headers, values[i]);
      if (!recipient) {
        results.push({ candidateId: candidateId, candidateName: nome, success: false, error: 'Telefone não cadastrado' });
        failCount++; continue;
      }
      const body = _applyTemplate_(params.content, candidate);
      result = _sendSmsTwilio_(recipient, body);
      if (result.skipped) {
        results.push({ candidateId: candidateId, candidateName: nome, success: false, error: 'Twilio não configurado' });
        failCount++; continue;
      }
      logMessage({ registrationNumber: candidateId, messageType: 'sms', recipient, subject: '', content: body, sentBy: params.sentBy, status: result.ok ? 'enviado' : 'falhou' });
    } else {
      throw new Error('Tipo inválido');
    }

    if (result.ok) {
      successCount++;
      _updateMessageStatusInCandidates_(candidateId, params.messageType);
      results.push({ candidateId: candidateId, candidateName: nome, success: true });
    } else {
      failCount++;
      results.push({ candidateId: candidateId, candidateName: nome, success: false, error: result.error || 'Erro' });
    }
  }
  return { successCount, failCount, results };
}

function updateMessageStatus(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const targetCol = params.messageType === 'email' ? (col['EMAIL_SENT'] ?? col['emailsent']) : (col['SMS_SENT'] ?? col['smssent']);
  if (targetCol === undefined) throw new Error('Coluna não encontrada');

  const idx = _getIndex_(sh, headers);

  // Aceita tanto registrationNumber (string) quanto registrationNumbers (array ou string separado por vírgulas)
  const keys = params.registrationNumbers
    ? (Array.isArray(params.registrationNumbers)
        ? params.registrationNumbers
        : String(params.registrationNumbers).split(',').map(s => s.trim()).filter(Boolean))
    : [String(params.registrationNumber || '').trim()];

  let updated = 0;
  for (const key of keys) {
    let row = idx[key];
    if (!row) {
      const newIdx = _buildIndex_(sh, headers);
      const rev = _getRev_();
      CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
      row = newIdx[key];
    }
    if (row) {
      sh.getRange(row, targetCol + 1).setValue('Sim');
      updated++;
    }
  }

  _bumpRev_();
  return { success: true, updated };
}

// ============================================
// ENTREVISTA
// ============================================
function getInterviewCandidates() {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return [];
  const col = _colMap_(headers);
  const statusCol = col['status_entrevista'] ?? col['statusentrevista'];
  if (statusCol === undefined) return [];
  const candidates = [];
  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][statusCol]).toLowerCase().trim();
    if (status === 'aguardando') {
      const obj = {};
      headers.forEach((h, j) => obj[h] = values[i][j]);
      obj.id = obj.CPF || obj.NUMEROINSCRICAO;
      candidates.push(obj);
    }
  }
  return candidates;
}

function moveToInterview(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const statusCol = col['status_entrevista'] ?? col['statusentrevista'];
  const cpfCol = col['CPF'] ?? col['cpf'];
  const emailSentCol = col['EMAIL_SENT'] ?? col['emailsent'];
  const smsSentCol = col['SMS_SENT'] ?? col['smssent'];
  if (statusCol === undefined) throw new Error('Coluna status_entrevista não encontrada');

  const candidateIds = (params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return { success: true, movedCount: 0 };

  const n = lastRow - HEADER_ROWS;
  const cpfs = sh.getRange(HEADER_ROWS + 1, cpfCol + 1, n, 1).getValues().map(r => String(r[0]).trim());
  const status = sh.getRange(HEADER_ROWS + 1, statusCol + 1, n, 1).getValues();
  const emailSent = emailSentCol >= 0 ? sh.getRange(HEADER_ROWS + 1, emailSentCol + 1, n, 1).getValues() : null;
  const smsSent = smsSentCol >= 0 ? sh.getRange(HEADER_ROWS + 1, smsSentCol + 1, n, 1).getValues() : null;

  const pos = new Map();
  for (let i = 0; i < cpfs.length; i++) pos.set(cpfs[i], i);

  let movedCount = 0;
  for (const cpf of candidateIds) {
    const i = pos.get(cpf);
    if (i === undefined) continue;
    const hasMsg = (emailSent && (emailSent[i][0] === 'Sim' || emailSent[i][0] === true)) || (smsSent && (smsSent[i][0] === 'Sim' || smsSent[i][0] === true));
    if (!hasMsg) continue;
    status[i][0] = 'Aguardando';
    movedCount++;
  }
  if (movedCount > 0) {
    sh.getRange(HEADER_ROWS + 1, statusCol + 1, n, 1).setValues(status);
    _bumpRev_();
  }
  return { success: true, movedCount, message: movedCount + ' movido(s)' };
}

function getInterviewerCandidates(params) {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return [];
  const col = _colMap_(headers);
  const entrevistadorCol = col['entrevistador'] ?? col['entrevistador'];
  if (entrevistadorCol === undefined) return [];
  const email = params.interviewerEmail?.toLowerCase().trim();
  const candidates = [];
  for (let i = 0; i < values.length; i++) {
    const e = String(values[i][entrevistadorCol]).toLowerCase().trim();
    if (e === email) {
      const obj = {};
      headers.forEach((h, j) => obj[h] = values[i][j]);
      obj.id = obj.CPF || obj.NUMEROINSCRICAO;
      candidates.push(obj);
    }
  }
  return candidates;
}

function allocateToInterviewer(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const entrevistadorCol = col['entrevistador'] ?? col['entrevistador'];
  const dataCol = col['entrevistador_at'] ?? col['entrevistadorat'];
  const cpfCol = col['CPF'] ?? col['cpf'];
  if (entrevistadorCol === undefined) throw new Error('Coluna não encontrada');

  const candidateIds = (params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return { success: true, allocatedCount: 0 };

  const n = lastRow - HEADER_ROWS;
  const cpfs = sh.getRange(HEADER_ROWS + 1, cpfCol + 1, n, 1).getValues().map(r => String(r[0]).trim());
  const entrevistador = sh.getRange(HEADER_ROWS + 1, entrevistadorCol + 1, n, 1).getValues();
  const data = dataCol >= 0 ? sh.getRange(HEADER_ROWS + 1, dataCol + 1, n, 1).getValues() : null;

  const pos = new Map();
  for (let i = 0; i < cpfs.length; i++) pos.set(cpfs[i], i);

  let count = 0;
  const stamp = new Date().toISOString();
  for (const cpf of candidateIds) {
    const i = pos.get(cpf);
    if (i === undefined) continue;
    entrevistador[i][0] = params.interviewerEmail;
    if (data) data[i][0] = stamp;
    count++;
  }
  if (count > 0) {
    sh.getRange(HEADER_ROWS + 1, entrevistadorCol + 1, n, 1).setValues(entrevistador);
    if (data && dataCol >= 0) sh.getRange(HEADER_ROWS + 1, dataCol + 1, n, 1).setValues(data);
    _bumpRev_();
  }
  return { success: true, allocatedCount: count };
}

function updateInterviewStatus(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const statusCol = col['status_entrevista'] ?? col['statusentrevista'];
  const entrevistadorCol = col['entrevistador'] ?? col['entrevistador'];
  const dataCol = col['entrevistador_at'] ?? col['entrevistadorat'];
  const idx = _getIndex_(sh, headers);
  const key = String(params.registrationNumber).trim();
  let row = idx[key];
  if (!row) {
    const newIdx = _buildIndex_(sh, headers);
    const rev = _getRev_();
    CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
    row = newIdx[key];
  }
  if (!row) throw new Error('Candidato não encontrado');
  const rowVals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  if (statusCol >= 0) rowVals[statusCol] = params.status;
  if (entrevistadorCol >= 0 && params.interviewerEmail) rowVals[entrevistadorCol] = params.interviewerEmail;
  if (dataCol >= 0) rowVals[dataCol] = new Date().toISOString();
  _writeWholeRow_(sh, row, rowVals);
  _bumpRev_();
  return { success: true };
}

function saveInterviewEvaluation(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const idx = _getIndex_(sh, headers);

  // Aceita tanto candidateId quanto registrationNumber
  const key = String(params.candidateId || params.registrationNumber || '').trim();
  let row = idx[key];
  if (!row) {
    const newIdx = _buildIndex_(sh, headers);
    const rev = _getRev_();
    CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
    row = newIdx[key];
  }
  if (!row) throw new Error('Candidato não encontrado');

  const rowVals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];

  const secao1 = (Number(params.formacao_adequada) + Number(params.graduacoes_competencias)) * 2;
  const secao2 = (Number(params.descricao_processos) + Number(params.terminologia_tecnica) + Number(params.calma_clareza)) * 2;
  const secao3 = Number(params.escalas_flexiveis) + Number(params.adaptabilidade_mudancas) + Number(params.ajustes_emergencia);
  const secao4 = Number(params.residencia);
  const secao5 = (Number(params.resolucao_conflitos) + Number(params.colaboracao_equipe) + Number(params.adaptacao_perfis)) * 2;
  const totalScore = secao1 + secao2 + secao3 + secao4 + secao5;

  const fields = {
    'status_entrevista': 'Avaliado',
    'entrevistador': params.interviewerEmail,
    'entrevistador_at': new Date().toISOString(),
    'interview_completed_at': params.completed_at || new Date().toISOString(),
    'interview_score': totalScore,
    'interview_result': params.interview_result || params.resultado,
    'interview_notes': params.interview_notes || params.impressao_perfil,
    'formacao_adequada': params.formacao_adequada,
    'graduacoes_competencias': params.graduacoes_competencias,
    'descricao_processos': params.descricao_processos,
    'terminologia_tecnica': params.terminologia_tecnica,
    'calma_clareza': params.calma_clareza,
    'escalas_flexiveis': params.escalas_flexiveis,
    'adaptabilidade_mudancas': params.adaptabilidade_mudancas,
    'ajustes_emergencia': params.ajustes_emergencia,
    'residencia': params.residencia,
    'resolucao_conflitos': params.resolucao_conflitos,
    'colaboracao_equipe': params.colaboracao_equipe,
    'adaptacao_perfis': params.adaptacao_perfis
  };

  for (const [key, value] of Object.entries(fields)) {
    const c = col[key] ?? col[_normalizeHeader(key)];
    if (c >= 0 && value !== undefined) rowVals[c] = value;
  }

  _writeWholeRow_(sh, row, rowVals);
  _bumpRev_();
  return { success: true, score: totalScore, resultado: fields.interview_result };
}

// ============================================
// RELATÓRIOS
// ============================================
function getReportStats() {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return { classificados: 0, desclassificados: 0, entrevistaClassificados: 0, entrevistaDesclassificados: 0 };
  const col = _colMap_(headers);
  const statusCol = col['Status'] ?? col['status'];
  const entCol = col['status_entrevista'] ?? col['statusentrevista'];
  const resultCol = col['interview_result'] ?? col['interviewresult'];

  let c = 0, d = 0, ec = 0, ed = 0;
  for (let i = 0; i < values.length; i++) {
    const s = String(values[i][statusCol]).toLowerCase().trim();
    const e = String(values[i][entCol]).toLowerCase().trim();
    const r = String(values[i][resultCol]).toLowerCase().trim();
    if (s === 'classificado') c++;
    if (s === 'desclassificado') d++;
    if (e === 'avaliado' && r === 'classificado') ec++;
    if (e === 'avaliado' && r === 'desclassificado') ed++;
  }
  return { classificados: c, desclassificados: d, entrevistaClassificados: ec, entrevistaDesclassificados: ed };
}

function getReport(params) {
  const { sheet, headers, values } = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!values.length) return [];
  const col = _colMap_(headers);
  const statusCol = col['Status'] ?? col['status'];
  const entCol = col['status_entrevista'] ?? col['statusentrevista'];
  const resultCol = col['interview_result'] ?? col['interviewresult'];
  const analystCol = col['Analista'] ?? col['analista'];
  const type = params.reportType;
  const analyst = params.analystEmail?.toLowerCase().trim();
  const list = [];

  for (let i = 0; i < values.length; i++) {
    const s = String(values[i][statusCol]).toLowerCase().trim();
    const e = String(values[i][entCol]).toLowerCase().trim();
    const r = String(values[i][resultCol]).toLowerCase().trim();
    const a = analystCol >= 0 ? String(values[i][analystCol]).toLowerCase().trim() : '';

    if (analyst && a !== analyst) continue;

    let include = false;
    if (type === 'classificados' && s === 'classificado') include = true;
    if (type === 'desclassificados' && s === 'desclassificado') include = true;
    if (type === 'entrevista_classificados' && e === 'avaliado' && r === 'classificado') include = true;
    if (type === 'entrevista_desclassificados' && e === 'avaliado' && r === 'desclassificado') include = true;

    if (include) {
      const obj = {};
      headers.forEach((h, j) => obj[h] = values[i][j]);
      list.push(obj);
    }
  }
  return list;
}

// ============================================
// COLUNAS OBRIGATÓRIAS
// ============================================
function addStatusColumnIfNotExists() {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const required = [
    'Status','Motivo Desclassificação','Observações','Data Triagem','Analista','NUMEROINSCRICAO',
    'EMAIL_SENT','SMS_SENT','status_entrevista','entrevistador','entrevistador_at','entrevistador_by',
    'interview_score','interview_result','interview_notes','interview_completed_at',
    'formacao_adequada','graduacoes_competencias','descricao_processos','terminologia_tecnica',
    'calma_clareza','escalas_flexiveis','adaptabilidade_mudancas','ajustes_emergencia',
    'residencia','resolucao_conflitos','colaboracao_equipe','adaptacao_perfis',
    'assigned_to','assigned_at','assigned_by','DataCadastro','updated_at','Telefone','Email',
    'documento_1','documento_2','documento_3','documento_4','documento_5',
    'capacidade_tecnica','conforme','nao_conforme','nao_se_aplica','experiencia','total_score',
    'analystEmail','notes','screenedAt'
  ];
  let added = false;
  required.forEach(col => {
    if (headers.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      added = true;
    }
  });
  if (added) _bumpRev_();
}

// ============================================
// TESTE
// ============================================
function testConnection() {
  return { status: 'OK', timestamp: new Date().toISOString(), spreadsheetId: SPREADSHEET_ID };
}

function assignCandidates(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);
  const cpfCol = col['CPF'] ?? col['cpf'];
  const assignedToCol = col['assigned_to'] ?? col['analista'];
  const assignedByCol = col['assigned_by'];
  const assignedAtCol = col['assigned_at'];
  const statusCol = col['Status'] ?? col['status'];
  if (cpfCol == null) throw new Error('Coluna CPF não encontrada');

  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS) return { success: true, assignedCount: 0 };

  const n = lastRow - HEADER_ROWS;
  const cpfs = sh.getRange(HEADER_ROWS + 1, cpfCol + 1, n, 1).getValues().map(r => String(r[0]).trim());
  const assignedTo = assignedToCol != null ? sh.getRange(HEADER_ROWS + 1, assignedToCol + 1, n, 1).getValues() : null;
  const assignedBy = assignedByCol != null ? sh.getRange(HEADER_ROWS + 1, assignedByCol + 1, n, 1).getValues() : null;
  const assignedAt = assignedAtCol != null ? sh.getRange(HEADER_ROWS + 1, assignedAtCol + 1, n, 1).getValues() : null;
  const status = statusCol != null ? sh.getRange(HEADER_ROWS + 1, statusCol + 1, n, 1).getValues() : null;

  const target = (params.candidateIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const stamp = new Date().toISOString();
  let count = 0;
  const pos = new Map();
  for (let i = 0; i < cpfs.length; i++) pos.set(cpfs[i], i);

  for (const id of target) {
    const i = pos.get(id);
    if (i == null) continue;
    if (assignedTo) assignedTo[i][0] = params.analystEmail || '';
    if (assignedBy) assignedBy[i][0] = params.adminEmail || '';
    if (assignedAt) assignedAt[i][0] = stamp;
    if (status) status[i][0] = 'em_analise';
    count++;
  }

  if (assignedTo) sh.getRange(HEADER_ROWS + 1, assignedToCol + 1, n, 1).setValues(assignedTo);
  if (assignedBy) sh.getRange(HEADER_ROWS + 1, assignedByCol + 1, n, 1).setValues(assignedBy);
  if (assignedAt) sh.getRange(HEADER_ROWS + 1, assignedAtCol + 1, n, 1).setValues(assignedAt);
  if (status) sh.getRange(HEADER_ROWS + 1, statusCol + 1, n, 1).setValues(status);

  return { success: true, assignedCount: count };
}

function getSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
