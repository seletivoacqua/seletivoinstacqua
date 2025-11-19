# 🔧 Correção Definitiva - Salvamento de Triagem

## 🔍 Problema Real Identificado

A triagem **não estava salvando na planilha** porque havia uma **estrutura incorreta na resposta**:

### ❌ Código Antigo (ERRADO)
```javascript
// No handleRequest:
const result = actions[action]();
return createCorsResponse({ success: true, data: result });

// Na função saveScreening:
return {
  success: true,
  message: 'Triagem salva com sucesso',
  ...
};
```

**Resultado:** Resposta dupla `{ success: true, data: { success: true, ... } }`

O frontend estava verificando `result.success` mas o script retornava `result.data.success`.

## ✅ Solução Implementada

### 1. Script Corrigido

Criei o arquivo **`google-apps-script-CORRIGIDO-DEFINITIVO.js`** com as seguintes correções:

**A) Tratamento especial para saveScreening:**
```javascript
function handleRequest(e) {
  // ... parse de params ...

  // ✅ saveScreening retorna diretamente (já tem success/error)
  if (action === 'saveScreening') {
    const result = saveScreening(params);
    return createCorsResponse(result); // ← SEM envolver em { data: ... }
  }

  // Outras ações precisam ser envolv idas
  const actions = {
    'getCandidates': () => getCandidates(params),
    // ...
  };

  if (actions[action]) {
    const result = actions[action]();
    return createCorsResponse({ success: true, data: result });
  }
}
```

**B) Busca de candidato simplificada:**
```javascript
function saveScreening(params) {
  // Busca linear simples (funciona sempre)
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
    throw new Error('Candidato não encontrado');
  }
}
```

**C) Salvamento direto:**
```javascript
// Ler linha completa
const rowVals = sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];

// Atualizar valores
rowVals[statusCol] = statusFinal; // 'Classificado' ou 'Desclassificado'
rowVals[analistaCol] = params.analystEmail;
// ... outros campos ...

// ✅ SALVAR DIRETAMENTE
sh.getRange(targetRow, 1, 1, lastCol).setValues([rowVals]);
```

### 2. Logs Detalhados

O script agora tem logs em TODAS as etapas:

```
📝 INICIANDO saveScreening
📋 Parâmetros completos: { ... }
📊 Colunas disponíveis: { CPF: 0, Status: 5, ... }
🔍 Buscando candidato: 918.490.393-72
✅ Candidato encontrado na linha: 15
📝 Status a gravar: Classificado
👤 Analista: rayanny@email.com
📅 Data triagem gravada
📄 checkrg-cpf: Sim
📄 check-cnh: Sim
✅ TRIAGEM SALVA COM SUCESSO
   Status gravado: Classificado
   Linha: 15
```

## 📋 Passo a Passo para Implementar

### 1. Copiar o Script Corrigido

```bash
# O arquivo está em:
google-apps-script-CORRIGIDO-DEFINITIVO.js
```

### 2. Substituir no Google Apps Script

1. Acesse: https://script.google.com/
2. Abra o projeto do script atual
3. Selecione TODO o código antigo
4. Cole o conteúdo de `google-apps-script-CORRIGIDO-DEFINITIVO.js`
5. Clique em **"Salvar"** (ícone de disquete)

### 3. Fazer um Novo Deploy

**IMPORTANTE:** Você precisa criar uma NOVA versão do deploy:

1. Clique em **"Implantar"** > **"Gerenciar implantações"**
2. Clique no ícone de **lápis** (editar) na implantação atual
3. Em **"Versão"**, clique em **"Nova versão"**
4. Adicione descrição: `Correção definitiva - estrutura de resposta`
5. Clique em **"Implantar"**
6. **A URL NÃO MUDA** (continue usando a mesma URL no `.env`)

### 4. Verificar Logs

Depois de testar a triagem:

1. No Google Apps Script, vá em **"Execuções"** (menu lateral)
2. Clique na execução mais recente
3. Veja os logs detalhados
4. Deve mostrar: `✅ TRIAGEM SALVA COM SUCESSO`

## 🧪 Como Testar

### 1. Console do Navegador

Abra o DevTools (F12) e observe os logs:

```
📤 POST Request: saveScreening
📦 Payload: { action: "saveScreening", ... }
📡 Response status: 200
✅ Response data: { success: true, status: "Classificado", ... }
```

### 2. Google Apps Script

Vá em **Execuções** e veja:

```
📝 INICIANDO saveScreening
✅ TRIAGEM SALVA COM SUCESSO
   Status gravado: Classificado
   Linha: 15
```

### 3. Planilha Google Sheets

1. Abra a planilha **CANDIDATOS**
2. Localize o candidato pela coluna **CPF**
3. Verifique a coluna **Status**:
   - Deve estar **"Classificado"** ou **"Desclassificado"**
4. Verifique a coluna **Analista**:
   - Deve ter o email do analista
5. Verifique a coluna **Data Triagem**:
   - Deve ter a data/hora

## ⚠️ Se Ainda Não Funcionar

### Verificar URL do Script

```bash
# No arquivo .env, confirme a URL:
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
```

### Testar com curl

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

### Verificar Permissões

Se o script não executar:

1. Vá em **"Implantar"** > **"Gerenciar implantações"**
2. Confirme que está como **"Qualquer pessoa"**
3. Se não estiver, edite e altere para **"Qualquer pessoa"**

## 🎯 Diferenças Principais

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Resposta | `{ success: true, data: { success: true } }` | `{ success: true, status: "..." }` |
| Busca | Cache com índice (pode desatualizar) | Busca linear direta (sempre atual) |
| Logs | Básicos | Detalhados em cada etapa |
| Salvamento | Via `_writeWholeRow_` | Direto via `setValues()` |
| Cache | Invalidação complexa | Sem cache (dados sempre frescos) |

## 📊 Estrutura de Resposta Correta

```javascript
// Frontend recebe:
{
  success: true,           // ← Verdadeiro se salvou
  message: "...",          // ← Mensagem descritiva
  status: "Classificado",  // ← Status gravado
  candidateId: "..."       // ← ID do candidato
}

// Ou em caso de erro:
{
  success: false,
  error: "Candidato não encontrado"
}
```

## 🚀 Próximos Passos

1. Substitua o código no Google Apps Script
2. Faça um novo deploy (nova versão)
3. Teste a triagem no sistema
4. Verifique os logs no Apps Script
5. Confirme na planilha que os dados foram salvos

Se ainda houver problemas, compartilhe os logs do Google Apps Script (seção "Execuções").
