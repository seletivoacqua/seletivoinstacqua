// ============================================
// CORREÇÃO CRÍTICA: _writeWholeRow_
// ============================================

// ❌ VERSÃO COM ERRO (atual):
function _writeWholeRow_ERRADO(sh, row, rowArray){
  const lastCol = sh.getLastColumn();
  sh.getRange(row, 1, 1, lastCol).setValues([rowArray]);
  // PROBLEMA: Se rowArray.length !== lastCol, dá erro:
  // "The number of columns in the data does not match the number of columns in the range"
}

// ✅ VERSÃO CORRIGIDA:
function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();

  // Ajusta o array para o tamanho correto
  const adjustedArray = [...rowArray];

  // Preenche com strings vazias se faltar colunas
  while (adjustedArray.length < lastCol) {
    adjustedArray.push('');
  }

  // Corta se tiver mais colunas que o necessário
  if (adjustedArray.length > lastCol) {
    adjustedArray.length = lastCol;
  }

  Logger.log(`📝 Escrevendo linha ${row}: ${adjustedArray.length} colunas (sheet tem ${lastCol})`);

  sh.getRange(row, 1, 1, lastCol).setValues([adjustedArray]);
}

// ============================================
// TESTE DA CORREÇÃO
// ============================================

function testarWriteWholeRow() {
  const ss = SpreadsheetApp.openById('1iQSQ06P_OXkqxaGWN3uG5jRYFBKyjWqQyvzuGk2EplY');
  const sh = ss.getSheetByName('CANDIDATOS');

  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 TESTANDO _writeWholeRow_');
  Logger.log('═══════════════════════════════════════');

  const lastCol = sh.getLastColumn();
  Logger.log(`Total de colunas na planilha: ${lastCol}`);

  // Pega a primeira linha de dados para testar
  const testRow = 2;
  const currentData = sh.getRange(testRow, 1, 1, lastCol).getValues()[0];
  Logger.log(`Dados atuais da linha ${testRow}: ${currentData.length} valores`);

  try {
    // Teste 1: Array com mesmo tamanho
    Logger.log('─────────────────────────────────────');
    Logger.log('Teste 1: Array com tamanho correto');
    _writeWholeRow_(sh, testRow, currentData);
    Logger.log('✅ Sucesso!');

    // Teste 2: Array menor
    Logger.log('─────────────────────────────────────');
    Logger.log('Teste 2: Array menor que lastCol');
    const smallArray = currentData.slice(0, Math.floor(lastCol / 2));
    Logger.log(`Array tem ${smallArray.length} elementos, sheet tem ${lastCol} colunas`);
    _writeWholeRow_(sh, testRow, smallArray);
    Logger.log('✅ Sucesso! Array foi preenchido automaticamente');

    // Restaura dados originais
    Logger.log('─────────────────────────────────────');
    Logger.log('Restaurando dados originais...');
    _writeWholeRow_(sh, testRow, currentData);
    Logger.log('✅ Dados restaurados');

    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ TODOS OS TESTES PASSARAM!');
    Logger.log('═══════════════════════════════════════');

  } catch (error) {
    Logger.log('═══════════════════════════════════════');
    Logger.log('❌ ERRO NO TESTE:');
    Logger.log(error.toString());
    Logger.log('Stack: ' + error.stack);
    Logger.log('═══════════════════════════════════════');
  }
}

// ============================================
// INSTRUÇÕES DE USO
// ============================================

/*
COMO CORRIGIR O SCRIPT:

1. Abra o Google Apps Script do projeto
2. Localize a função _writeWholeRow_ (linha 185)
3. Substitua o código atual por:

function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();

  // Ajusta o array para o tamanho correto
  const adjustedArray = [...rowArray];

  // Preenche com strings vazias se faltar colunas
  while (adjustedArray.length < lastCol) {
    adjustedArray.push('');
  }

  // Corta se tiver mais colunas que o necessário
  if (adjustedArray.length > lastCol) {
    adjustedArray.length = lastCol;
  }

  sh.getRange(row, 1, 1, lastCol).setValues([adjustedArray]);
}

4. Salve o script
5. Execute a função testarWriteWholeRow() para validar
6. Teste o saveScreening novamente

MOTIVO DA CORREÇÃO:
- O erro ocorre quando rowArray.length !== lastCol
- Google Sheets exige que o array tenha EXATAMENTE o mesmo tamanho do range
- A correção ajusta o array automaticamente antes de salvar
*/
