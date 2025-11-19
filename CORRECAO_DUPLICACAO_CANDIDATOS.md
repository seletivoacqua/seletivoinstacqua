# Correção: Duplicação de Candidatos na Planilha

## Problema Identificado

Após concluir a triagem de um candidato, o sistema estava exibindo candidatos duplicados na lista.

## Causa Raiz

A análise revelou que:

1. **O Google Apps Script NÃO estava criando duplicados** - A função `saveScreening` corretamente atualiza a linha existente usando `_writeWholeRow_()`
2. **A planilha Google Sheets já continha linhas duplicadas** - Provavelmente duplicadas manualmente
3. **O sistema frontend não estava filtrando duplicados** - A função `getCandidates()` no Google Apps Script simplesmente retorna todas as linhas da planilha

## Solução Implementada

Adicionada uma função utilitária `removeDuplicates()` no arquivo `src/services/candidateService.ts` que:

1. Remove candidatos duplicados baseado no **CPF** (chave única)
2. Mantém o registro **mais recente** quando encontra duplicatas (baseado em `updated_at` ou `created_at`)
3. É aplicada em **todas as funções** que buscam candidatos do Google Sheets

### Funções Corrigidas

- ✅ `getCandidates()` - Lista principal de candidatos
- ✅ `getUnassignedCandidates()` - Candidatos não alocados
- ✅ `getStatistics()` - Estatísticas
- ✅ `getCandidateById()` - Busca por ID
- ✅ `getCandidateByCPF()` - Busca por CPF
- ✅ `updateCandidate()` - Atualização de candidato
- ✅ `getAreas()` - Lista de áreas
- ✅ `getCargos()` - Lista de cargos
- ✅ `getVagaPCDOptions()` - Opções PCD
- ✅ `searchCandidates()` - Busca de candidatos

## Como Funciona

```typescript
// Função utilitária
const removeDuplicates = (candidates: any[]): any[] => {
  return Array.from(
    candidates.reduce((map, candidate) => {
      const cpf = candidate.CPF;
      if (!cpf) return map;

      const existing = map.get(cpf);
      if (!existing) {
        map.set(cpf, candidate);
      } else {
        // Manter o candidato com a data mais recente
        const existingDate = new Date(existing.updated_at || existing.created_at || 0);
        const candidateDate = new Date(candidate.updated_at || candidate.created_at || 0);

        if (candidateDate > existingDate) {
          map.set(cpf, candidate);
        }
      }
      return map;
    }, new Map<string, any>()).values()
  );
};
```

## Resultado

- ✅ **Candidatos não aparecem mais duplicados** na interface
- ✅ **Triagem continua funcionando normalmente**
- ✅ **Dados mais recentes são sempre priorizados**
- ✅ **Performance não foi impactada** (operação é O(n))

## Recomendação

Para evitar duplicação na planilha Google Sheets no futuro:

1. **Validação de dados no Google Sheets**: Configure uma regra de validação na coluna CPF para valores únicos
2. **Limpeza manual**: Identifique e remova linhas duplicadas manualmente na planilha
3. **Monitoramento**: Os logs do console agora mostram quando duplicados são removidos

## Logs de Debug

O sistema agora registra:
- Total de candidatos carregados da planilha
- Total após remoção de duplicados
- CPF de candidatos duplicados que foram substituídos

Exemplo:
```
📦 [CandidateService] Total de candidatos carregados: 150
🧹 [CandidateService] Após remoção de duplicados: 145
🔄 [CandidateService] Substituindo duplicado: 123.456.789-00
```
