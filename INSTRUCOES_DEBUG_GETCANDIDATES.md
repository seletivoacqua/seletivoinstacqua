# Instruções: Debug getCandidates

## Problema Atual

Após adicionar paginação, o sistema não retorna mais candidatos.

## Passo 1: Atualizar Google Apps Script

1. Abra o Google Apps Script
2. Cole o código do arquivo `google-apps-script-COMPLETO-FINAL.js` (atualizado)
3. **Deploy > Nova implantação** ou **Gerenciar implantações > Editar**
4. Salve e copie a nova URL

## Passo 2: Testar Manualmente

Abra o arquivo `teste-getcandidates.html` no navegador:

```bash
# No seu computador, abra:
projeto/teste-getcandidates.html
```

1. Cole a URL do Google Apps Script
2. Clique em "Testar SEM Parâmetros"
3. Veja o log no console

### O que verificar:

✅ **Se aparecer candidatos:**
- O script está funcionando
- O problema é no frontend

❌ **Se não aparecer candidatos:**
- Veja os logs no Google Apps Script
- Verifique se `HEADER_ROWS` está correto
- Verifique se a aba se chama "Candidatos"

## Passo 3: Ver Logs do Google Apps Script

1. No Google Apps Script, clique em **Execuções**
2. Clique na última execução
3. Veja os logs:

```
🔵 getCandidates INICIADO
🔵 Parâmetros recebidos: {...}
✅ Sheet encontrada
✅ Headers carregados: XX colunas
📊 LastRow: XXXX, LastCol: XX, HEADER_ROWS: 2
📊 Total de linhas na planilha: XXXX
```

### Problemas Comuns:

#### Log mostra: "Sheet CANDIDATOS não encontrada"
**Solução:** Verifique o nome da aba na linha 97 do script:
```javascript
const SHEET_CANDIDATOS = 'Candidatos'; // Nome EXATO da aba
```

#### Log mostra: "Planilha vazia ou sem dados após header"
**Solução:** Ajuste `HEADER_ROWS` na linha 98:
```javascript
const HEADER_ROWS = 2; // Se o cabeçalho está na linha 2
// OU
const HEADER_ROWS = 1; // Se o cabeçalho está na linha 1
```

#### Log mostra: "readCount <= 0"
**Solução:** O cálculo está errado. Verifique:
- `lastRow` está correto?
- `HEADER_ROWS` está correto?
- `offset` não está maior que o total de linhas?

## Passo 4: Testar no Sistema

1. Abra o sistema no navegador
2. Abra o Console (F12)
3. Faça login
4. Veja os logs:

```
📞 Chamando getCandidates do Google Sheets...
📊 Parâmetros - Offset: 0 Limit: 5000
🔄 Chamando Google Apps Script: https://...
📡 Resposta recebida - Status: 200
✅ Dados recebidos: {success: true, data: {...}}
📊 result.data.candidates: Array(XXX)
```

### Se não aparecer candidatos:

1. **Verifique a URL no .env:**
```bash
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

2. **Verifique se está usando a URL /exec e não /dev:**
```
❌ ERRADO: .../dev
✅ CORRETO: .../exec
```

## Passo 5: Ajustar HEADER_ROWS

Se sua planilha tem estrutura diferente:

### Exemplo 1: Cabeçalho na linha 1
```
| CPF | Nome | Status |  <- Linha 1
| 123 | João | ...    |  <- Linha 2 (primeira linha de dados)
```
**Use:** `HEADER_ROWS = 1`

### Exemplo 2: Cabeçalho na linha 2
```
| Título ou descrição    |  <- Linha 1
| CPF | Nome | Status |  <- Linha 2
| 123 | João | ...    |  <- Linha 3 (primeira linha de dados)
```
**Use:** `HEADER_ROWS = 2`

### Exemplo 3: Cabeçalho na linha 3
```
| Título                 |  <- Linha 1
| Subtítulo              |  <- Linha 2
| CPF | Nome | Status |  <- Linha 3
| 123 | João | ...    |  <- Linha 4 (primeira linha de dados)
```
**Use:** `HEADER_ROWS = 3`

## Passo 6: Reverter para Versão Anterior (se necessário)

Se ainda não funcionar, podemos reverter temporariamente:

1. No `google-apps-script-COMPLETO-FINAL.js`, substitua a função `getCandidates` por:

```javascript
function getCandidates(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return { candidates: [] };

  const out = values.map(row => {
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    return obj;
  });
  return { candidates: out };
}
```

2. No `src/services/candidateService.ts`, linha 212, mude:
```typescript
const allData = await sheetsService.getCandidates(); // SEM parâmetros
```

Isso volta ao comportamento original (carrega tudo).

## Verificação Final

Execute no Console do navegador (F12):

```javascript
// Ver quantos candidatos foram carregados
console.log('Total de candidatos:', window.__candidatesCache?.length);

// Ver estrutura do primeiro candidato
console.log('Primeiro candidato:', window.__candidatesCache?.[0]);
```

## Contato

Se continuar com problemas:

1. Copie os logs do Google Apps Script
2. Copie os logs do Console do navegador
3. Me envie dizendo qual erro específico aparece

---

**Arquivos atualizados:**
- ✅ `google-apps-script-COMPLETO-FINAL.js` (com logs detalhados)
- ✅ `src/services/candidateService.ts` (com paginação)
- ✅ `teste-getcandidates.html` (ferramenta de debug)
