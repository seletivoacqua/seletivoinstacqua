# Alterações no Google Apps Script - RESERVISTA e CARTAOSUS

## Documentos Adicionados

Foram adicionados dois novos campos de documentos ao sistema:

1. **RESERVISTA** - Certificado de Reservista
2. **CARTAOSUS** - Cartão do SUS

## Alterações Necessárias

### ⚠️ IMPORTANTE
O Google Apps Script lê automaticamente todas as colunas da planilha CANDIDATOS. **NÃO é necessário fazer alterações no código do script** se você:

1. Adicionar as colunas `RESERVISTA` e `CARTAOSUS` na planilha CANDIDATOS
2. As colunas devem estar no cabeçalho (linha 1)
3. As URLs dos documentos devem ser preenchidas nas células correspondentes

### Estrutura da Planilha CANDIDATOS

Adicione as seguintes colunas (se ainda não existirem):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| RESERVISTA | Texto/URL | Link para o documento de Reservista |
| CARTAOSUS | Texto/URL | Link para o Cartão SUS |

### Como o Sistema Funciona

O script `google-apps-script-PRODUCAO-COMPLETO.js` já possui a função `getCandidates()` que:

```javascript
function getCandidates(params) {
  const {sheet, headers, values} = _readSheetBlock_(SHEET_CANDIDATOS);
  if (!sheet || !values.length) return { candidates: [] };

  const out = values.map(row => {
    const obj = {};
    // ↓ Este loop lê TODAS as colunas automaticamente
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    return obj;
  });
  return { candidates: out };
}
```

**Isso significa que:** Qualquer coluna adicionada na planilha será automaticamente incluída no objeto retornado.

## Alterações no Frontend (Já Aplicadas)

### 1. src/types/candidate.ts
```typescript
// Adicionado:
RESERVISTA?: string;
CARTAOSUS?: string;
```

### 2. src/components/DocumentViewer.tsx
```typescript
// Importação atualizada:
import { ShieldCheck } from 'lucide-react';

// Documentos adicionados ao array:
{
  key: 'reservista',
  label: 'Reservista',
  url: candidate.RESERVISTA,
  icon: <ShieldCheck className="w-5 h-5" />
},
{
  key: 'cartao_sus',
  label: 'Cartão SUS',
  url: candidate.CARTAOSUS,
  icon: <CreditCard className="w-5 h-5" />
}
```

### 3. src/components/CandidateDetailView.tsx
```typescript
// Labels adicionados:
RESERVISTA: 'RESERVISTA',
CARTAOSUS: 'CARTÃO SUS',

// Campos adicionados à seção de documentos:
const documentosFields = createOrderedFields([
  'CURRICULOVITAE',
  'COPIARG',
  'COPIACPF',
  'DIPLOMACERTIFICADO',
  'DOCUMENTOSCONSELHO',
  'EXPERIENCIAPROFISSIONAL',
  'RESERVISTA',      // ← Novo
  'CARTAOSUS'        // ← Novo
]);
```

## Verificação

### Passo a Passo

1. **Na Planilha Google Sheets:**
   - Abra a planilha CANDIDATOS
   - Verifique se as colunas `RESERVISTA` e `CARTAOSUS` existem no cabeçalho
   - Se não existirem, adicione-as manualmente

2. **Teste no Sistema:**
   - Acesse o sistema web
   - Selecione um candidato
   - Verifique se os novos documentos aparecem no DocumentViewer
   - Se houver URLs preenchidas na planilha, os documentos devem ser exibidos

3. **Nenhuma alteração no Google Apps Script é necessária** ✅

## Resumo

✅ **Frontend atualizado** - DocumentViewer e CandidateDetailView
✅ **Types atualizados** - candidate.ts
✅ **Google Apps Script** - NÃO precisa de alteração (leitura automática)
⚠️ **Planilha** - Adicione as colunas RESERVISTA e CARTAOSUS manualmente

## Observações

- Os documentos só aparecerão se tiverem URLs válidas preenchidas
- O sistema valida automaticamente URLs vazias ou inválidas
- Os documentos seguem o mesmo padrão dos demais (podem ter múltiplas URLs separadas)
