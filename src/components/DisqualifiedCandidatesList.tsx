import { useState, useEffect } from 'react';
import { XCircle, Loader2 } from 'lucide-react';

interface Candidate {
  id: string;
  registration_number?: string;
  NOMECOMPLETO?: string;
  full_name?: string;
  nome_completo?: string;
  nome_social?: string;
  CPF?: string;
  cpf?: string;
  cpf_numero?: string;
  email?: string;
  telefone?: string;
  AREAATUACAO?: string;
  desired_area?: string;
  area_atuacao_pretendida?: string;
  CARGOPRETENDIDO?: string;
  cargo_administrativo?: string | boolean;
  cargo_assistencial?: string | boolean;
  status?: string;
  status_triagem?: string;
  screening_notes?: string;
  observacoes_triagem?: string;
  screened_at?: string;
  data_hora_triagem?: string;
  assigned_at?: string; // NOVA COLUNA
  assigned_to?: string; // NOVA COLUNA
  disqualification_reason?: {
    reason: string;
  };
  motivo_desclassificacao?: string;
  analista_triagem?: string;
}

export default function DisqualifiedCandidatesList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    loadDisqualifiedCandidates();
  }, []);

  async function loadDisqualifiedCandidates() {
    try {
      setLoading(true);
      console.log('🔍 Buscando candidatos desclassificados...');
      
      const { googleSheetsService } = await import('../services/googleSheets');
      
      // CORREÇÃO: Usar 'desclassificada' (minúsculo) em vez de 'Desclassificado'
      const result = await googleSheetsService.getCandidatesByStatus('desclassificada');

      console.log('📊 Resultado da busca:', result);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar candidatos');
      }

      setCandidates(result.data || []);
      console.log('✅ Candidatos desclassificados carregados:', result.data?.length || 0);
      
    } catch (error) {
      console.error('❌ Erro ao carregar candidatos desclassificados:', error);
    } finally {
      setLoading(false);
    }
  }

  function getCargo(candidate: Candidate) {
    return candidate.CARGOPRETENDIDO || 
           candidate.cargo_administrativo || 
           candidate.cargo_assistencial || 
           'Não informado';
  }

  function getMotivoDesclassificacao(candidate: Candidate) {
    // Tenta diferentes campos onde o motivo pode estar armazenado
    return candidate.disqualification_reason?.reason || 
           candidate.motivo_desclassificacao || 
           'Motivo não informado';
  }

  function getDataTriagem(candidate: Candidate) {
    // PRIORIDADE: assigned_at > data_hora_triagem > screened_at
    return candidate.assigned_at || 
           candidate.data_hora_triagem || 
           candidate.screened_at || 
           null;
  }

  function getAnalistaTriagem(candidate: Candidate) {
    // PRIORIDADE: assigned_to > analista_triagem
    return candidate.assigned_to || 
           candidate.analista_triagem || 
           'Analista não informado';
  }

  function getObservacoes(candidate: Candidate) {
    return candidate.observacoes_triagem || 
           candidate.screening_notes || 
           null;
  }

  function getNomeCompleto(candidate: Candidate) {
    return candidate.NOMECOMPLETO || 
           candidate.nome_completo || 
           candidate.full_name || 
           'Nome não informado';
  }

  function getAreaAtuacao(candidate: Candidate) {
    return candidate.AREAATUACAO || 
           candidate.area_atuacao_pretendida || 
           candidate.desired_area || 
           'Área não informada';
  }

  // Função para formatar a data de forma mais legível
  function formatarData(dataString: string | null) {
    if (!dataString) return '-';
    
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataString; // Retorna o original se houver erro
    }
  }

  // Função para formatar apenas a data (sem hora)
  function formatarDataCurta(dataString: string | null) {
    if (!dataString) return '-';
    
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataString;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando candidatos desclassificados...</span>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <XCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg mb-2">Nenhum candidato desclassificado</p>
        <p className="text-gray-400 text-sm">
          Os candidatos aparecerão aqui quando forem desclassificados pelos analistas
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Candidatos Desclassificados</h2>
        <p className="text-sm text-gray-600 mt-1">
          {candidates.length} candidato(s) desclassificado(s)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Nome Completo
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                CPF
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Área
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Cargo Pretendido
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Motivo
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Data da Triagem
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Analista
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {candidates.map((candidate) => (
              <tr key={candidate.registration_number || candidate.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                  {getNomeCompleto(candidate)}
                  {candidate.nome_social && (
                    <div className="text-xs text-gray-500">
                      ({candidate.nome_social})
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  {candidate.CPF || candidate.cpf || candidate.cpf_numero || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {getAreaAtuacao(candidate)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {getCargo(candidate)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                  <div className="truncate" title={getMotivoDesclassificacao(candidate)}>
                    {getMotivoDesclassificacao(candidate)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatarDataCurta(getDataTriagem(candidate))}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {getAnalistaTriagem(candidate)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedCandidate(candidate)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Ver detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">Detalhes da Desclassificação</h3>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Pessoais */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Nome Completo</p>
                  <p className="text-lg text-gray-800 mt-1">
                    {getNomeCompleto(selectedCandidate)}
                  </p>
                </div>

                {selectedCandidate.nome_social && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Nome Social</p>
                    <p className="text-lg text-gray-800 mt-1">
                      {selectedCandidate.nome_social}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 font-medium">CPF</p>
                  <p className="text-lg font-mono text-gray-800 mt-1">
                    {selectedCandidate.CPF || selectedCandidate.cpf || selectedCandidate.cpf_numero || 'Não informado'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 font-medium">Número de Inscrição</p>
                  <p className="text-lg font-mono text-gray-800 mt-1">
                    {selectedCandidate.registration_number || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Informações da Vaga */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Área de Atuação</p>
                  <p className="text-lg text-gray-800 mt-1">
                    {getAreaAtuacao(selectedCandidate)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 font-medium">Cargo Pretendido</p>
                  <p className="text-lg text-gray-800 mt-1">
                    {getCargo(selectedCandidate)}
                  </p>
                </div>
              </div>

              {/* Motivo da Desclassificação */}
              <div className="border-t pt-6">
                <p className="text-sm text-gray-600 font-medium">Motivo da Desclassificação</p>
                <p className="text-lg text-red-600 font-semibold mt-2 p-3 bg-red-50 rounded-lg">
                  {getMotivoDesclassificacao(selectedCandidate)}
                </p>
              </div>

              {/* Observações */}
              {getObservacoes(selectedCandidate) && (
                <div>
                  <p className="text-sm text-gray-600 font-medium">Observações do Analista</p>
                  <p className="text-gray-800 mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-wrap">
                    {getObservacoes(selectedCandidate)}
                  </p>
                </div>
              )}

              {/* Metadados da Triagem */}
              <div className="grid grid-cols-2 gap-6 border-t pt-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Data da Triagem</p>
                  <p className="text-gray-800 mt-1 font-medium">
                    {formatarData(getDataTriagem(selectedCandidate))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCandidate.assigned_at && '(assigned_at)'}
                    {!selectedCandidate.assigned_at && selectedCandidate.data_hora_triagem && '(data_hora_triagem)'}
                    {!selectedCandidate.assigned_at && !selectedCandidate.data_hora_triagem && selectedCandidate.screened_at && '(screened_at)'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 font-medium">Analista Responsável</p>
                  <p className="text-gray-800 mt-1 font-medium">
                    {getAnalistaTriagem(selectedCandidate)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCandidate.assigned_to && '(assigned_to)'}
                    {!selectedCandidate.assigned_to && selectedCandidate.analista_triagem && '(analista_triagem)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
