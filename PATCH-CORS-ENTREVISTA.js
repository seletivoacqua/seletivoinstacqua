// ============================================
// PATCH PARA CORRIGIR CORS E COLUNAS DE ENTREVISTA
// ============================================
//
// INSTRUÇÕES:
// 1. Abra o Google Apps Script Editor
// 2. Localize a função createCorsResponse (linha ~194)
// 3. Substitua pela versão abaixo
// 4. Localize a função saveInterviewEvaluation (linha ~1650)
// 5. Substitua pelas correções indicadas
//
// ============================================

// CORREÇÃO 1: Função createCorsResponse COM headers CORS
// Substitua a função existente por esta:

function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.setHeader('Access-Control-Max-Age', '3600');
  return output;
}

// ============================================
// CORREÇÃO 2: Adicionar tratamento de OPTIONS
// Adicione esta função ANTES de doGet e doPost:

function doOptions(e) {
  return createCorsResponse({ success: true, message: 'CORS preflight OK' });
}

// ============================================
// CORREÇÃO 3: Função saveInterviewEvaluation CORRIGIDA
// Substitua APENAS as linhas indicadas:

// LINHA ~1658-1659 - ANTES:
//   const dataEntrevistaCol = col['data_entrevista'];

// LINHA ~1658-1660 - DEPOIS:
const entrevistadorAtCol = col['entrevistador_at'];
const entrevistadorByCol = col['entrevistador_by'];

// LINHA ~1709 - ANTES:
//   if (dataEntrevistaCol >= 0) rowVals[dataEntrevistaCol] = getCurrentTimestamp();

// LINHA ~1709-1710 - DEPOIS:
if (entrevistadorAtCol >= 0) rowVals[entrevistadorAtCol] = getCurrentTimestamp();
if (entrevistadorByCol >= 0) rowVals[entrevistadorByCol] = params.interviewerEmail || '';

// ============================================
// RESUMO DAS MUDANÇAS:
// ============================================
//
// 1. createCorsResponse agora adiciona headers CORS obrigatórios
// 2. Nova função doOptions para responder preflight requests
// 3. saveInterviewEvaluation usa colunas corretas:
//    - entrevistador_at (timestamp)
//    - entrevistador_by (email do entrevistador)
//    ao invés de data_entrevista
//
// ============================================
