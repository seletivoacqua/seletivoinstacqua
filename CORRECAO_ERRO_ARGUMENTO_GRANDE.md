# 🔧 Correção - Erro "Argumento grande demais" ao Salvar Entrevista

## 🔴 Problema

Ao salvar avaliação de entrevista no `InterviewEvaluationForm.tsx`, o sistema retorna:

```
Erro ao salvar avaliação: Error: Argumento grande demais: value
at A (index-dPt6mQBI.js:296:2067)
```

### Causa

A função `saveInterviewEvaluation` no Google Apps Script tenta escrever uma **linha inteira** de dados de uma vez usando `_writeWholeRow_`. Quando a planilha tem muitas colunas ou células com muito texto, o Google Apps Script atinge o limite de tamanho de argumento.

## ✅ Solução

Substituir `_writeWholeRow_` por atualizações de **células individuais**.

### ❌ Antes (Código Problemático)

```javascript
function saveInterviewEvaluation(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  // ... buscar linha ...

  const lastCol = sh.getLastColumn();
  const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];

  // Atualizar array inteiro com TODOS os dados da linha
  if (statusEntrevistaCol >= 0) rowVals[statusEntrevistaCol] = 'Avaliado';
  if (entrevistadorCol >= 0) rowVals[entrevistadorCol] = params.interviewerEmail;
  // ... mais 15+ atualizações ...

  _writeWholeRow_(sh, row, rowVals); // ❌ ERRO AQUI - argumento muito grande
}
```

### ✅ Depois (Código Corrigido)

```javascript
function saveInterviewEvaluation(params) {
  const sh = _sheet(SHEET_CANDIDATOS);
  const headers = _getHeaders_(sh);
  const col = _colMap_(headers);

  // ... buscar linha ...

  // Calcular pontuação
  const totalScore = /* cálculo da pontuação */;

  // ✅ CORREÇÃO: Atualizar células individualmente
  const updates = [
    { col: col['status_entrevista'], value: 'Avaliado' },
    { col: col['entrevistador'], value: params.interviewerEmail || '' },
    { col: col['interview_score'], value: totalScore },
    { col: col['interview_notes'], value: (params.impressao_perfil || '').substring(0, 50000) },
    // ... mais campos ...
  ];

  // Atualizar cada célula individualmente
  let updatedCount = 0;
  for (const update of updates) {
    if (update.col >= 0) {
      try {
        sh.getRange(row, update.col + 1).setValue(update.value); // ✅ Célula por célula
        updatedCount++;
      } catch (cellError) {
        Logger.log('⚠️ Erro ao atualizar coluna ' + update.col);
      }
    }
  }

  Logger.log('✅ ' + updatedCount + ' células atualizadas com sucesso');
  _bumpRev_();
}
```

## 📊 Comparação

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Método | `_writeWholeRow_` (linha inteira) | `setValue()` (célula por célula) |
| Tamanho de dados | Toda a linha (~100+ colunas) | Apenas 19 células necessárias |
| Resiliência | Falha tudo se houver erro | Falha apenas célula problemática |
| Performance | Pior (lê e escreve tudo) | Melhor (escreve só necessário) |

## 🚀 Arquivo Corrigido

**Nome:** `google-apps-script-PATCH-ENTREVISTA-CELULAS.js`
**Mudanças:**
1. Substituir `_writeWholeRow_` por atualizações individuais
2. Adicionar array `updates` com todas as células
3. Loop para atualizar cada célula com tratamento de erro
4. Limitar tamanho do campo `interview_notes` a 50.000 caracteres

---

## 📋 Passo a Passo - Aplicar Correção

### 1. Abrir Google Apps Script

Acesse: https://script.google.com/home/projects/1MH6PG7VJ89MKxvlX1C64fJx7EfmHCU2Qv9WDcICDNSBDazxJfKLGrzN3/edit

### 2. Localizar Função

Use `Ctrl+F` e procure: `function saveInterviewEvaluation`

Deve estar na linha ~1650

### 3. Substituir Função Completa

Copie o código do arquivo `google-apps-script-PATCH-ENTREVISTA-CELULAS.js` e substitua a função inteira.

### 4. Salvar e Testar

1. Clique em **Salvar projeto** (Ctrl+S)
2. Não precisa fazer novo deploy (mesmo projeto)
3. Teste salvando uma avaliação no frontend

## 💡 Por Que o Erro Ocorria

1. **Linha inteira lida de uma vez:** `getRange(row, 1, 1, lastCol).getValues()[0]` lê todas as ~100+ colunas
2. **Array grande modificado:** Modificar array com todos os dados da linha
3. **Escrita de linha completa:** `_writeWholeRow_` tenta escrever array gigante de volta
4. **Limite do Google Apps Script:** Parâmetros muito grandes causam erro "Argumento grande demais"

### Limite do Google Apps Script

```
Google Apps Script tem limites de tamanho para:
- Parâmetros de função (~50KB)
- Arrays em setValues()
- Strings individuais
```

## ⚠️ Boas Práticas

### ✅ FAZER (Atualização Eficiente)

```javascript
// Atualizar apenas células necessárias
sh.getRange(row, col['status_entrevista'] + 1).setValue('Avaliado');
sh.getRange(row, col['interview_score'] + 1).setValue(totalScore);
sh.getRange(row, col['interview_notes'] + 1).setValue(notes.substring(0, 50000));
```

### ❌ EVITAR (Atualização de Linha Inteira)

```javascript
// NÃO fazer isso com planilhas grandes
const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];
rowVals[col1] = value1;
rowVals[col2] = value2;
// ... modificar muitos valores ...
sh.getRange(row, 1, 1, lastCol).setValues([rowVals]); // ❌ Pode falhar
```

## 🎯 Resultado Esperado

Após implementar o script corrigido:

1. ✅ **Erro "Argumento grande demais" resolvido**
2. ✅ **Avaliação de entrevista salva corretamente**
3. ✅ **Todos os campos salvos** (pontuação, notas, resultado)
4. ✅ **Performance melhorada** (escreve apenas células necessárias)
5. ✅ **Logs mostram células atualizadas** (ex: "19 células atualizadas com sucesso")

## 📝 Checklist de Verificação

- [ ] Função `saveInterviewEvaluation` localizada no script
- [ ] Código substituído completamente
- [ ] Salvo no Google Apps Script (Ctrl+S)
- [ ] Testado preencher avaliação completa
- [ ] Testado salvar avaliação
- [ ] Pontuação calculada corretamente (0-120)
- [ ] Status "Avaliado" aparece na planilha
- [ ] Logs mostram "X células atualizadas com sucesso"
- [ ] Sem erro "Argumento grande demais"

## 🆘 Se o Erro Persistir

Se ainda houver erro após implementar:

1. **Verifique se salvou corretamente:**
   - A função foi substituída por completo?
   - Clicou em Salvar (ícone de disquete)?

2. **Verifique os logs do Apps Script:**
   - Vá em "Execuções" no menu lateral
   - Veja a última execução de `saveInterviewEvaluation`
   - Procure por mensagem de erro específica

3. **Limpe o cache do navegador:**
   - Feche e reabra o navegador
   - Ou limpe cache (Ctrl+Shift+Delete)

4. **Verifique outras funções:**
   - Outras funções podem usar `_writeWholeRow_`
   - Busque no script: `Ctrl+F` → `_writeWholeRow_`
   - Aplique a mesma correção se necessário

---

## 🔄 Aplicar Correção em Outras Funções

Se encontrar o mesmo erro em outras partes do sistema (triagem, alocação, etc.), aplique o mesmo padrão:

**Substituir:**
```javascript
const rowVals = sh.getRange(row, 1, 1, lastCol).getValues()[0];
rowVals[col['campo']] = valor;
_writeWholeRow_(sh, row, rowVals);
```

**Por:**
```javascript
sh.getRange(row, col['campo'] + 1).setValue(valor);
```

---

**Nota:** Esta correção otimiza a escrita de dados no Google Sheets, evitando o limite de tamanho de argumento.
