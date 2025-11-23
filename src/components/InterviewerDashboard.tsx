import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import type { Candidate } from '../types/candidate';
import InterviewEvaluationForm from './InterviewEvaluationForm';

export default function InterviewerDashboard() {
  const { user, logout } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    loadMyCandidates();
  }, [user]);

  async function loadMyCandidates() {
    try {
      setLoading(true);
      console.log('🔄 Carregando candidatos do entrevistador...');
      
      const { googleSheetsService } = await import('../services/googleSheets');

      const result = await googleSheetsService.getInterviewerCandidates(user?.email || '');

      if (!result.success) {
        console.error('Erro:', result.error);
        return;
      }

      let candidatesData: Candidate[] = [];
      if (Array.isArray(result.data)) {
        candidatesData = result.data;
      } else if (result.data && typeof result.data === 'object') {
        if (Array.isArray((result.data as any).candidates)) {
          candidatesData = (result.data as any).candidates;
        }
      }

      console.log(`✅ ${candidatesData.length} candidatos carregados`);
      setCandidates(candidatesData);
      setFilteredCandidates(candidatesData);
    } catch (error) {
      console.error('Erro ao carregar candidatos:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchName.trim() === '') {
      setFilteredCandidates(candidates);
    } else {
      const searchLower = searchName.toLowerCase();
      const filtered = candidates.filter(c =>
        (c.NOMECOMPLETO?.toLowerCase().includes(searchLower)) ||
        (c.NOMESOCIAL?.toLowerCase().includes(searchLower))
      );
      setFilteredCandidates(filtered);
    }
  }, [searchName, candidates]);

  function handleStartInterview(candidate: Candidate) {
    setSelectedCandidate(candidate);
  }

  function handleCloseEvaluation() {
    setSelectedCandidate(null);
  }

  function handleSaveEvaluation() {
    console.log('✅ Avaliação salva - atualizando status do candidato...');
    
    if (selectedCandidate) {
      // 🔄 ATUALIZAR APENAS O STATUS do candidato avaliado
      setCandidates(prev => 
        prev.map(candidate => 
          candidate.id === selectedCandidate.id 
            ? { 
                ...candidate, 
                interview_completed_at: new Date().toISOString(),
                status_entrevista: 'Avaliado',
                interview_result: 'Classificado' // ou o resultado real da avaliação
              } 
            : candidate
        )
      );
    }
    
    setSelectedCandidate(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando candidatos...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Painel do Entrevistador</h1>
              <p className="text-sm text-gray-600">Entrevistador: {user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Sair
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-800">Total de Candidatos</div>
              <div className="text-2xl font-bold text-blue-800">{candidates.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-800">Avaliados</div>
              <div className="text-2xl font-bold text-green-800">
                {candidates.filter(c => c.interview_completed_at || c.status_entrevista === 'Avaliado').length}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-yellow-800">Pendentes</div>
              <div className="text-2xl font-bold text-yellow-800">
                {candidates.filter(c => !c.interview_completed_at && c.status_entrevista !== 'Avaliado').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum candidato alocado para entrevista</p>
            <button 
              onClick={loadMyCandidates}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4" />
              Recarregar
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="max-w-md flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button 
                onClick={loadMyCandidates}
                className="ml-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4" />
                Atualizar Lista
              </button>
            </div>
            
            {filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg">
                <p className="text-gray-500">Nenhum candidato encontrado</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Nome Completo
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Nome Social
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        CPF
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Cargo Pretendido
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        PCD
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Status Entrevista
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredCandidates.map((candidate) => {
                      const isEvaluated = candidate.interview_completed_at || candidate.status_entrevista === 'Avaliado';
                      
                      return (
                        <tr key={candidate.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                            {candidate.NOMECOMPLETO || 'Não informado'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {candidate.NOMESOCIAL || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                            {candidate.CPF || 'Não informado'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {[candidate.CARGOADMIN, candidate.CARGOASSIS].filter(Boolean).join(' | ') || 'Não informado'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {candidate.VAGAPCD === 'Sim' ? (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                Sim
                              </span>
                            ) : (
                              <span className="text-gray-400">Não</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEvaluated ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                ✅ Avaliado
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                ⏳ Pendente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!isEvaluated ? (
                              <button
                                onClick={() => handleStartInterview(candidate)}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                              >
                                Avaliar
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Concluído</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCandidate && (
        <InterviewEvaluationForm
          candidate={selectedCandidate}
          onClose={handleCloseEvaluation}
          onSave={handleSaveEvaluation}
        />
      )}
    </div>
  );
}
