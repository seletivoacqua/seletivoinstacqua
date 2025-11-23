import { useState } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import type { Candidate, InterviewEvaluation } from '../types/candidate';
import { useAuth } from '../contexts/AuthContext';

interface InterviewEvaluationFormProps {
  candidate: Candidate;
  onClose: () => void;
  onSave: () => void;
}

export default function InterviewEvaluationForm({
  candidate,
  onClose,
  onSave
}: InterviewEvaluationFormProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [formacao_adequada, setFormacaoAdequada] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [graduacoes_competencias, setGraduacoesCompetencias] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [descricao_processos, setDescricaoProcessos] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [terminologia_tecnica, setTerminologiaTecnica] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [calma_clareza, setCalmaClareza] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [escalas_flexiveis, setEscalasFlexiveis] = useState<0 | 5 | 10>(5);
  const [adaptabilidade_mudancas, setAdaptabilidadeMudancas] = useState<0 | 5 | 10>(5);
  const [ajustes_emergencia, setAjustesEmergencia] = useState<0 | 5 | 10>(5);

  const [residencia, setResidencia] = useState<2 | 4 | 6 | 8 | 10>(6);

  const [resolucao_conflitos, setResolucaoConflitos] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [colaboracao_equipe, setColaboracaoEquipe] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [adaptacao_perfis, setAdaptacaoPerfis] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [impressao_perfil, setImpressaoPerfil] = useState('');
  const [resultado, setResultado] = useState<'Classificado' | 'Desclassificado'>('Classificado');

  const calculateTotal = () => {
  // 1. Relação entre Formação e Experiências (Máximo 10 pontos)
  // 2 questões que somadas dão máximo 10 pontos
  const secao1 = formacao_adequada + graduacoes_competencias;

  // 2. Desenvoltura de Comunicação (Máximo 15 pontos)  
  // 3 questões que somadas dão máximo 15 pontos
  const secao2 = descricao_processos + terminologia_tecnica + calma_clareza;

  // 3. Disponibilidade e Flexibilidade (Máximo 30 pontos)
  const secao3 = escalas_flexiveis + adaptabilidade_mudancas + ajustes_emergencia;

  // 4. Residir em Imperatriz - MA (Máximo 10 pontos)
  const secao4 = residencia;

  // 5. Relacionamento Interpessoal/Trabalho em Equipe (Máximo 15 pontos)
  const secao5 = resolucao_conflitos + colaboracao_equipe + adaptacao_perfis;

  const total = secao1 + secao2 + secao3 + secao4 + secao5;

  return { secao1, secao2, secao3, secao4, secao5, total };
};

  const scores = calculateTotal();

  async function handleSubmit() {
  if (!impressao_perfil.trim()) {
    alert('Por favor, preencha a impressão sobre o perfil');
    return;
  }

  try {
    setSaving(true);
    const { googleSheetsService } = await import('../services/googleSheets');

    const evaluation: any = {
      // Identificação do candidato
      registrationNumber: candidate.registration_number || candidate.CPF || candidate.id,
      candidateId: candidate.CPF || candidate.registration_number || candidate.id,
      
      // Dados da avaliação (COMPATÍVEIS COM AS COLUNAS DA PLANILHA)
      status_entrevista: 'Avaliado', // ✅ NOVO - Coluna obrigatória
      data_entrevista: new Date().toISOString(), // ✅ NOVO - Coluna obrigatória
      totalSocre: scores.total, // ✅ CORRIGIDO - Note o typo "totalSocre" (mantido como está na planilha)
      entrevistador: user?.email || '', // ✅ NOVO - Coluna obrigatória
      
      // Campos de avaliação específicos
      formacao_adequada,
      graduacoes_competencias,
      descricao_processos,
      terminologia_tecnica,
      calma_clareza,
      escalas_flexiveis,
      adaptabilidade_mudancas,
      ajustes_emergencia,
      residencia,
      resolucao_conflitos,
      colaboracao_equipe,
      adaptacao_perfis,
      
      // Campos de resultado
      interview_result: resultado,
      resultado: resultado, // Envia ambos para compatibilidade
      interview_score: scores.total, // Mantém também o nome correto
      interview_notes: impressao_perfil,
      impressao_perfil: impressao_perfil, // Envia ambos para compatibilidade
      
      // Metadados
      interviewerEmail: user?.email || '',
      completed_at: new Date().toISOString(),
      entrevistador_at: new Date().toISOString(), // ✅ NOVO
      entrevistador_by: user?.email || '' // ✅ NOVO
    };

    console.log('📤 Enviando avaliação:', evaluation); // Para debug

    const result = await googleSheetsService.saveInterviewEvaluation(evaluation);

    if (!result.success) {
      throw new Error(result.error || 'Erro ao salvar avaliação');
    }

    alert('Avaliação salva com sucesso!');
    onSave();
    onClose();
  } catch (error) {
    console.error('Erro ao salvar avaliação:', error);
    alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  } finally {
    setSaving(false);
  }
}

 return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Avaliação de Entrevista</h2>
            <p className="text-sm text-gray-600 mt-1">
              {candidate.NOMECOMPLETO} - {[candidate.CARGOADMIN, candidate.CARGOASSIS].filter(Boolean).join(' | ') || 'Não informado'}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              {(candidate.ACQUA || candidate.ACQUA) && (
                <span>
                  <span className="font-medium">ACQUA:</span> {candidate.ACQUA || candidate.acqua}
                </span>
              )}
              {(candidate.UNIDADE || candidate.unidade) && (
                <span>
                  <span className="font-medium">Unidade:</span> {candidate.UNIDADE || candidate.unidade}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Nome Completo:</span> {candidate.NOMECOMPLETO}
              </div>
              <div>
                <span className="font-medium">Nome Social:</span> {candidate.NOMESOCIAL || '-'}
              </div>
              <div>
                <span className="font-medium">CPF:</span> {candidate.CPF}
              </div>
              <div>
                <span className="font-medium">Cargos:</span> {[candidate.CARGOADMIN, candidate.CARGOASSIS].filter(Boolean).join(' | ') || 'Não informado'}
              </div>
              <div>
                <span className="font-medium">PCD:</span> {candidate.VAGAPCD === 'Sim' ? 'Sim' : 'Não'}
              </div>
              <div>
                <span className="font-medium">Trabalhou no Inst. Acqua? </span> {candidate.ACQUA}
              </div>
              <div>
                <span className="font-medium">Unidade:</span> {candidate.UNIDADE}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="font-bold text-lg text-gray-800 mb-3">
                1. Relação entre Formação e Experiências (Máximo 10 pontos) - Total: {scores.secao1}/10
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formação adequada para o cargo
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="formacao_adequada"
                          value={val}
                          checked={formacao_adequada === val}
                          onChange={() => setFormacaoAdequada(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Graduações e Competências Técnicas
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="graduacoes"
                          value={val}
                          checked={graduacoes_competencias === val}
                          onChange={() => setGraduacoesCompetencias(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-bold text-lg text-gray-800 mb-3">
                2. Desenvoltura de Comunicação (Máximo 15 pontos) - Total: {scores.secao2}/15
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facilidade em descrever processos complexos
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="descricao"
                          value={val}
                          checked={descricao_processos === val}
                          onChange={() => setDescricaoProcessos(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Utilização de terminologia técnica apropriada
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="terminologia"
                          value={val}
                          checked={terminologia_tecnica === val}
                          onChange={() => setTerminologiaTecnica(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manutenção da calma e clareza sob stress
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="calma"
                          value={val}
                          checked={calma_clareza === val}
                          onChange={() => setCalmaClareza(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-bold text-lg text-gray-800 mb-3">
                3. Disponibilidade e Flexibilidade (Máximo 30 pontos) - Total: {scores.secao3}/30
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experiência anterior com escalas flexíveis
                  </label>
                  <div className="flex gap-4">
                    {[0, 5, 10].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="escalas"
                          value={val}
                          checked={escalas_flexiveis === val}
                          onChange={() => setEscalasFlexiveis(val as 0 | 5 | 10)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adaptabilidade a mudanças súbitas
                  </label>
                  <div className="flex gap-4">
                    {[0, 5, 10].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="adaptabilidade"
                          value={val}
                          checked={adaptabilidade_mudancas === val}
                          onChange={() => setAdaptabilidadeMudancas(val as 0 | 5 | 10)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experiências com ajustes de agenda de emergência
                  </label>
                  <div className="flex gap-4">
                    {[0, 5, 10].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ajustes"
                          value={val}
                          checked={ajustes_emergencia === val}
                          onChange={() => setAjustesEmergencia(val as 0 | 5 | 10)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-bold text-lg text-gray-800 mb-3">
                4. Residir em Imperatriz - MA (Máximo 10 pontos) - Total: {scores.secao4}/10
              </h3>
              <div className="space-y-2">
                {[
                  { value: 2, label: 'Não reside e não tem disponibilidade para mudança' },
                  { value: 4, label: 'Não reside, mas tem disponibilidade para mudança a médio prazo' },
                  { value: 6, label: 'Não reside, mas tem disponibilidade para mudança imediata' },
                  { value: 8, label: 'Reside próximo e não requer mudança' },
                  { value: 10, label: 'Reside em Imperatriz' }
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="residencia"
                      value={option.value}
                      checked={residencia === option.value}
                      onChange={() => setResidencia(option.value as 2 | 4 | 6 | 8 | 10)}
                      className="text-blue-600 mt-1"
                    />
                    <span className="text-sm">({option.value} pontos) {option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-bold text-lg text-gray-800 mb-3">
                5. Relacionamento Interpessoal/Trabalho em Equipe (Máximo 15 pontos) - Total: {scores.secao5}/15
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolução de conflitos com colegas e pacientes
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="resolucao"
                          value={val}
                          checked={resolucao_conflitos === val}
                          onChange={() => setResolucaoConflitos(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Atitudes que promovem colaboração e bem-estar
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="colaboracao"
                          value={val}
                          checked={colaboracao_equipe === val}
                          onChange={() => setColaboracaoEquipe(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacidade de adaptação a diferentes perfis
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="adaptacao"
                          value={val}
                          checked={adaptacao_perfis === val}
                          onChange={() => setAdaptacaoPerfis(val as 1 | 2 | 3 | 4 | 5)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                6. Coloque sua impressão sobre o perfil
              </label>
              <textarea
                value={impressao_perfil}
                onChange={(e) => setImpressaoPerfil(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Descreva sua impressão geral sobre o candidato..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                7. Avaliação
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resultado"
                    value="Classificado"
                    checked={resultado === 'Classificado'}
                    onChange={() => setResultado('Classificado')}
                    className="text-green-600"
                  />
                  <span className="text-sm font-medium text-green-700">Classificado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resultado"
                    value="Desclassificado"
                    checked={resultado === 'Desclassificado'}
                    onChange={() => setResultado('Desclassificado')}
                    className="text-red-600"
                  />
                  <span className="text-sm font-medium text-red-700">Desclassificado</span>
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-lg text-blue-900 mb-2">Pontuação Total: {scores.total}/80</h4>
              <div className="grid grid-cols-5 gap-2 text-sm text-blue-800">
                <div>Formação: {scores.secao1}/10</div>
                <div>Comunicação: {scores.secao2}/15</div>
                <div>Disponibilidade: {scores.secao3}/30</div>
                <div>Residência: {scores.secao4}/10</div>
                <div>Relacionamento: {scores.secao5}/15</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !impressao_perfil.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Avaliação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
