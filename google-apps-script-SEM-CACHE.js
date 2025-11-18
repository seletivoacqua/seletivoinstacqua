/**
 * GOOGLE APPS SCRIPT - VERSÃO SEM CACHE (PARA TESTE)
 *
 * Use esta versão primeiro para garantir que tudo está funcionando.
 * Depois, troque para a versão otimizada com cache.
 */

/**
 * Função para buscar candidatos
 */
function getCandidates(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Candidatos');

    if (!sheet) {
      return {
        success: false,
        error: 'Aba Candidatos não encontrada'
      };
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length === 0) {
      return {
        success: true,
        data: { candidates: [] }
      };
    }

    const headers = values[0];
    const candidates = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const candidate = {};

      headers.forEach(function(header, index) {
        const value = row[index];
        if (value instanceof Date) {
          candidate[header] = value.toISOString();
        } else {
          candidate[header] = value;
        }
      });

      candidates.push(candidate);
    }

    Logger.log('✅ Candidatos carregados: ' + candidates.length);

    return {
      success: true,
      data: { candidates: candidates }
    };
  } catch (error) {
    Logger.log('❌ Erro em getCandidates: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Função para atualizar status do candidato
 */
function updateCandidateStatus(params) {
  const { registrationNumber, statusTriagem, reasonId, notes, analystEmail } = params;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Candidatos');

    if (!sheet) {
      return {
        success: false,
        error: 'Aba Candidatos não encontrada'
      };
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    const cpfIndex = headers.indexOf('CPF');
    const statusIndex = headers.indexOf('Status');
    const motivoIndex = headers.indexOf('Motivo Desclassificação');
    const analistaIndex = headers.indexOf('Analista');

    if (cpfIndex === -1 || statusIndex === -1) {
      return {
        success: false,
        error: 'Colunas necessárias não encontradas'
      };
    }

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][cpfIndex] === registrationNumber) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: 'Candidato não encontrado'
      };
    }

    sheet.getRange(rowIndex, statusIndex + 1).setValue(statusTriagem);

    if (statusTriagem === 'Desclassificado' && motivoIndex !== -1 && reasonId) {
      sheet.getRange(rowIndex, motivoIndex + 1).setValue(reasonId);
    }

    if (analistaIndex !== -1 && analystEmail) {
      sheet.getRange(rowIndex, analistaIndex + 1).setValue(analystEmail);
    }

    Logger.log('✅ Status atualizado: ' + registrationNumber + ' -> ' + statusTriagem);

    return {
      success: true,
      message: 'Status atualizado com sucesso'
    };
  } catch (error) {
    Logger.log('❌ Erro ao atualizar status: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Função para buscar estatísticas
 */
function getReportStats() {
  try {
    const candidatesResult = getCandidates({});

    if (!candidatesResult.success) {
      return candidatesResult;
    }

    const candidates = candidatesResult.data.candidates;

    const stats = {
      classificados: candidates.filter(function(c) { return c.Status === 'Classificado'; }).length,
      desclassificados: candidates.filter(function(c) { return c.Status === 'Desclassificado'; }).length,
      entrevistaClassificados: candidates.filter(function(c) {
        return c['Status Entrevista'] === 'Classificado' || c['Resultado Entrevista'] === 'Aprovado';
      }).length,
      entrevistaDesclassificados: candidates.filter(function(c) {
        return c['Status Entrevista'] === 'Desclassificado' || c['Resultado Entrevista'] === 'Reprovado';
      }).length
    };

    Logger.log('📊 Estatísticas calculadas: ' + JSON.stringify(stats));

    return {
      success: true,
      data: stats
    };
  } catch (error) {
    Logger.log('❌ Erro em getReportStats: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Função principal de roteamento
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const startTime = new Date().getTime();

    Logger.log('📥 Requisição recebida: ' + action);

    let result;

    switch (action) {
      case 'getCandidates':
        result = getCandidates(e.parameter);
        break;

      case 'updateCandidateStatus':
        result = updateCandidateStatus(e.parameter);
        break;

      case 'getReportStats':
        result = getReportStats();
        break;

      default:
        result = {
          success: false,
          error: 'Ação não reconhecida: ' + action
        };
    }

    const duration = new Date().getTime() - startTime;
    Logger.log('✅ Resposta (' + duration + 'ms): ' + action);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('❌ Erro geral: ' + error);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
