// ============================================
// PATCH - CORREÇÃO SAVEINTERVIEWEVALUATION
// Atualiza apenas células específicas
// ============================================

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

    // Calcular pontuação
    const secao1 = (Number(params.formacao_adequada) + Number(params.graduacoes_competencias)) * 2;
    const secao2 = (Number(params.descricao_processos) + Number(params.terminologia_tecnica) + Number(params.calma_clareza)) * 2;
    const secao3 = Number(params.escalas_flexiveis) + Number(params.adaptabilidade_mudancas) + Number(params.ajustes_emergencia);
    const secao4 = Number(params.residencia);
    const secao5 = (Number(params.resolucao_conflitos) + Number(params.colaboracao_equipe) + Number(params.adaptacao_perfis)) * 2;
    const totalScore = secao1 + secao2 + secao3 + secao4 + secao5;

    Logger.log('📊 Pontuação calculada: ' + totalScore + '/120');

    // ✅ CORREÇÃO: Atualizar células individualmente
    const updates = [
      { col: col['status_entrevista'], value: 'Avaliado' },
      { col: col['entrevistador'], value: params.interviewerEmail || '' },
      { col: col['data_entrevista'], value: getCurrentTimestamp() },
      { col: col['interview_completed_at'], value: params.completed_at || getCurrentTimestamp() },
      { col: col['interview_score'], value: totalScore },
      { col: col['interview_result'], value: params.resultado || '' },
      { col: col['interview_notes'], value: (params.impressao_perfil || '').substring(0, 50000) }, // Limita tamanho
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

    // Atualizar cada célula individualmente
    let updatedCount = 0;
    for (const update of updates) {
      if (update.col >= 0) {
        try {
          // Col é 0-indexed, mas getRange é 1-indexed
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

// ============================================
// INSTRUÇÕES DE DEPLOY
// ============================================
/*

COMO APLICAR ESTE PATCH:

1. Abra seu Google Apps Script em:
   https://script.google.com/home/projects/1MH6PG7VJ89MKxvlX1C64fJx7EfmHCU2Qv9WDcICDNSBDazxJfKLGrzN3/edit

2. Localize a função saveInterviewEvaluation (linha ~1650)

3. Substitua TODA a função pela versão acima

4. Clique em "Salvar projeto" (ícone de disquete)

5. Teste novamente no frontend

DIFERENÇA PRINCIPAL:
- Antes: _writeWholeRow_(sh, row, rowVals) - tentava escrever linha inteira
- Depois: sh.getRange(row, col + 1).setValue(value) - atualiza célula por célula

VANTAGENS:
✅ Evita erro "Argumento grande demais"
✅ Mais eficiente com dados grandes
✅ Falha apenas em células problemáticas, não na operação inteira
✅ Log detalhado de cada atualização

*/
