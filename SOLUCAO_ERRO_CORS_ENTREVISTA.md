# Solução: Erro CORS ao Salvar Avaliação de Entrevista

## 🔴 Problema Identificado

A avaliação de entrevista não estava sendo salva devido a **três problemas**:

### 1. Erro de CORS (Crítico)
```
Access to fetch at 'https://script.google.com/...' from origin 'https://seletivoinstacqua.netlify.app'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Causa**: O Google Apps Script não estava retornando os headers CORS necessários.

### 2. Método HTTP Incorreto
O frontend estava enviando a requisição via **GET** ao invés de **POST**, causando perda de dados.

### 3. Colunas Incorretas no Script
O script estava tentando salvar em `data_entrevista`, mas as colunas corretas são:
- `entrevistador_at` (timestamp da avaliação)
- `entrevistador_by` (email do entrevistador)

### 4. Cálculo de Pontuação Diferente
O frontend não estava multiplicando por 2 as seções 1, 2 e 5, resultando em pontuações incorretas (máximo 70 ao invés de 120).

---

## ✅ Correções Aplicadas

### 1. Frontend (✅ Já Corrigido)

#### `src/components/InterviewEvaluationForm.tsx`
- **Cálculo corrigido**: Agora multiplica por 2 as seções 1, 2 e 5
- **Total correto**: 120 pontos (antes era ~70)

#### `src/services/googleSheets.ts`
- **Método HTTP corrigido**: Mudado de GET para POST
- **Logs adicionados**: Para debug da requisição

### 2. Google Apps Script (⚠️ Precisa Aplicar)

Você precisa atualizar o script no Google Apps Script Editor com as correções do arquivo:
📄 **`PATCH-CORS-ENTREVISTA.js`**

#### Mudanças necessárias:

**A. Adicionar Headers CORS** (linha ~194)
```javascript
function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.setHeader('Access-Control-Max-Age', '3600');
  return output;
}
```

**B. Adicionar função doOptions** (antes de doGet)
```javascript
function doOptions(e) {
  return createCorsResponse({ success: true, message: 'CORS preflight OK' });
}
```

**C. Corrigir colunas na saveInterviewEvaluation** (linha ~1658-1660)
```javascript
// ANTES:
const dataEntrevistaCol = col['data_entrevista'];

// DEPOIS:
const entrevistadorAtCol = col['entrevistador_at'];
const entrevistadorByCol = col['entrevistador_by'];
```

**D. Corrigir salvamento** (linha ~1709-1710)
```javascript
// ANTES:
if (dataEntrevistaCol >= 0) rowVals[dataEntrevistaCol] = getCurrentTimestamp();

// DEPOIS:
if (entrevistadorAtCol >= 0) rowVals[entrevistadorAtCol] = getCurrentTimestamp();
if (entrevistadorByCol >= 0) rowVals[entrevistadorByCol] = params.interviewerEmail || '';
```

---

## 📋 Passo a Passo para Aplicar

### 1. Abrir Google Apps Script Editor
1. Acesse [Google Apps Script](https://script.google.com)
2. Abra o projeto do sistema de triagem
3. Localize o arquivo principal (.gs)

### 2. Aplicar as Correções

#### Correção 1: createCorsResponse
- Encontre a função `createCorsResponse` (linha ~194)
- Substitua pela versão com headers CORS do `PATCH-CORS-ENTREVISTA.js`

#### Correção 2: doOptions
- **Antes** das funções `doGet` e `doPost`
- Adicione a função `doOptions`

#### Correção 3: saveInterviewEvaluation
- Encontre a função `saveInterviewEvaluation` (linha ~1650)
- Localize onde define `const dataEntrevistaCol = col['data_entrevista'];`
- Substitua pelas duas linhas novas (entrevistadorAtCol e entrevistadorByCol)
- Localize onde salva: `if (dataEntrevistaCol >= 0)...`
- Substitua pelas duas linhas novas

### 3. Salvar e Publicar
1. Clique em **Salvar** (💾)
2. Clique em **Implantar** > **Gerenciar implantações**
3. Clique em **✏️ Editar** na implantação ativa
4. Mude a versão para **Nova versão**
5. Clique em **Implantar**

### 4. Testar
1. Faça logout e login novamente no sistema
2. Acesse o dashboard de entrevistador
3. Tente avaliar um candidato
4. Verifique no console do navegador (F12) se não há mais erros de CORS

---

## 🧪 Verificação

Após aplicar as correções, você deve ver no console:

```
✅ 200ms POST saveInterviewEvaluation (success)
✅ Avaliação salva - Invalidando cache
```

**Sem erros de**:
- ❌ CORS policy
- ❌ Failed to fetch
- ❌ No 'Access-Control-Allow-Origin' header

---

## 📊 Dados Salvos Corretamente

Após a correção, os seguintes dados serão salvos no Google Sheets:

| Coluna | Valor |
|--------|-------|
| `status_entrevista` | "Avaliado" |
| `entrevistador` | Email do entrevistador |
| `entrevistador_at` | Timestamp da avaliação |
| `entrevistador_by` | Email do entrevistador |
| `interview_score` | 0-120 pontos |
| `interview_result` | "Classificado" ou "Desclassificado" |
| `interview_notes` | Impressão do perfil |
| `interview_completed_at` | Timestamp de conclusão |
| `formacao_adequada` | 1-5 |
| `graduacoes_competencias` | 1-5 |
| `descricao_processos` | 1-5 |
| `terminologia_tecnica` | 1-5 |
| `calma_clareza` | 1-5 |
| `escalas_flexiveis` | 0, 5 ou 10 |
| `adaptabilidade_mudancas` | 0, 5 ou 10 |
| `ajustes_emergencia` | 0, 5 ou 10 |
| `residencia` | 2, 4, 6, 8 ou 10 |
| `resolucao_conflitos` | 1-5 |
| `colaboracao_equipe` | 1-5 |
| `adaptacao_perfis` | 1-5 |

---

## 🎯 Pontuação Correta (Total: 120 pontos)

- **Seção 1** (Formação): Máximo 20 pontos - (soma × 2)
- **Seção 2** (Comunicação): Máximo 30 pontos - (soma × 2)
- **Seção 3** (Disponibilidade): Máximo 30 pontos - soma
- **Seção 4** (Residência): Máximo 10 pontos - valor único
- **Seção 5** (Relacionamento): Máximo 30 pontos - (soma × 2)

**TOTAL**: 120 pontos

---

## 📁 Arquivos Criados

- ✅ `PATCH-CORS-ENTREVISTA.js` - Patch com as correções para o Google Apps Script
- ✅ `SOLUCAO_ERRO_CORS_ENTREVISTA.md` - Este documento

---

## ⚠️ Importante

**NÃO ESQUEÇA** de fazer o deploy de uma **nova versão** no Google Apps Script após aplicar as correções. Apenas salvar não é suficiente - você precisa publicar uma nova versão para que as mudanças tenham efeito!
