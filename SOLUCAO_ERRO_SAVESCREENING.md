# 🔧 Solução para Erro ao Salvar Triagem

## ❌ Problema Identificado

A triagem **não está sendo salva** na planilha devido a um erro crítico na função `_writeWholeRow_`:

```javascript
// ❌ CÓDIGO COM ERRO (linha 185-188)
function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();
  sh.getRange(row, 1, 1, lastCol).setValues([rowArray]);
}
```

### Causa do Erro

**Google Sheets exige que o array de dados tenha EXATAMENTE o mesmo tamanho do range.**

Se `rowArray.length !== lastCol`, ocorre o erro:
```
The number of columns in the data does not match the number of columns in the range
```

### Cenários Problemáticos

1. **Planilha tem 50 colunas**, mas `rowArray` tem apenas 45 valores
2. **rowArray tem 52 valores**, mas a planilha só tem 50 colunas
3. Qualquer incompatibilidade entre tamanhos

---

## ✅ Solução Implementada

### Código Corrigido

```javascript
function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();

  // ✅ Ajusta o array para o tamanho correto
  const adjustedArray = [...rowArray];

  // ✅ Preenche com strings vazias se faltar colunas
  while (adjustedArray.length < lastCol) {
    adjustedArray.push('');
  }

  // ✅ Corta se tiver mais colunas que o necessário
  if (adjustedArray.length > lastCol) {
    adjustedArray.length = lastCol;
  }

  sh.getRange(row, 1, 1, lastCol).setValues([adjustedArray]);
}
```

### Como a Correção Funciona

| Situação | Ação | Resultado |
|----------|------|-----------|
| `rowArray` tem **45 valores**, planilha tem **50 colunas** | Adiciona 5 strings vazias (`''`) no final | Array fica com 50 elementos ✅ |
| `rowArray` tem **52 valores**, planilha tem **50 colunas** | Remove os últimos 2 valores | Array fica com 50 elementos ✅ |
| `rowArray` tem **50 valores**, planilha tem **50 colunas** | Nenhuma alteração necessária | Array permanece com 50 elementos ✅ |

---

## 🚀 Passo a Passo para Corrigir

### 1️⃣ Abra o Google Apps Script

1. Acesse: https://script.google.com/
2. Abra o projeto do sistema de triagem
3. Localize o arquivo principal (Code.gs)

### 2️⃣ Localize a Função

Procure pela linha 185:
```javascript
function _writeWholeRow_(sh, row, rowArray){
```

### 3️⃣ Substitua o Código

**Apague estas 4 linhas (185-188):**
```javascript
function _writeWholeRow_(sh, row, rowArray){
  const lastCol = sh.getLastColumn();
  sh.getRange(row, 1, 1, lastCol).setValues([rowArray]);
}
```

**Cole o novo código:**
```javascript
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
```

### 4️⃣ Salve e Teste

1. **Salve** o script (Ctrl+S ou Cmd+S)
2. **Execute** a função de teste (opcional):
   ```javascript
   testarWriteWholeRow()
   ```
3. **Teste** o `saveScreening` no sistema

---

## 🧪 Validação

### Teste Manual

Use o arquivo `teste-triagem.html` incluído no projeto:

1. Abra o arquivo em um navegador
2. Preencha os dados do candidato
3. Clique em "🚀 Testar Triagem"
4. Verifique os logs no painel

### Teste no Sistema

1. Acesse o painel de triagem
2. Selecione um candidato
3. Faça a avaliação documental
4. Clique em "Classificar" ou "Desclassificar"
5. Verifique se aparece "✅ Triagem salva com sucesso"
6. **Confirme na planilha** que os dados foram salvos

---

## 📊 Funções Afetadas

Esta correção resolve erros em todas as funções que usam `_writeWholeRow_`:

✅ `saveScreening` (linha 2064)
✅ `updateCandidateStatus` (linha 467)
✅ `saveInterviewEvaluation` (linha 1727)
✅ `updateInterviewStatus` (linha 1639)

---

## 🔍 Verificação de Sucesso

### Antes da Correção
```
❌ Erro: The number of columns in the data does not match...
❌ Triagem não é salva
❌ Status não muda na planilha
```

### Depois da Correção
```
✅ Triagem salva com sucesso
✅ Status atualizado na coluna "Status"
✅ Documentos salvos nas colunas correspondentes
✅ Observações registradas
```

---

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup do script antes de modificar
2. **Teste**: Execute o teste em um ambiente controlado primeiro
3. **Logs**: Monitore os logs do Google Apps Script durante os testes
4. **Cache**: Pode levar até 60 segundos para o cache atualizar

---

## 🆘 Problemas Comuns

### "Candidato não encontrado"
- Verifique se o CPF/Número de Inscrição está correto
- Execute `addStatusColumnIfNotExists()` para criar colunas necessárias

### "Erro de permissão"
- Verifique as permissões do Google Apps Script
- Reautorize o script se necessário

### "Timeout"
- Planilha muito grande (>10.000 linhas)
- Considere otimizar índices com `_bumpRev_()`

---

## ✅ Checklist Final

- [ ] Código da função `_writeWholeRow_` corrigido
- [ ] Script salvo no Google Apps Script
- [ ] Teste executado com sucesso
- [ ] Triagem testada no sistema
- [ ] Dados confirmados na planilha
- [ ] Cache invalidado (`_bumpRev_()` chamado)

---

## 🎯 Resultado Esperado

Após a correção, o fluxo completo funciona:

```
Frontend → saveScreening() → POST para Google Apps Script
    ↓
Google Apps Script → saveScreening(params)
    ↓
_getIndex_() → Busca candidato por CPF
    ↓
_writeWholeRow_() → ✅ CORRIGIDO - Ajusta tamanho do array
    ↓
Planilha CANDIDATOS → Dados salvos com sucesso
    ↓
_bumpRev_() → Cache invalidado
    ↓
Frontend → ✅ "Triagem salva com sucesso!"
```

---

**Data da Correção:** 2025-01-19
**Versão do Script:** PRODUCAO-COMPLETO
**Status:** ✅ Pronto para deploy
