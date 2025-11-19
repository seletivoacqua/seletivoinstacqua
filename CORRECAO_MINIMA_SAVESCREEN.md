# 🔧 Correção Mínima - Problema saveScreening

## 📋 O Problema

O sistema **salva os dados no Google Sheets**, mas o frontend não recebe a confirmação correta porque a estrutura da resposta está incorreta.

### ❌ Estrutura Atual (Errada)

```javascript
// Frontend envia POST:
{
  action: "saveScreening",
  candidateId: "918.490.393-72",
  status: "classificado",
  ...
}

// Google Apps Script retorna:
{
  success: true,
  data: {                    // ← Problema: envolve em "data"
    success: true,
    message: "Triagem salva",
    status: "Classificado"
  }
}

// Frontend verifica:
if (result.success) { ... }  // ← Lê success externo (sempre true)
// Mas deveria ler result.data.success
```

### ✅ Estrutura Corrigida

```javascript
// Google Apps Script retorna DIRETO:
{
  success: true,           // ← Direto, sem "data"
  message: "Triagem salva",
  status: "Classificado"
}

// Frontend verifica:
if (result.success) { ... }  // ← Agora funciona!
```

## 🔧 Correção Aplicada

### Mudança no `handleRequest` (linhas 254-268)

**ANTES:**
```javascript
const actions = {
  'saveScreening': () => saveScreening(params),  // ← Dentro do objeto actions
  // ...
};

if (actions[action]) {
  const result = actions[action]();
  return createCorsResponse({ success: true, data: result }); // ← Envolve em "data"
}
```

**DEPOIS:**
```javascript
// ✅ Tratamento especial ANTES do objeto actions
if (action === 'saveScreening') {
  try {
    const result = saveScreening(params);
    return createCorsResponse(result); // ← Retorna direto, sem "data"
  } catch (actionError) {
    return createCorsResponse({
      success: false,
      error: actionError.message || actionError.toString()
    });
  }
}

// Outras ações continuam normal
const actions = {
  'getUserRole': () => getUserRole(params),
  'getCandidates': () => getCandidates(params),
  // ... (saveScreening REMOVIDO daqui)
};

if (actions[action]) {
  const result = actions[action]();
  return createCorsResponse({ success: true, data: result }); // ← Outras ações usam "data"
}
```

## 📦 Arquivo Corrigido

**Nome:** `google-apps-script-PATCH-SAVESCREEN.js`
**Tamanho:** 2329 linhas
**Mudança:** Apenas 15 linhas no `handleRequest` (linhas 254-268)

### ✅ Todas as Funções Mantidas

- ✅ Cache avançado (AdvancedCacheService)
- ✅ Autenticação (getUserRole, getAnalysts)
- ✅ Candidatos (getCandidates, assignCandidates)
- ✅ Triagem (saveScreening, updateCandidateStatus) ← **CORRIGIDO**
- ✅ Mensagens (sendMessages, logMessage, templates)
- ✅ Entrevistas (allocateToInterviewer, saveInterviewEvaluation)
- ✅ Relatórios (getReportStats, getReport)
- ✅ Motivos de desclassificação (getDisqualificationReasons)
- ✅ Email/SMS (GmailApp, Twilio)
- ✅ Todas as funções auxiliares

## 🚀 Como Implementar

### 1. Abrir Google Apps Script

https://script.google.com/

### 2. Substituir o Código

1. Selecione TODO o código atual (Ctrl+A)
2. Delete (Delete)
3. Cole o conteúdo de **`google-apps-script-PATCH-SAVESCREEN.js`**
4. Salve (Ctrl+S ou ícone de disquete)

### 3. Fazer Novo Deploy

**IMPORTANTE:** Nova versão do deploy para aplicar mudanças

1. Clique em **"Implantar"** > **"Gerenciar implantações"**
2. Clique no ícone de **lápis** (editar) na implantação ativa
3. Em **"Versão"**, selecione **"Nova versão"**
4. Descrição: `Correção estrutura resposta saveScreening`
5. Clique em **"Implantar"**
6. **URL permanece a mesma** (não precisa alterar .env)

### 4. Testar

1. Faça login como analista
2. Abra um candidato para triagem
3. Preencha e classifique/desclassifique
4. Abra o Console (F12)
5. Veja os logs:

```
�� POST Request: saveScreening
📦 Payload: { ... }
📡 Response status: 200
✅ Response data: { success: true, message: "...", status: "Classificado" }
✅ Triagem salva - Invalidando cache
```

### 5. Verificar na Planilha

1. Abra a planilha **CANDIDATOS**
2. Localize o candidato (pela coluna CPF)
3. Confirme:
   - ✅ Coluna **Status**: "Classificado" ou "Desclassificado"
   - ✅ Coluna **Analista**: email do analista
   - ✅ Coluna **Data Triagem**: data/hora atual
   - ✅ Colunas de documentos: "Sim", "Não" ou "Não se aplica"

## 📊 Verificar Logs no Apps Script

1. No Google Apps Script, clique em **"Execuções"** (menu lateral esquerdo)
2. Clique na execução mais recente de `handleRequest`
3. Veja os logs:

```
📥 POST recebido - Action: saveScreening
🔄 Ação recebida: saveScreening
═══════════════════════════════════════
📝 INICIANDO saveScreening
📋 Parâmetros recebidos:
   - candidateId: 918.490.393-72
   - status (RAW): "classificado"
✅ Candidato encontrado na linha: 15
📝 Status a gravar: Classificado
✅ TRIAGEM SALVA COM SUCESSO
   Status gravado: Classificado
   Linha: 15
═══════════════════════════════════════
✅ saveScreening resultado: {"success":true,"message":"Triagem salva com sucesso",...}
```

## 🔍 Comparação

| Aspecto | Script Original | Script Corrigido |
|---------|----------------|------------------|
| Linhas de código | 2314 | 2329 (+15) |
| Funções | Todas presentes | Todas presentes ✅ |
| saveScreening | Dentro de `actions` | Tratamento especial ✅ |
| Resposta | `{success, data: {...}}` | `{success, message, ...}` ✅ |
| Outras ações | `{success, data: {...}}` | `{success, data: {...}}` (igual) |

## ⚠️ Notas Importantes

### 1. Apenas saveScreening é Afetado

Todas as outras funções continuam retornando `{ success: true, data: ... }` como antes.

### 2. Compatibilidade Mantida

- ✅ Cache funciona normalmente
- ✅ Índices de linha funcionam
- ✅ Todas as integrações mantidas
- ✅ Email/SMS funcionam
- ✅ Entrevistas funcionam

### 3. Por Que Apenas saveScreening?

A função `saveScreening` já retorna uma estrutura completa:

```javascript
return {
  success: true,
  message: 'Triagem salva com sucesso',
  candidateId: searchKey,
  status: statusFinal
};
```

Enquanto outras funções retornam apenas dados:

```javascript
// getCandidates retorna:
return { candidates: [...] };

// Precisa ser envolvido em:
{ success: true, data: { candidates: [...] } }
```

## 🎯 Resultado Esperado

Após o deploy:

1. ✅ Analista classifica/desclassifica candidato
2. ✅ Modal fecha imediatamente
3. ✅ Dados são salvos no Google Sheets
4. ✅ Status do candidato é atualizado na planilha
5. ✅ Frontend recebe confirmação correta
6. ✅ Cache é invalidado
7. ✅ Lista de candidatos é atualizada
8. ✅ Próximo candidato é selecionado

## 🐛 Debug

Se ainda não funcionar:

### 1. Verificar URL do Script

```bash
# No .env:
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
```

### 2. Testar Endpoint Direto

```bash
curl -X POST \
  'https://script.google.com/macros/s/SEU_SCRIPT_ID/exec' \
  -H 'Content-Type: application/json' \
  -d '{"action":"test"}'
```

Deve retornar:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "...",
    "spreadsheetId": "..."
  }
}
```

### 3. Testar saveScreening Direto

```bash
curl -X POST \
  'https://script.google.com/macros/s/SEU_SCRIPT_ID/exec' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "saveScreening",
    "candidateId": "918.490.393-72",
    "status": "classificado",
    "analystEmail": "teste@email.com"
  }'
```

Deve retornar:
```json
{
  "success": true,
  "message": "Triagem salva com sucesso",
  "status": "Classificado",
  "candidateId": "918.490.393-72"
}
```

### 4. Verificar Permissões

1. Google Apps Script > Implantar > Gerenciar implantações
2. Confirme: **"Executar como: Eu"**
3. Confirme: **"Quem tem acesso: Qualquer pessoa"**

## 💡 Por Que Funcionará Agora

**Antes:** Frontend esperava `result.success` mas recebia `result.data.success`
**Depois:** Frontend recebe `result.success` diretamente

O código do frontend NÃO precisa ser alterado, apenas o Google Apps Script.
