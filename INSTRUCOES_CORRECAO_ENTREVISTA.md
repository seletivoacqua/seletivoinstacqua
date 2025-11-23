# Correção Rápida - Erro ao Salvar Entrevista

## ❌ Erro

```
Erro ao salvar avaliação: Error: Argumento grande demais: value
```

## ✅ Solução em 4 Passos

### 1. Abrir Google Apps Script
https://script.google.com/home/projects/1MH6PG7VJ89MKxvlX1C64fJx7EfmHCU2Qv9WDcICDNSBDazxJfKLGrzN3/edit

### 2. Localizar função
- `Ctrl+F` → `function saveInterviewEvaluation`
- Linha ~1650

### 3. Substituir por este código

```javascript
function saveInterviewEvaluation(params) {
  try {
    const sh = _sheet(SHEET_CANDIDATOS);
    const headers = _getHeaders_(sh);
    const col = _colMap_(headers);

    const idx = _getIndex_(sh, headers);
    const searchKey = String(params.candidateId).trim();
    let row = idx[searchKey];

    if (!row) {
      const newIdx = _buildIndex_(sh, headers);
      const rev = _getRev_();
      CacheService.getDocumentCache().put(`${IDX_CACHE_KEY}${rev}`, JSON.stringify(newIdx), CACHE_TTL_SEC);
      row = newIdx[searchKey];
    }

    if (!row) {
      Logger.log('❌ Candidato não encontrado: ' + searchKey);
      throw new Error('Candidato não encontrado: ' + searchKey);
    }

    Logger.log('📝 Salvando avaliação do candidato na linha: ' + row);

    const secao1 = (Number(params.formacao_adequada) + Number(params.graduacoes_competencias)) * 2;
    const secao2 = (Number(params.descricao_processos) + Number(params.terminologia_tecnica) + Number(params.calma_clareza)) * 2;
    const secao3 = Number(params.escalas_flexiveis) + Number(params.adaptabilidade_mudancas) + Number(params.ajustes_emergencia);
    const secao4 = Number(params.residencia);
    const secao5 = (Number(params.resolucao_conflitos) + Number(params.colaboracao_equipe) + Number(params.adaptacao_perfis)) * 2;
    const totalScore = secao1 + secao2 + secao3 + secao4 + secao5;

    Logger.log('📊 Pontuação calculada: ' + totalScore + '/120');

    const updates = [
      { col: col['status_entrevista'], value: 'Avaliado' },
      { col: col['entrevistador'], value: params.interviewerEmail || '' },
      { col: col['data_entrevista'], value: getCurrentTimestamp() },
      { col: col['interview_completed_at'], value: params.completed_at || getCurrentTimestamp() },
      { col: col['interview_score'], value: totalScore },
      { col: col['interview_result'], value: params.resultado || '' },
      { col: col['interview_notes'], value: (params.impressao_perfil || '').substring(0, 50000) },
      { col: col['formacao_adequada'], value: params.formacao_adequada || '' },
      { col: col['graduacoes_competencias'], value: params.graduacoes_competencias || '' },
      { col: col['descricao_processos'], value: params.descricao_processos || '' },
      { col: col['terminologia_tecnica'], value: params.terminologia_tecnica || '' },
      { col: col['calma_clareza'], value: params.calma_clareza || '' },
      { col: col['escalas_flexiveis'], value: params.escalas_flexiveis || '' },
      { col: col['adaptabilidade_mudancas'], value: params.adaptabilidade_mudancas || '' },
      { col: col['ajustes_emergencia'], value: params.ajustes_emergencia || '' },
      { col: col['residencia'], value: params.residencia || '' },
      { col: col['resolucao_conflitos'], value: params.resolucao_conflitos || '' },
      { col: col['colaboracao_equipe'], value: params.colaboracao_equipe || '' },
      { col: col['adaptacao_perfis'], value: params.adaptacao_perfis || '' }
    ];

    let updatedCount = 0;
    for (const update of updates) {
      if (update.col >= 0) {
        try {
          sh.getRange(row, update.col + 1).setValue(update.value);
          updatedCount++;
        } catch (cellError) {
          Logger.log('⚠️ Erro ao atualizar coluna ' + update.col + ': ' + cellError.toString());
        }
      }
    }

    Logger.log('✅ ' + updatedCount + ' células atualizadas com sucesso');

    _bumpRev_();

    Logger.log('✅ Avaliação de entrevista salva com sucesso');
    Logger.log('   - Candidato: ' + searchKey);
    Logger.log('   - Pontuação: ' + totalScore + '/120');
    Logger.log('   - Resultado: ' + params.resultado);

    return {
      success: true,
      message: 'Avaliação salva com sucesso',
      score: totalScore,
      resultado: params.resultado
    };
  } catch (error) {
    Logger.log('❌ Erro em saveInterviewEvaluation: ' + error.toString());
    Logger.log('   Stack: ' + error.stack);
    throw error;
  }
}
```

### 4. Salvar
- `Ctrl+S` ou ícone de disquete
- Testar salvando avaliação no frontend

---

## 📄 Documentação Completa

Para detalhes técnicos, veja: `CORRECAO_ERRO_ARGUMENTO_GRANDE.md`

Para o código completo, veja: `google-apps-script-PATCH-ENTREVISTA-CELULAS.js`
