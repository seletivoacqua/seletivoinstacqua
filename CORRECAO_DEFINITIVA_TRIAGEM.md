# 🔧 Correção Definitiva - Problema de Salvamento da Triagem

## 📋 Problema Identificado

O analista não conseguia salvar os dados da triagem. O console do navegador não mostrava erros, mas os dados não eram persistidos no Google Sheets.

## 🔍 Causa Raiz

**Método HTTP inadequado + URL muito longa**

1. ❌ O serviço `googleSheets.ts` estava usando **GET** para todas as requisições
2. ❌ Dados da triagem eram enviados como parâmetros na URL via QueryString
3. ❌ URLs têm limite de ~2000 caracteres
4. ❌ Triagem envia muitos dados:
   - 6 campos de documentos (checkrg-cpf, check-cnh, check-experiencia, etc.)
   - 2 campos de avaliação técnica (capacidade_tecnica, experiencia)
   - Observações, motivo de desclassificação, timestamps, etc.
5. ❌ URL excedia o limite → requisição falhava silenciosamente

## ✅ Solução Implementada

### 1. Nova Função `makePostRequest` (src/services/googleSheets.ts)

```typescript
async function makePostRequest(
  action: string,
  params: any = {}
): Promise<GoogleSheetsResponse> {
  const payload = {
    action,
    ...params
  };

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',  // ✅ Usa POST ao invés de GET
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)  // ✅ Dados no body, não na URL
  });

  // ... tratamento de resposta com logs detalhados
}
```

### 2. Atualização do `saveScreening`

```typescript
async saveScreening(screeningData: any): Promise<GoogleSheetsResponse> {
  console.log('🔄 saveScreening - Usando POST para enviar dados');
  const result = await makePostRequest('saveScreening', screeningData);  // ✅ Usa POST

  if (result.success) {
    console.log('✅ Triagem salva - Invalidando cache');
    cacheService.invalidatePattern(/getCandidates/);
    cacheService.invalidatePattern(/getCandidatesByStatus/);
    cacheService.invalidatePattern(/getReportStats/);
  }

  return result;
}
```

### 3. Correção de Timing no Modal (src/components/ScreeningModal.tsx)

```typescript
if (result.success) {
  alert(`Triagem salva com sucesso!\nStatus: ${result.status}`);
  handleClose();  // ✅ Fecha modal primeiro

  // ✅ Aguarda 100ms antes de recarregar (evita race condition)
  setTimeout(() => {
    onScreeningComplete();
  }, 100);
}
```

## 🎯 Resultado Esperado

Agora o fluxo funciona corretamente:

1. ✅ Analista preenche a triagem no modal
2. ✅ Clica em "Classificar" ou "Desclassificar"
3. ✅ Dados são enviados via **POST** (sem limite de tamanho)
4. ✅ Google Apps Script recebe e processa os dados
5. ✅ Dados são salvos no Google Sheets
6. ✅ Cache do Google Apps Script é invalidado (`_bumpRev_()`)
7. ✅ Frontend recebe confirmação de sucesso
8. ✅ Modal fecha imediatamente
9. ✅ Lista de candidatos é recarregada (100ms depois)
10. ✅ Candidato triado desaparece da lista
11. ✅ Próximo candidato é selecionado automaticamente

## 📊 Logs Adicionados

A nova implementação adiciona logs detalhados para debug:

```
📤 POST Request: saveScreening
📦 Payload: { action: "saveScreening", candidateId: "...", ... }
📡 Response status: 200
✅ Response data: { success: true, data: { ... } }
✅ Triagem salva - Invalidando cache
```

## 🔐 Compatibilidade com Google Apps Script

O Google Apps Script já estava preparado para receber POST:

```javascript
function doPost(e) {
  return handleRequest(e);  // ✅ Já implementado
}

function handleRequest(e) {
  // Suporta tanto GET quanto POST
  if (e && e.postData && e.postData.contents) {
    const data = JSON.parse(e.postData.contents);  // ✅ Lê do body
    action = data.action;
    params = data;
  }
  // ...
}
```

## ✅ Checklist de Verificação

- [x] Função `makePostRequest` criada
- [x] `saveScreening` atualizado para usar POST
- [x] Logs detalhados adicionados
- [x] Timing do modal corrigido
- [x] Build passou sem erros
- [x] Google Apps Script compatível com POST

## 🧪 Como Testar

1. Acesse o sistema como analista
2. Selecione um candidato para triagem
3. Preencha a avaliação de documentos
4. Classifique ou desclassifique o candidato
5. Observe os logs no console do navegador:
   - ✅ Deve mostrar "📤 POST Request: saveScreening"
   - ✅ Deve mostrar "📡 Response status: 200"
   - ✅ Deve mostrar "✅ Triagem salva"
6. Verifique o Google Sheets:
   - ✅ Coluna "Status" deve estar preenchida
   - ✅ Documentos devem estar salvos
   - ✅ Data de triagem deve estar registrada

## 📝 Notas Técnicas

- **GET vs POST**: GET tem limite de ~2000 caracteres na URL, POST não tem limite prático
- **Content-Type**: Usar `application/json` permite envio de objetos complexos
- **Cache**: Invalidação de cache garante que dados frescos são carregados
- **Timeout**: 100ms de delay evita race conditions entre fechar modal e recarregar lista
- **Google Apps Script**: Suporta nativamente POST com `doPost(e)` e parsing de JSON

## 🚀 Próximos Passos

Se ainda houver problemas:
1. Verifique a URL do Google Apps Script no `.env`
2. Confirme que o script está publicado como "Anyone"
3. Verifique logs do Google Apps Script (View > Logs)
4. Teste manualmente com curl ou Postman
