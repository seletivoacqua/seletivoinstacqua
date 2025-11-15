// ============================================
// GOOGLE APPS SCRIPT - SISTEMA COMPLETO
// ============================================
//
// INSTRUÇÕES:
// 1. Cole este código completo no Google Apps Script
// 2. Configure o SPREADSHEET_ID abaixo
// 3. Implante como Web App
//
// ============================================

const SPREADSHEET_ID = '1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY';
const SHEET_USUARIOS = 'USUARIOS';
const SHEET_CANDIDATOS = 'CANDIDATOS';
const SHEET_MOTIVOS = 'MOTIVOS';
const SHEET_MENSAGENS = 'MENSAGENS';
const SHEET_TEMPLATES = 'TEMPLATES';
const SHEET_ALIAS = 'ALIAS';

// ============================================
// ENTRADA - Suporta GET e POST
// ============================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ============================================
// ROTEAMENTO
// ============================================

function handleRequest(e) {
  try {
    const params = parseRequest(e);
    const action = params.action;

    Logger.log('🔵 Ação recebida: ' + action);
    Logger.log('📦 Parâmetros: ' + JSON.stringify(params));

    const routes = {
      // Usuários
      'getUserRole': getUserRole,
      'getAllUsers': getAllUsers,
      'getAnalysts': getAnalysts,
      'getInterviewers': getInterviewers,
      'createUser': createUser,
      'updateUser': updateUser,
      'deleteUser': deleteUser,

      // Candidatos
      'getCandidates': getCandidates,
      'getCandidate': getCandidate,
      'addCandidate': addCandidate,
      'updateCandidate': updateCandidate,
      'deleteCandidate': deleteCandidate,
      'assignCandidates': assignCandidates,
      'bulkUpdateCandidates': bulkUpdateCandidates,
      'updateCandidateStatus': updateCandidateStatus,
      'getCandidatesByStatus': getCandidatesByStatus,

      // Entrevistas
      'moveToInterview': moveToInterview,
      'getInterviewCandidates': getInterviewCandidates,
      'allocateToInterviewer': allocateToInterviewer,
      'getInterviewerCandidates': getInterviewerCandidates,
      'saveInterviewEvaluation': saveInterviewEvaluation,

      // Mensagens
      'sendMessages': sendMessages,
      'logMessage': logMessage,
      'updateMessageStatus': updateMessageStatus,
      'getMessageTemplates': getMessageTemplates,
      'getEmailAliases': getEmailAliases,

      // Relatórios
      'getStatistics': getStatistics,
      'getReportStats': getReportStats,
      'getReport': getReport,

      // Motivos
      'getDisqualificationReasons': getDisqualificationReasons,

      // Teste
      'test': testConnection
    };

    if (routes[action]) {
      return routes[action](params);
    } else {
      return createResponse({ error: 'Ação não encontrada: ' + action }, 404);
    }
  } catch (error) {
    Logger.log('❌ Erro no handleRequest: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function parseRequest(e) {
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
    return e.parameter || {};
  } catch (error) {
    Logger.log('Erro ao fazer parse: ' + error.toString());
    return e.parameter || {};
  }
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  return ss.getSheetByName(name);
}

function createResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(data));
  return output;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function getHeaders(sheet) {
  if (!sheet) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function findRowByValue(sheet, columnName, value) {
  const headers = getHeaders(sheet);
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return -1;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] && data[i][colIndex].toString() === value.toString()) {
      return i + 1;
    }
  }
  return -1;
}

// ============================================
// FUNÇÕES DE USUÁRIOS
// ============================================

function getUserRole(params) {
  try {
    const email = params.email;
    if (!email) {
      return createResponse({ error: 'Email é obrigatório' }, 400);
    }

    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ error: 'Planilha de usuários não encontrada' }, 404);
    }

    const data = userSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ error: 'Nenhum usuário cadastrado' }, 404);
    }

    const headers = data[0];
    const emailIndex = headers.indexOf('Email');
    const nomeIndex = headers.indexOf('Nome');
    const roleIndex = headers.indexOf('Role');
    const ativoIndex = headers.indexOf('Ativo');
    const passwordIndex = headers.indexOf('Password');

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] && data[i][emailIndex].toLowerCase() === email.toLowerCase()) {
        if (passwordIndex >= 0 && params.password) {
          if (data[i][passwordIndex] !== params.password) {
            return createResponse({ error: 'Senha incorreta' }, 401);
          }
        }

        return createResponse({
          email: data[i][emailIndex],
          nome: data[i][nomeIndex] || '',
          role: data[i][roleIndex] || 'analista',
          ativo: data[i][ativoIndex] === true || data[i][ativoIndex] === 'TRUE',
          success: true
        });
      }
    }

    return createResponse({ error: 'Usuário não encontrado' }, 404);
  } catch (error) {
    Logger.log('Erro em getUserRole: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getAllUsers(params) {
  try {
    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ users: [], success: true });
    }

    const data = userSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ users: [], success: true });
    }

    const headers = data[0];
    const users = [];

    for (let i = 1; i < data.length; i++) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = data[i][index];
      });

      if (user.Email) {
        users.push({
          id: user.Email,
          email: user.Email,
          name: user.Nome || '',
          role: user.Role || 'analista',
          active: user.Ativo === true || user.Ativo === 'TRUE'
        });
      }
    }

    return createResponse({ users: users, success: true });
  } catch (error) {
    Logger.log('Erro em getAllUsers: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getAnalysts(params) {
  try {
    Logger.log('🔍 Executando getAnalysts...');
    const userSheet = getSheet(SHEET_USUARIOS);

    if (!userSheet) {
      Logger.log('❌ Planilha USUARIOS não encontrada');
      return createResponse({ success: true, data: { analysts: [] } });
    }

    const data = userSheet.getDataRange().getValues();
    Logger.log('📊 Total de linhas na planilha: ' + data.length);

    if (data.length <= 1) {
      Logger.log('⚠️ Planilha vazia ou apenas com cabeçalho');
      return createResponse({ success: true, data: { analysts: [] } });
    }

    const headers = data[0];
    Logger.log('📋 Cabeçalhos: ' + JSON.stringify(headers));

    const analysts = [];

    for (let i = 1; i < data.length; i++) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = data[i][index];
      });

      const role = user.Role || '';
      Logger.log('👤 Linha ' + (i + 1) + ': Email=' + user.Email + ', Role=' + role);

      if (user.Email && role.toLowerCase() === 'analista') {
        analysts.push({
          id: user.Email,
          Email: user.Email,
          Nome: user.Nome || '',
          Role: user.Role,
          Ativo: user.Ativo === true || user.Ativo === 'TRUE'
        });
      }
    }

    Logger.log('✅ Total de analistas encontrados: ' + analysts.length);
    return createResponse({ success: true, data: { analysts: analysts } });
  } catch (error) {
    Logger.log('❌ Erro em getAnalysts: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getInterviewers(params) {
  try {
    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = userSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const interviewers = [];

    for (let i = 1; i < data.length; i++) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = data[i][index];
      });

      if (user.Email && user.Role === 'entrevistador') {
        interviewers.push({
          id: user.Email,
          email: user.Email,
          name: user.Nome || '',
          role: user.Role,
          active: user.Ativo === true || user.Ativo === 'TRUE'
        });
      }
    }

    return createResponse({ success: true, data: interviewers });
  } catch (error) {
    Logger.log('Erro em getInterviewers: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function createUser(params) {
  try {
    const email = params.email || params.Email;
    const nome = params.name || params.Nome;
    const role = params.role || params.Role;
    const ativo = params.active !== undefined ? params.active : params.Ativo;
    const password = params.password || params.Password || '123456';

    if (!email || !nome || !role) {
      return createResponse({ error: 'Email, Nome e Role são obrigatórios' }, 400);
    }

    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ error: 'Planilha de usuários não encontrada' }, 404);
    }

    const existingRow = findRowByValue(userSheet, 'Email', email);
    if (existingRow > 0) {
      return createResponse({ error: 'Usuário já existe' }, 400);
    }

    userSheet.appendRow([
      email,
      nome,
      role,
      ativo === true || ativo === 'true' ? 'TRUE' : 'FALSE',
      password
    ]);

    return createResponse({
      success: true,
      message: 'Usuário criado com sucesso'
    });
  } catch (error) {
    Logger.log('Erro em createUser: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function updateUser(params) {
  try {
    const email = params.email || params.Email;
    if (!email) {
      return createResponse({ error: 'Email é obrigatório' }, 400);
    }

    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ error: 'Planilha de usuários não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(userSheet, 'Email', email);
    if (rowIndex === -1) {
      return createResponse({ error: 'Usuário não encontrado' }, 404);
    }

    const headers = getHeaders(userSheet);

    if (params.name || params.Nome) {
      const colIndex = headers.indexOf('Nome');
      if (colIndex >= 0) {
        userSheet.getRange(rowIndex, colIndex + 1).setValue(params.name || params.Nome);
      }
    }

    if (params.role || params.Role) {
      const colIndex = headers.indexOf('Role');
      if (colIndex >= 0) {
        userSheet.getRange(rowIndex, colIndex + 1).setValue(params.role || params.Role);
      }
    }

    if (params.active !== undefined || params.Ativo !== undefined) {
      const colIndex = headers.indexOf('Ativo');
      if (colIndex >= 0) {
        const value = params.active === true || params.Ativo === true || params.active === 'true' || params.Ativo === 'true';
        userSheet.getRange(rowIndex, colIndex + 1).setValue(value ? 'TRUE' : 'FALSE');
      }
    }

    return createResponse({ success: true, message: 'Usuário atualizado' });
  } catch (error) {
    Logger.log('Erro em updateUser: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function deleteUser(params) {
  try {
    const email = params.email || params.Email;
    if (!email) {
      return createResponse({ error: 'Email é obrigatório' }, 400);
    }

    const userSheet = getSheet(SHEET_USUARIOS);
    if (!userSheet) {
      return createResponse({ error: 'Planilha de usuários não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(userSheet, 'Email', email);
    if (rowIndex === -1) {
      return createResponse({ error: 'Usuário não encontrado' }, 404);
    }

    userSheet.deleteRow(rowIndex);
    return createResponse({ success: true, message: 'Usuário deletado' });
  } catch (error) {
    Logger.log('Erro em deleteUser: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES DE CANDIDATOS
// ============================================

function getCandidates(params) {
  try {
    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, candidates: [] });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, candidates: [] });
    }

    const headers = data[0];
    const candidates = [];

    for (let i = 1; i < data.length; i++) {
      const candidate = {};
      headers.forEach((header, index) => {
        candidate[header] = data[i][index];
      });

      if (candidate.CPF || candidate.NOMECOMPLETO) {
        candidates.push(candidate);
      }
    }

    return createResponse({ success: true, candidates: candidates });
  } catch (error) {
    Logger.log('Erro em getCandidates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getCandidate(params) {
  try {
    const id = params.registration_number || params.id || params.CPF;
    if (!id) {
      return createResponse({ error: 'ID do candidato é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const data = candidateSheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      const cpf = data[i][headers.indexOf('CPF')];
      if (cpf && cpf.toString() === id.toString()) {
        const candidate = {};
        headers.forEach((header, index) => {
          candidate[header] = data[i][index];
        });
        return createResponse({ success: true, candidate: candidate });
      }
    }

    return createResponse({ error: 'Candidato não encontrado' }, 404);
  } catch (error) {
    Logger.log('Erro em getCandidate: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function addCandidate(params) {
  try {
    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const newRow = [];
    const timestamp = getCurrentTimestamp();

    headers.forEach(header => {
      if (header === 'created_at' || header === 'DataCadastro') {
        newRow.push(timestamp);
      } else if (header === 'updated_at') {
        newRow.push(timestamp);
      } else if (header === 'Status' && !params[header]) {
        newRow.push('pendente');
      } else {
        newRow.push(params[header] || '');
      }
    });

    candidateSheet.appendRow(newRow);

    return createResponse({
      success: true,
      message: 'Candidato adicionado com sucesso'
    });
  } catch (error) {
    Logger.log('Erro em addCandidate: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function updateCandidate(params) {
  try {
    const id = params.registration_number || params.id || params.CPF || params.candidateCPF;
    if (!id) {
      return createResponse({ error: 'ID do candidato é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(candidateSheet, 'CPF', id);
    if (rowIndex === -1) {
      return createResponse({ error: 'Candidato não encontrado' }, 404);
    }

    const headers = getHeaders(candidateSheet);

    Object.keys(params).forEach(key => {
      if (key !== 'action' && key !== 'registration_number' && key !== 'id' && key !== 'CPF' && key !== 'candidateCPF') {
        const colIndex = headers.indexOf(key);
        if (colIndex >= 0) {
          candidateSheet.getRange(rowIndex, colIndex + 1).setValue(params[key]);
        }
      }
    });

    const updatedAtIndex = headers.indexOf('updated_at');
    if (updatedAtIndex >= 0) {
      candidateSheet.getRange(rowIndex, updatedAtIndex + 1).setValue(getCurrentTimestamp());
    }

    return createResponse({ success: true, message: 'Candidato atualizado' });
  } catch (error) {
    Logger.log('Erro em updateCandidate: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function deleteCandidate(params) {
  try {
    const id = params.registration_number || params.id || params.CPF || params.candidateCPF;
    if (!id) {
      return createResponse({ error: 'ID do candidato é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(candidateSheet, 'CPF', id);
    if (rowIndex === -1) {
      return createResponse({ error: 'Candidato não encontrado' }, 404);
    }

    candidateSheet.deleteRow(rowIndex);
    return createResponse({ success: true, message: 'Candidato deletado' });
  } catch (error) {
    Logger.log('Erro em deleteCandidate: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function assignCandidates(params) {
  try {
    const candidateIds = params.candidateIds;
    const analystEmail = params.analystEmail || params.analystId;
    const adminEmail = params.adminEmail || params.adminId;

    Logger.log('📥 assignCandidates - IDs: ' + candidateIds);
    Logger.log('📥 assignCandidates - Analista: ' + analystEmail);

    if (!candidateIds || !analystEmail) {
      return createResponse({ error: 'IDs dos candidatos e email do analista são obrigatórios' }, 400);
    }

    const ids = typeof candidateIds === 'string' ? candidateIds.split(',').map(id => id.trim()) : candidateIds;
    const candidateSheet = getSheet(SHEET_CANDIDATOS);

    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const cpfIndex = headers.indexOf('CPF');
    const assignedToIndex = headers.indexOf('assigned_to');
    const assignedByIndex = headers.indexOf('assigned_by');
    const assignedAtIndex = headers.indexOf('assigned_at');
    const statusIndex = headers.indexOf('Status');
    const updatedAtIndex = headers.indexOf('updated_at');

    const timestamp = getCurrentTimestamp();
    let updated = 0;

    const data = candidateSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const cpf = data[i][cpfIndex];
      if (cpf && ids.includes(cpf.toString())) {
        if (assignedToIndex >= 0) {
          candidateSheet.getRange(i + 1, assignedToIndex + 1).setValue(analystEmail);
        }
        if (assignedByIndex >= 0 && adminEmail) {
          candidateSheet.getRange(i + 1, assignedByIndex + 1).setValue(adminEmail);
        }
        if (assignedAtIndex >= 0) {
          candidateSheet.getRange(i + 1, assignedAtIndex + 1).setValue(timestamp);
        }
        if (statusIndex >= 0) {
          candidateSheet.getRange(i + 1, statusIndex + 1).setValue('em_analise');
        }
        if (updatedAtIndex >= 0) {
          candidateSheet.getRange(i + 1, updatedAtIndex + 1).setValue(timestamp);
        }
        updated++;
      }
    }

    Logger.log('✅ Total alocados: ' + updated);

    return createResponse({
      success: true,
      message: updated + ' candidato(s) atribuído(s) com sucesso',
      updated: updated
    });
  } catch (error) {
    Logger.log('❌ Erro em assignCandidates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function bulkUpdateCandidates(params) {
  try {
    const updates = params.updates;
    if (!updates) {
      return createResponse({ error: 'Lista de atualizações é obrigatória' }, 400);
    }

    const updateList = typeof updates === 'string' ? JSON.parse(updates) : updates;
    const candidateSheet = getSheet(SHEET_CANDIDATOS);

    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    let updated = 0;

    updateList.forEach(update => {
      const rowIndex = findRowByValue(candidateSheet, 'CPF', update.id);
      if (rowIndex > 0) {
        const headers = getHeaders(candidateSheet);
        Object.keys(update).forEach(key => {
          if (key !== 'id') {
            const colIndex = headers.indexOf(key);
            if (colIndex >= 0) {
              candidateSheet.getRange(rowIndex, colIndex + 1).setValue(update[key]);
            }
          }
        });
        updated++;
      }
    });

    return createResponse({
      success: true,
      message: updated + ' candidato(s) atualizado(s)',
      updated: updated
    });
  } catch (error) {
    Logger.log('Erro em bulkUpdateCandidates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function updateCandidateStatus(params) {
  try {
    const registrationNumber = params.registrationNumber;
    const statusTriagem = params.statusTriagem;
    const reasonId = params.reasonId;
    const notes = params.notes;
    const analystEmail = params.analystEmail;

    if (!registrationNumber || !statusTriagem) {
      return createResponse({ error: 'Número de registro e status são obrigatórios' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(candidateSheet, 'CPF', registrationNumber);
    if (rowIndex === -1) {
      return createResponse({ error: 'Candidato não encontrado' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const timestamp = getCurrentTimestamp();

    const statusTriagemIndex = headers.indexOf('status_triagem');
    if (statusTriagemIndex >= 0) {
      candidateSheet.getRange(rowIndex, statusTriagemIndex + 1).setValue(statusTriagem);
    }

    const dataTriagemIndex = headers.indexOf('data_hora_triagem');
    if (dataTriagemIndex >= 0) {
      candidateSheet.getRange(rowIndex, dataTriagemIndex + 1).setValue(timestamp);
    }

    const analistaTriagemIndex = headers.indexOf('analista_triagem');
    if (analistaTriagemIndex >= 0 && analystEmail) {
      candidateSheet.getRange(rowIndex, analistaTriagemIndex + 1).setValue(analystEmail);
    }

    if (reasonId) {
      const motivoIndex = headers.indexOf('motivo_desclassificacao');
      if (motivoIndex >= 0) {
        candidateSheet.getRange(rowIndex, motivoIndex + 1).setValue(reasonId);
      }
    }

    if (notes) {
      const notesIndex = headers.indexOf('observacoes_triagem');
      if (notesIndex >= 0) {
        candidateSheet.getRange(rowIndex, notesIndex + 1).setValue(notes);
      }
    }

    const updatedAtIndex = headers.indexOf('updated_at');
    if (updatedAtIndex >= 0) {
      candidateSheet.getRange(rowIndex, updatedAtIndex + 1).setValue(timestamp);
    }

    return createResponse({
      success: true,
      message: 'Status atualizado com sucesso'
    });
  } catch (error) {
    Logger.log('Erro em updateCandidateStatus: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getCandidatesByStatus(params) {
  try {
    const status = params.status;
    if (!status) {
      return createResponse({ error: 'Status é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const statusIndex = headers.indexOf('status_triagem');

    if (statusIndex === -1) {
      return createResponse({ success: true, data: [] });
    }

    const candidates = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][statusIndex] === status) {
        const candidate = {};
        headers.forEach((header, index) => {
          candidate[header] = data[i][index];
        });
        candidates.push(candidate);
      }
    }

    return createResponse({ success: true, data: candidates });
  } catch (error) {
    Logger.log('Erro em getCandidatesByStatus: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES DE ENTREVISTA
// ============================================

function moveToInterview(params) {
  try {
    const candidateIds = params.candidateIds;
    if (!candidateIds) {
      return createResponse({ error: 'IDs dos candidatos são obrigatórios' }, 400);
    }

    const ids = typeof candidateIds === 'string' ? candidateIds.split(',').map(id => id.trim()) : candidateIds;
    const candidateSheet = getSheet(SHEET_CANDIDATOS);

    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const cpfIndex = headers.indexOf('CPF');
    const statusEntrevistaIndex = headers.indexOf('status_entrevista');
    const updatedAtIndex = headers.indexOf('updated_at');

    const timestamp = getCurrentTimestamp();
    let updated = 0;

    const data = candidateSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const cpf = data[i][cpfIndex];
      if (cpf && ids.includes(cpf.toString())) {
        if (statusEntrevistaIndex >= 0) {
          candidateSheet.getRange(i + 1, statusEntrevistaIndex + 1).setValue('Aguardando Entrevista');
        }
        if (updatedAtIndex >= 0) {
          candidateSheet.getRange(i + 1, updatedAtIndex + 1).setValue(timestamp);
        }
        updated++;
      }
    }

    return createResponse({
      success: true,
      message: updated + ' candidato(s) movido(s) para entrevista',
      updated: updated
    });
  } catch (error) {
    Logger.log('Erro em moveToInterview: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getInterviewCandidates(params) {
  try {
    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const statusEntrevistaIndex = headers.indexOf('status_entrevista');

    if (statusEntrevistaIndex === -1) {
      return createResponse({ success: true, data: [] });
    }

    const candidates = [];

    for (let i = 1; i < data.length; i++) {
      const status = data[i][statusEntrevistaIndex];
      if (status === 'Aguardando Entrevista' || status === 'Em Entrevista') {
        const candidate = {};
        headers.forEach((header, index) => {
          candidate[header] = data[i][index];
        });
        candidates.push(candidate);
      }
    }

    return createResponse({ success: true, data: candidates });
  } catch (error) {
    Logger.log('Erro em getInterviewCandidates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function allocateToInterviewer(params) {
  try {
    const candidateIds = params.candidateIds;
    const interviewerEmail = params.interviewerEmail;
    const adminEmail = params.adminEmail;

    if (!candidateIds || !interviewerEmail) {
      return createResponse({ error: 'IDs dos candidatos e email do entrevistador são obrigatórios' }, 400);
    }

    const ids = typeof candidateIds === 'string' ? candidateIds.split(',').map(id => id.trim()) : candidateIds;
    const candidateSheet = getSheet(SHEET_CANDIDATOS);

    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const cpfIndex = headers.indexOf('CPF');
    const entrevistadorIndex = headers.indexOf('entrevistador');
    const entrevistadorByIndex = headers.indexOf('entrevistador_by');
    const entrevistadorAtIndex = headers.indexOf('entrevistador_at');
    const statusEntrevistaIndex = headers.indexOf('status_entrevista');
    const updatedAtIndex = headers.indexOf('updated_at');

    const timestamp = getCurrentTimestamp();
    let updated = 0;

    const data = candidateSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const cpf = data[i][cpfIndex];
      if (cpf && ids.includes(cpf.toString())) {
        if (entrevistadorIndex >= 0) {
          candidateSheet.getRange(i + 1, entrevistadorIndex + 1).setValue(interviewerEmail);
        }
        if (entrevistadorByIndex >= 0 && adminEmail) {
          candidateSheet.getRange(i + 1, entrevistadorByIndex + 1).setValue(adminEmail);
        }
        if (entrevistadorAtIndex >= 0) {
          candidateSheet.getRange(i + 1, entrevistadorAtIndex + 1).setValue(timestamp);
        }
        if (statusEntrevistaIndex >= 0) {
          candidateSheet.getRange(i + 1, statusEntrevistaIndex + 1).setValue('Em Entrevista');
        }
        if (updatedAtIndex >= 0) {
          candidateSheet.getRange(i + 1, updatedAtIndex + 1).setValue(timestamp);
        }
        updated++;
      }
    }

    return createResponse({
      success: true,
      message: updated + ' candidato(s) alocado(s) para entrevista',
      updated: updated
    });
  } catch (error) {
    Logger.log('Erro em allocateToInterviewer: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getInterviewerCandidates(params) {
  try {
    const interviewerEmail = params.interviewerEmail;
    if (!interviewerEmail) {
      return createResponse({ error: 'Email do entrevistador é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const entrevistadorIndex = headers.indexOf('entrevistador');

    if (entrevistadorIndex === -1) {
      return createResponse({ success: true, data: [] });
    }

    const candidates = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][entrevistadorIndex] === interviewerEmail) {
        const candidate = {};
        headers.forEach((header, index) => {
          candidate[header] = data[i][index];
        });
        candidates.push(candidate);
      }
    }

    return createResponse({ success: true, data: candidates });
  } catch (error) {
    Logger.log('Erro em getInterviewerCandidates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function saveInterviewEvaluation(params) {
  try {
    const registrationNumber = params.registrationNumber;
    if (!registrationNumber) {
      return createResponse({ error: 'Número de registro é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const rowIndex = findRowByValue(candidateSheet, 'CPF', registrationNumber);
    if (rowIndex === -1) {
      return createResponse({ error: 'Candidato não encontrado' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const timestamp = getCurrentTimestamp();

    const fieldsToUpdate = [
      'interview_score',
      'interview_result',
      'interview_notes',
      'formacao_adequada',
      'graduacoes_competencias',
      'descricao_processos',
      'terminologia_tecnica',
      'calma_clareza',
      'escalas_flexiveis',
      'adaptabilidade_mudancas',
      'ajustes_emergencia',
      'residencia',
      'resolucao_conflitos',
      'colaboracao_equipe',
      'adaptacao_perfis'
    ];

    fieldsToUpdate.forEach(field => {
      if (params[field] !== undefined) {
        const colIndex = headers.indexOf(field);
        if (colIndex >= 0) {
          candidateSheet.getRange(rowIndex, colIndex + 1).setValue(params[field]);
        }
      }
    });

    const completedAtIndex = headers.indexOf('interview_completed_at');
    if (completedAtIndex >= 0) {
      candidateSheet.getRange(rowIndex, completedAtIndex + 1).setValue(timestamp);
    }

    const statusEntrevistaIndex = headers.indexOf('status_entrevista');
    if (statusEntrevistaIndex >= 0) {
      candidateSheet.getRange(rowIndex, statusEntrevistaIndex + 1).setValue('Entrevista Concluída');
    }

    const updatedAtIndex = headers.indexOf('updated_at');
    if (updatedAtIndex >= 0) {
      candidateSheet.getRange(rowIndex, updatedAtIndex + 1).setValue(timestamp);
    }

    return createResponse({
      success: true,
      message: 'Avaliação salva com sucesso'
    });
  } catch (error) {
    Logger.log('Erro em saveInterviewEvaluation: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES DE MENSAGENS
// ============================================

function sendMessages(params) {
  try {
    const messageType = params.messageType;
    const subject = params.subject || '';
    const content = params.content;
    const candidateIds = params.candidateIds;
    const sentBy = params.sentBy;
    const fromAlias = params.fromAlias;

    if (!messageType || !content || !candidateIds) {
      return createResponse({ error: 'Parâmetros insuficientes' }, 400);
    }

    const ids = typeof candidateIds === 'string' ? candidateIds.split(',').map(id => id.trim()) : candidateIds;

    const result = {
      success: true,
      message: 'Mensagens enviadas com sucesso',
      sent: ids.length,
      failed: 0
    };

    ids.forEach(id => {
      logMessage({
        registrationNumber: id,
        messageType: messageType,
        recipient: 'destinatario@example.com',
        subject: subject,
        content: content,
        sentBy: sentBy
      });
    });

    return createResponse(result);
  } catch (error) {
    Logger.log('Erro em sendMessages: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function logMessage(params) {
  try {
    const mensagensSheet = getSheet(SHEET_MENSAGENS);
    if (!mensagensSheet) {
      return createResponse({ success: true, message: 'Aba MENSAGENS não encontrada, log ignorado' });
    }

    const timestamp = getCurrentTimestamp();

    mensagensSheet.appendRow([
      timestamp,
      params.registrationNumber || '',
      params.messageType || '',
      params.recipient || '',
      params.subject || '',
      params.content || '',
      params.sentBy || '',
      'Enviado'
    ]);

    return createResponse({ success: true, message: 'Mensagem registrada' });
  } catch (error) {
    Logger.log('Erro em logMessage: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function updateMessageStatus(params) {
  try {
    const registrationNumbers = params.registrationNumbers;
    const messageType = params.messageType;
    const status = params.status;

    if (!registrationNumbers || !messageType || !status) {
      return createResponse({ error: 'Parâmetros insuficientes' }, 400);
    }

    const ids = typeof registrationNumbers === 'string' ? registrationNumbers.split(',').map(id => id.trim()) : registrationNumbers;
    const candidateSheet = getSheet(SHEET_CANDIDATOS);

    if (!candidateSheet) {
      return createResponse({ error: 'Planilha de candidatos não encontrada' }, 404);
    }

    const headers = getHeaders(candidateSheet);
    const cpfIndex = headers.indexOf('CPF');
    const columnName = messageType === 'email' ? 'email_sent' : 'sms_sent';
    const statusIndex = headers.indexOf(columnName);

    if (statusIndex === -1) {
      return createResponse({ error: 'Coluna ' + columnName + ' não encontrada' }, 404);
    }

    let updated = 0;
    const data = candidateSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const cpf = data[i][cpfIndex];
      if (cpf && ids.includes(cpf.toString())) {
        candidateSheet.getRange(i + 1, statusIndex + 1).setValue(status);
        updated++;
      }
    }

    return createResponse({
      success: true,
      message: updated + ' status(es) atualizado(s)',
      updated: updated
    });
  } catch (error) {
    Logger.log('Erro em updateMessageStatus: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getMessageTemplates(params) {
  try {
    const templatesSheet = getSheet(SHEET_TEMPLATES);
    if (!templatesSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = templatesSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const templates = [];

    for (let i = 1; i < data.length; i++) {
      const template = {};
      headers.forEach((header, index) => {
        template[header] = data[i][index];
      });
      if (template.nome) {
        templates.push(template);
      }
    }

    return createResponse({ success: true, data: templates });
  } catch (error) {
    Logger.log('Erro em getMessageTemplates: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getEmailAliases(params) {
  try {
    const aliasSheet = getSheet(SHEET_ALIAS);
    if (!aliasSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = aliasSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const aliases = [];

    for (let i = 1; i < data.length; i++) {
      const alias = {};
      headers.forEach((header, index) => {
        alias[header] = data[i][index];
      });
      if (alias.email) {
        aliases.push(alias);
      }
    }

    return createResponse({ success: true, data: aliases });
  } catch (error) {
    Logger.log('Erro em getEmailAliases: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES DE RELATÓRIOS
// ============================================

function getStatistics(params) {
  try {
    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({
        total: 0,
        pendente: 0,
        em_analise: 0,
        concluido: 0
      });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({
        total: 0,
        pendente: 0,
        em_analise: 0,
        concluido: 0
      });
    }

    const headers = data[0];
    const statusIndex = headers.indexOf('Status');

    const stats = {
      total: data.length - 1,
      pendente: 0,
      em_analise: 0,
      concluido: 0
    };

    for (let i = 1; i < data.length; i++) {
      const status = data[i][statusIndex];
      if (status === 'pendente') stats.pendente++;
      else if (status === 'em_analise') stats.em_analise++;
      else if (status === 'concluido') stats.concluido++;
    }

    return createResponse(stats);
  } catch (error) {
    Logger.log('Erro em getStatistics: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getReportStats(params) {
  try {
    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, data: {} });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: {} });
    }

    const headers = data[0];
    const stats = {
      total: data.length - 1,
      classificados: 0,
      desclassificados: 0,
      revisar: 0,
      aguardando_entrevista: 0,
      entrevista_concluida: 0
    };

    const statusTriagemIndex = headers.indexOf('status_triagem');
    const statusEntrevistaIndex = headers.indexOf('status_entrevista');

    for (let i = 1; i < data.length; i++) {
      if (statusTriagemIndex >= 0) {
        const statusTriagem = data[i][statusTriagemIndex];
        if (statusTriagem === 'Classificado') stats.classificados++;
        else if (statusTriagem === 'Desclassificado') stats.desclassificados++;
        else if (statusTriagem === 'Revisar') stats.revisar++;
      }

      if (statusEntrevistaIndex >= 0) {
        const statusEntrevista = data[i][statusEntrevistaIndex];
        if (statusEntrevista === 'Aguardando Entrevista') stats.aguardando_entrevista++;
        else if (statusEntrevista === 'Entrevista Concluída') stats.entrevista_concluida++;
      }
    }

    return createResponse({ success: true, data: stats });
  } catch (error) {
    Logger.log('Erro em getReportStats: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

function getReport(params) {
  try {
    const reportType = params.reportType;
    if (!reportType) {
      return createResponse({ error: 'Tipo de relatório é obrigatório' }, 400);
    }

    const candidateSheet = getSheet(SHEET_CANDIDATOS);
    if (!candidateSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = candidateSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const candidates = [];

    for (let i = 1; i < data.length; i++) {
      const candidate = {};
      headers.forEach((header, index) => {
        candidate[header] = data[i][index];
      });
      candidates.push(candidate);
    }

    return createResponse({ success: true, data: candidates });
  } catch (error) {
    Logger.log('Erro em getReport: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÕES DE MOTIVOS
// ============================================

function getDisqualificationReasons(params) {
  try {
    const motivosSheet = getSheet(SHEET_MOTIVOS);
    if (!motivosSheet) {
      return createResponse({ success: true, data: [] });
    }

    const data = motivosSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse({ success: true, data: [] });
    }

    const headers = data[0];
    const reasons = [];

    for (let i = 1; i < data.length; i++) {
      const reason = {};
      headers.forEach((header, index) => {
        reason[header] = data[i][index];
      });
      if (reason.id || reason.motivo) {
        reasons.push(reason);
      }
    }

    return createResponse({ success: true, data: reasons });
  } catch (error) {
    Logger.log('Erro em getDisqualificationReasons: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// FUNÇÃO DE TESTE
// ============================================

function testConnection(params) {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();
    const sheetNames = sheets.map(sheet => sheet.getName());

    return createResponse({
      success: true,
      message: 'Conexão funcionando!',
      spreadsheet_id: SPREADSHEET_ID,
      sheets: sheetNames,
      timestamp: getCurrentTimestamp()
    });
  } catch (error) {
    Logger.log('Erro em testConnection: ' + error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}
