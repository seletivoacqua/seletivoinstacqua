// ============================================
// GOOGLE APPS SCRIPT - VERSÃO CORRIGIDA DEFINITIVA
// Correção: saveScreening agora retorna dados corretos
// ============================================

const SPREADSHEET_ID = '1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY';
const SHEET_CANDIDATOS = 'CANDIDATOS';
const HEADER_ROWS = 1;

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function handleRequest(e) {
  try {
    let action, params;

    // ✅ Lê POST ou GET
    if (e && e.postData && e.postData.contents) {
      try {
        const data = JSON.parse(e.postData.contents);
        action = data.action;
        params = data;
        Logger.log('📥 POST recebido - Action: ' + action);
      } catch (parseError) {
        Logger.log('❌ Erro ao fazer parse do JSON: ' + parseError);
        return createCorsResponse({
          success: false,
          error: 'JSON inválido: ' + parseError.toString()
        });
      }
    } else if (e && e.parameter) {
      action = e.parameter.action;
      params = e.parameter;
      Logger.log('📥 GET recebido - Action: ' + action);
    } else {
      return createCorsResponse({
        success: false,
        error: 'Requisição inválida'
      });
    }

    // ✅ CORREÇÃO CRÍTICA: saveScreening retorna diretamente success/error
    if (action === 'saveScreening') {
      const result = saveScreening(params);
      Logger.log('📤 Resposta saveScreening: ' + JSON.stringify(result));
      return createCorsResponse(result); // ← Retorna diretamente, sem envolver em { success, data }
    }

    // Outras ações retornam dados que precisam ser envolvidos
    const actions = {
      'getCandidates': () => getCandidates(params),
      'test': () => testConnection()
    };

    if (actions[action]) {
      const result = actions[action]();
      return createCorsResponse({ success: true, data: result });
    }

    return createCorsResponse({
      success: false,
      error: 'Ação não encontrada: ' + action
    });

  } catch (error) {
    Logger.log('❌ Erro no handleRequest: ' + error.toString());
    return createCorsResponse({
      success: false,
      error: error.toString()
    });
  }
}

function _sheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
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

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function getCandidates(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  if (!sh) return { candidates: [] };

  const headers = _getHeaders_(sh);
  const lastRow = sh.getLastRow();

  if (lastRow <= HEADER_ROWS) return { candidates: [] };

  const values = sh.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, sh.getLastColumn()).getValues();

  const candidates = values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return { candidates };
}

function saveScreening(params) {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('📝 INICIANDO saveScreening');
    Logger.log('═══════════════════════════════════════');
    Logger.log('📋 Parâmetros completos:');
    Logger.log(JSON.stringify(params, null, 2));

    const sh = _sheet(SHEET_CANDIDATOS);
    if (!sh) {
      throw new Error('Planilha CANDIDATOS não encontrada');
    }

    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    Logger.log('📊 Colunas disponíveis: ' + JSON.stringify(Object.keys(col)));

    // Índices das colunas
    const cpfCol = col['CPF'];
    const statusCol = col['Status'];
    const analistaCol = col['Analista'];
    const dataTriagemCol = col['Data Triagem'];

    if (cpfCol === undefined) {
      throw new Error('Coluna CPF não encontrada');
    }

    if (statusCol === undefined) {
      throw new Error('Coluna Status não encontrada');
    }

    // Buscar candidato
    const searchKey = String(params.candidateId || params.registrationNumber || params.cpf).trim();
    Logger.log('🔍 Buscando candidato: ' + searchKey);

    const lastRow = sh.getLastRow();
    let targetRow = null;

    for (let i = HEADER_ROWS + 1; i <= lastRow; i++) {
      const cpfValue = String(sh.getRange(i, cpfCol + 1).getValue()).trim();
      if (cpfValue === searchKey) {
        targetRow = i;
        break;
      }
    }

    if (!targetRow) {
      throw new Error('Candidato não encontrado: ' + searchKey);
    }

    Logger.log('✅ Candidato encontrado na linha: ' + targetRow);

    // Ler linha completa
    const lastCol = sh.getLastColumn();
    const rowVals = sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];

    // ✅ ATUALIZAR STATUS
    let statusFinal;
    if (params.status === 'classificado') {
      statusFinal = 'Classificado';
    } else if (params.status === 'desclassificado') {
      statusFinal = 'Desclassificado';
    } else {
      statusFinal = 'Desclassificado'; // default
    }

    Logger.log('📝 Status a gravar: ' + statusFinal);

    rowVals[statusCol] = statusFinal;

    // Analista
    if (analistaCol !== undefined && params.analystEmail) {
      rowVals[analistaCol] = params.analystEmail;
      Logger.log('👤 Analista: ' + params.analystEmail);
    }

    // Data
    if (dataTriagemCol !== undefined) {
      rowVals[dataTriagemCol] = getCurrentTimestamp();
      Logger.log('📅 Data triagem gravada');
    }

    // Documentos
    const docFields = [
      ['checkrg-cpf', col['checkrg-cpf']],
      ['check-cnh', col['check-cnh']],
      ['check-experiencia', col['check-experiencia']],
      ['check-regularidade', col['check-regularidade']],
      ['check-laudo', col['check-laudo']],
      ['check-curriculo', col['check-curriculo']]
    ];

    docFields.forEach(([key, colIndex]) => {
      if (colIndex !== undefined && params[key]) {
        let value = '';
        if (params[key] === 'conforme') value = 'Sim';
        else if (params[key] === 'nao_conforme') value = 'Não';
        else if (params[key] === 'nao_se_aplica') value = 'Não se aplica';
        else value = String(params[key]);

        rowVals[colIndex] = value;
        Logger.log(`📄 ${key}: ${value}`);
      }
    });

    // Observações
    if (col['Observações'] !== undefined && params.notes) {
      rowVals[col['Observações']] = params.notes;
    }

    // Motivo desclassificação
    if (statusFinal === 'Desclassificado' && col['Motivo Desclassificação'] !== undefined) {
      if (params.disqualification_reason) {
        rowVals[col['Motivo Desclassificação']] = params.disqualification_reason;
      }
    }

    // Capacidade técnica (se classificado)
    if (statusFinal === 'Classificado') {
      if (col['capacidade_tecnica'] !== undefined && params.capacidade_tecnica) {
        rowVals[col['capacidade_tecnica']] = Number(params.capacidade_tecnica) || 0;
      }
      if (col['experiencia'] !== undefined && params.experiencia) {
        rowVals[col['experiencia']] = Number(params.experiencia) || 0;
      }
      if (col['pontuacao_triagem'] !== undefined) {
        const total = (Number(params.capacidade_tecnica) || 0) + (Number(params.experiencia) || 0);
        rowVals[col['pontuacao_triagem']] = total;
      }
    }

    // ✅ SALVAR NA PLANILHA
    sh.getRange(targetRow, 1, 1, lastCol).setValues([rowVals]);

    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ TRIAGEM SALVA COM SUCESSO');
    Logger.log('   Status gravado: ' + statusFinal);
    Logger.log('   Linha: ' + targetRow);
    Logger.log('═══════════════════════════════════════');

    // ✅ RETORNAR SUCESSO (estrutura correta)
    return {
      success: true,
      message: 'Triagem salva com sucesso',
      status: statusFinal,
      candidateId: searchKey
    };

  } catch (error) {
    Logger.log('═══════════════════════════════════════');
    Logger.log('❌ ERRO EM saveScreening');
    Logger.log('   Erro: ' + error.toString());
    Logger.log('   Stack: ' + error.stack);
    Logger.log('═══════════════════════════════════════');

    // ✅ RETORNAR ERRO (estrutura correta)
    return {
      success: false,
      error: error.toString()
    };
  }
}

function testConnection() {
  return {
    status: 'OK',
    timestamp: getCurrentTimestamp(),
    spreadsheetId: SPREADSHEET_ID
  };
}
