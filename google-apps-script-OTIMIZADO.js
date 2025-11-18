/**
 * GOOGLE APPS SCRIPT - VERSÃO OTIMIZADA PARA 50 USUÁRIOS
 *
 * OTIMIZAÇÕES IMPLEMENTADAS:
 * 1. Cache interno com CacheService (60 segundos)
 * 2. Leitura em lote com getDataRange()
 * 3. Invalidação de cache após escritas
 * 4. Logs de performance
 *
 * GANHOS ESPERADOS:
 * - 95% menos leituras do Google Sheets
 * - Resposta 10x mais rápida
 * - Suporte para 50+ usuários simultâneos
 */

const CACHE_DURATION = 60; // 60 segundos
const ENABLE_CACHE = true; // Pode desabilitar para debug

/**
 * Função auxiliar para obter dados do cache ou executar função
 */
function withCache(cacheKey, dataFunction) {
  if (!ENABLE_CACHE) {
    return dataFunction();
  }

  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);

  if (cached) {
    Logger.log('✅ [CACHE HIT] ' + cacheKey);
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('⚠️ [CACHE] Erro ao parsear cache: ' + e);
    }
  }

  Logger.log('🔄 [CACHE MISS] ' + cacheKey);
  const startTime = new Date().getTime();
  const result = dataFunction();
  const duration = new Date().getTime() - startTime;

  try {
    cache.put(cacheKey, JSON.stringify(result), CACHE_DURATION);
    Logger.log(`💾 [CACHE] Armazenado (${duration}ms): ${cacheKey}`);
  } catch (e) {
    Logger.log('⚠️ [CACHE] Erro ao armazenar: ' + e);
  }

  return result;
}

/**
 * Invalidar todos os caches de candidatos
 */
function invalidateCandidatesCache() {
  if (!ENABLE_CACHE) return;

  const cache = CacheService.getScriptCache();
  const keys = [
    'candidates_all',
    'candidates_stats',
    'report_stats'
  ];

  keys.forEach(key => {
    cache.remove(key);
    Logger.log('🗑️ [CACHE] Invalidado: ' + key);
  });

  Logger.log('✅ [CACHE] Cache de candidatos invalidado');
}

/**
 * Função otimizada para buscar candidatos
 */
function getCandidates(params) {
  const cacheKey = 'candidates_all';

  return withCache(cacheKey, function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Candidatos');

    if (!sheet) {
      return {
        success: false,
        error: 'Aba Candidatos não encontrada'
      };
    }

    // OTIMIZAÇÃO: Buscar todos os dados de uma vez
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

    // Processar todas as linhas de uma vez
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const candidate = {};

      headers.forEach((header, index) => {
        const value = row[index];
        // Converter datas e formatar valores
        if (value instanceof Date) {
          candidate[header] = value.toISOString();
        } else {
          candidate[header] = value;
        }
      });

      candidates.push(candidate);
    }

    Logger.log(`✅ Candidatos carregados: ${candidates.length}`);

    return {
      success: true,
      data: { candidates }
    };
  });
}

/**
 * Função otimizada para atualizar status do candidato
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

    // Buscar linha do candidato
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

    // Encontrar candidato
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][cpfIndex] === registrationNumber) {
        rowIndex = i + 1; // +1 porque getRange é 1-based
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: 'Candidato não encontrado'
      };
    }

    // Atualizar status
    sheet.getRange(rowIndex, statusIndex + 1).setValue(statusTriagem);

    // Atualizar motivo se desclassificado
    if (statusTriagem === 'Desclassificado' && motivoIndex !== -1 && reasonId) {
      sheet.getRange(rowIndex, motivoIndex + 1).setValue(reasonId);
    }

    // Atualizar analista
    if (analistaIndex !== -1 && analystEmail) {
      sheet.getRange(rowIndex, analistaIndex + 1).setValue(analystEmail);
    }

    // IMPORTANTE: Invalidar cache após atualização
    invalidateCandidatesCache();

    Logger.log(`✅ Status atualizado: ${registrationNumber} -> ${statusTriagem}`);

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
 * Função otimizada para buscar estatísticas
 */
function getReportStats() {
  const cacheKey = 'report_stats';

  return withCache(cacheKey, function() {
    const candidatesResult = getCandidates({});

    if (!candidatesResult.success) {
      return candidatesResult;
    }

    const candidates = candidatesResult.data.candidates;

    const stats = {
      classificados: candidates.filter(c => c.Status === 'Classificado').length,
      desclassificados: candidates.filter(c => c.Status === 'Desclassificado').length,
      entrevistaClassificados: candidates.filter(c =>
        c['Status Entrevista'] === 'Classificado' ||
        c['Resultado Entrevista'] === 'Aprovado'
      ).length,
      entrevistaDesclassificados: candidates.filter(c =>
        c['Status Entrevista'] === 'Desclassificado' ||
        c['Resultado Entrevista'] === 'Reprovado'
      ).length
    };

    Logger.log('📊 Estatísticas calculadas:', JSON.stringify(stats));

    return {
      success: true,
      data: stats
    };
  });
}

/**
 * Função principal de roteamento (não alterada)
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

      // Adicionar outros casos aqui...

      default:
        result = {
          success: false,
          error: 'Ação não reconhecida: ' + action
        };
    }

    const duration = new Date().getTime() - startTime;
    Logger.log(`✅ Resposta (${duration}ms): ${action}`);

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

/**
 * Função para limpar cache manualmente (para debug/admin)
 */
function clearAllCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(cache.getKeys());
  Logger.log('🗑️ Todo o cache foi limpo');
}

/**
 * Função para testar performance
 */
function testPerformance() {
  Logger.log('🧪 Iniciando teste de performance...');

  // Teste 1: Primeira requisição (sem cache)
  clearAllCache();
  const start1 = new Date().getTime();
  getCandidates({});
  const duration1 = new Date().getTime() - start1;
  Logger.log(`📊 Teste 1 (sem cache): ${duration1}ms`);

  // Teste 2: Segunda requisição (com cache)
  const start2 = new Date().getTime();
  getCandidates({});
  const duration2 = new Date().getTime() - start2;
  Logger.log(`📊 Teste 2 (com cache): ${duration2}ms`);

  // Teste 3: Múltiplas requisições em sequência
  const start3 = new Date().getTime();
  for (let i = 0; i < 10; i++) {
    getCandidates({});
  }
  const duration3 = new Date().getTime() - start3;
  Logger.log(`📊 Teste 3 (10 requisições com cache): ${duration3}ms (média: ${duration3/10}ms)`);

  Logger.log('✅ Teste concluído!');
  Logger.log(`Ganho de performance: ${Math.round((duration1 - duration2) / duration1 * 100)}%`);
}
