# Diagnóstico: Problema ao Salvar Triagem

## Problema Relatado
Os dados da triagem não estão sendo salvos na planilha quando o usuário conclui o processo no `ScreeningModal.tsx`.

## Análise do Fluxo

### 1. Frontend (`ScreeningModal.tsx`) ✅ CORRETO

**Linha 129:** Usa POST corretamente
```typescript
const { googleSheetsService } = await import('../services/googleSheets');
const result = await googleSheetsService.saveScreening(screeningData);
```

**Dados enviados (linhas 93-120):**
```typescript
const screeningData = {
  candidateId: candidate.id,           // ✅
  registrationNumber: candidate.registration_number, // ✅
  cpf: candidate.CPF,                  // ✅
  status: classificationStatus,        // ✅ "classificado" ou "desclassificado"
  analystEmail: user?.email,           // ✅
  screenedAt: new Date().toISOString(), // ✅
  notes: notes,                        // ✅
  ...documentsData,                    // ✅ checkrg-cpf, check-cnh, etc.

  // Se classificado:
  capacidade_tecnica: number,          // ✅
  experiencia: number,                 // ✅
  pontuacao_triagem: number,           // ✅

  // Se desclassificado:
  disqualification_reason: string      // ✅
}
```

### 2. Serviço HTTP (`googleSheets.ts`) ✅ CORRETO

**Linha 320-334:** Usa POST com `makePostRequest`
```typescript
async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
  console.log('🔄 saveScreening - Usando POST para enviar dados');
  const result = await makePostRequest('saveScreening', screeningData);

  if (result.success) {
    console.log('✅ Triagem salva - Invalidando cache');
    cacheService.invalidatePattern(/getCandidates/);
    // ...
  }
  return result;
}
```

**Linha 89-139:** Implementação do POST
```typescript
async function makePostRequest(action: string, params: any = {}): Promise<GoogleSheetsResponse> {
  const payload = {
    action,      // "saveScreening"
    ...params    // todos os dados da triagem
  };

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
```

### 3. Google Apps Script ⚠️ POSSÍVEL PROBLEMA

## Possíveis Causas do Problema

### Causa 1: Script Antigo Sem Otimizações ❌

**Problema:** O script `google-apps-script-PRODUCAO-COMPLETO.js` tem problemas de performance com 5000+ linhas.

**Solução:** Use `google-apps-script-OTIMIZADO-5000-LINHAS.js`

### Causa 2: Timeout com Volume Grande de Dados ⏱️

**Problema:** Com 5000+ candidatos, o `saveScreening` pode demorar mais de 30s (timeout do Google Apps Script)

**Função problemática (linha 1888-2092):**
```javascript
function saveScreening(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  // ❌ Carrega linha inteira
  const idx = _getIndex_(sh, headers);  // Carrega TODOS os 5000 candidatos
  const row = idx[searchKey];

  const lastCol = sh.getLastColumn();
  const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0]; // ❌ 50+ colunas

  // Atualiza valores no array
  rowVals[statusCol] = statusFinal;
  // ...

  _writeWholeRow_(sh, row, rowVals); // ❌ Grava linha inteira
}
```

**Por que isso falha com 5000+ linhas:**
1. `_getIndex_` carrega toda a planilha (5000 × 50 = 250.000 células)
2. `getValues()[0]` carrega 50+ colunas mesmo precisando atualizar só 5-6
3. `_writeWholeRow_` grava 50+ colunas de uma vez

### Causa 3: Cache de Índice Corrompido 💾

**Problema:** O cache JSON do índice ultrapassa 100KB (limite do Google)

```javascript
function _buildIndex_(sh, headers){
  const values = sh.getRange(HEADER_ROWS+1, 1, lastRow-HEADER_ROWS, sh.getLastColumn()).getValues();
  // Com 5000 linhas, esse JSON tem ~150KB
  const idx = {};
  for (let i=0;i<values.length;i++){
    idx[String(key).trim()] = row; // 5000 entradas
  }
  return idx;
}

function _getIndex_(sh, headers){
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached); // ❌ Pode retornar cache corrompido
  const idx = _buildIndex_(sh, headers);
  cache.put(key, JSON.stringify(idx), CACHE_TTL_SEC); // ❌ Falha se > 100KB
  return idx;
}
```

### Causa 4: Coluna "Status" Não Encontrada 🔍

**Verificação necessária:**
```javascript
const statusCol = col['Status'];  // Pode retornar undefined

if (statusCol >= 0) {
  rowVals[statusCol] = statusFinal;
} else {
  Logger.log('⚠️ Coluna Status não encontrada!'); // ❌ Não salva nada!
}
```

## Diagnóstico Passo a Passo

### Teste 1: Verificar Logs do Google Apps Script

1. Abra Google Apps Script
2. Executar > Ver logs de execução
3. Procure por:
   ```
   📝 INICIANDO saveScreening
   ❌ Candidato não encontrado
   ⚠️ Coluna Status não encontrada
   ❌ ERRO EM saveScreening
   ```

### Teste 2: Verificar se Dados Chegam ao Script

Adicione no início de `saveScreening`:
```javascript
function saveScreening(params) {
  Logger.log('═══════════════════════════════════════');
  Logger.log('📥 DADOS RECEBIDOS:');
  Logger.log(JSON.stringify(params, null, 2));
  Logger.log('═══════════════════════════════════════');
  // ... resto do código
}
```

### Teste 3: Verificar Resposta do Script

No console do navegador (F12), procure por:
```javascript
📤 POST Request: saveScreening
📦 Payload: { ... }
📡 Response status: 200
✅ Response data: { success: true, ... }

// OU

❌ Response error: Exceeded maximum execution time
❌ Response error: ReferenceError: row is undefined
```

## Soluções

### Solução Imediata: Debug Logs ✅

Adicione logs detalhados no script:

```javascript
function saveScreening(params) {
  try {
    Logger.log('═════════ INÍCIO TRIAGEM ═════════');
    Logger.log('Candidato ID: ' + params.candidateId);
    Logger.log('Status enviado: ' + params.status);

    const sh = _sheet(SHEET_CANDIDATOS);
    Logger.log('✅ Planilha encontrada');

    const headers = _getHeaders_(sh);
    Logger.log('✅ Headers: ' + headers.length + ' colunas');

    const col = _colMap_(headers);
    Logger.log('✅ Coluna Status: ' + col['Status']);

    const row = _findRowByValue_(sh, col['CPF'], params.candidateId);
    Logger.log('✅ Linha encontrada: ' + row);

    if (!row) {
      Logger.log('❌ ERRO: Candidato não encontrado!');
      throw new Error('Candidato não encontrado');
    }

    Logger.log('✅ Atualizando dados...');
    // ... resto do código

    Logger.log('✅ TRIAGEM SALVA COM SUCESSO');
    Logger.log('═════════ FIM TRIAGEM ═════════');

    return { success: true, message: 'OK' };
  } catch (error) {
    Logger.log('❌ ERRO: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}
```

### Solução Definitiva: Usar Script Otimizado ⚡

**Arquivo:** `google-apps-script-OTIMIZADO-5000-LINHAS.js`

**Mudanças principais:**

1. **`_findRowByValue_` - Busca sem carregar tudo**
```javascript
function _findRowByValue_(sh, colIndex, searchValue) {
  // Usa TextFinder (API nativa otimizada)
  const column = sh.getRange(HEADER_ROWS + 1, colIndex + 1, lastRow - HEADER_ROWS, 1);
  const finder = column.createTextFinder(String(searchValue).trim());
  const result = finder.findNext();

  if (result) {
    return result.getRow();
  }

  // Fallback: busca em chunks de 500 linhas
  // ...
}
```

2. **`_updateRowColumns_` - Atualiza só o necessário**
```javascript
function _updateRowColumns_(sh, row, colUpdates) {
  for (const [colIndex, value] of Object.entries(colUpdates)) {
    sh.getRange(row, parseInt(colIndex) + 1).setValue(value);
  }
}
```

3. **`saveScreening` otimizado**
```javascript
function saveScreening(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  // ✅ Busca eficiente
  const row = _findRowByValue_(sh, col['CPF'], params.candidateId);

  // ✅ Atualiza apenas colunas necessárias
  const updates = {};
  if (col['Status'] >= 0) updates[col['Status']] = statusFinal;
  if (col['Analista'] >= 0) updates[col['Analista']] = params.analystEmail;
  // ...

  _updateRowColumns_(sh, row, updates);
}
```

## Checklist de Verificação

- [ ] Logs do Google Apps Script mostram dados recebidos?
- [ ] Console do navegador mostra resposta `success: true`?
- [ ] Coluna "Status" existe na planilha CANDIDATOS?
- [ ] CPF/Número de Inscrição corresponde exatamente?
- [ ] Script está atualizado (não é versão antiga)?
- [ ] Tempo de execução < 30s?
- [ ] Cache não está corrompido?

## Próximos Passos

1. **Verificar logs do Google Apps Script**
2. **Se erro de timeout:** Usar script otimizado
3. **Se coluna não encontrada:** Executar `addStatusColumnIfNotExists()`
4. **Se candidato não encontrado:** Verificar formato do ID (CPF vs Número)
5. **Se cache corrompido:** Limpar cache manualmente

---

## Teste Rápido

Adicione este teste no Google Apps Script:

```javascript
function testarSaveScreening() {
  const testData = {
    candidateId: '12345678901',  // ← SUBSTITUIR por CPF real
    status: 'classificado',
    analystEmail: 'teste@email.com',
    'checkrg-cpf': 'conforme',
    capacidade_tecnica: 7,
    experiencia: 8
  };

  const result = saveScreening(testData);
  Logger.log('Resultado:', JSON.stringify(result));
}
```

Execute e verifique o resultado nos logs.
