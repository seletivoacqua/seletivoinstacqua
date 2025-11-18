import { useState, useEffect } from 'react';
import { Users, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { candidateService, Candidate } from '../services/candidateService';
import { getAnalysts, assignCandidates } from '../services/userService';
import { User } from '../contexts/AuthContext';

interface AssignmentPanelProps {
  adminId: string;
  onAssignmentComplete: () => void;
}

function AssignmentPanel({ adminId, onAssignmentComplete }: AssignmentPanelProps) {
  const [analysts, setAnalysts] = useState<User[]>([]);
  const [unassignedCandidates, setUnassignedCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('🔄 AssignmentPanel - Iniciando carregamento');
    loadAnalysts();
    loadUnassignedCandidates();
  }, [page]);

  async function loadAnalysts() {
    try {
      setLoadingAnalysts(true);
      setError('');
      console.log('📋 Carregando analistas...');
      
      const data = await getAnalysts();
      console.log('✅ Analistas carregados:', data);
      
      setAnalysts(data);
    } catch (error) {
      console.error('❌ Erro ao carregar analistas:', error);
      setError('Erro ao carregar lista de analistas. Tente novamente.');
      setAnalysts([]);
    } finally {
      setLoadingAnalysts(false);
    }
  }

  async function loadUnassignedCandidates() {
    try {
      setLoading(true);
      console.log('📋 Carregando candidatos não alocados...');
      
      const response = await candidateService.getUnassignedCandidates(page, 50);
      console.log('✅ Candidatos carregados:', response);
      
      setUnassignedCandidates(response.data || []);
      setTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('❌ Erro ao carregar candidatos:', error);
      setError('Erro ao carregar candidatos não alocados.');
      setUnassignedCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      console.log('🎯 Candidato selecionado:', candidateId, 'Total:', newSet.size);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCandidates.size === unassignedCandidates.length) {
      setSelectedCandidates(new Set());
      console.log('🎯 Todos desmarcados');
    } else {
      const allIds = unassignedCandidates.map(c => c.id);
      setSelectedCandidates(new Set(allIds));
      console.log('🎯 Todos selecionados:', allIds.length);
    }
  };

  async function handleAssign() {
    if (!selectedAnalyst || selectedCandidates.size === 0) {
      alert('Selecione um analista e pelo menos um candidato');
      return;
    }

    try {
      setLoading(true);
      console.log('📤 Alocando candidatos:', {
        candidateIds: Array.from(selectedCandidates),
        analystId: selectedAnalyst,
        adminId
      });
      
      await assignCandidates({
        candidateIds: Array.from(selectedCandidates),
        analystId: selectedAnalyst,
        adminId,
      });

      console.log('✅ Candidatos alocados com sucesso');
      
      setSelectedCandidates(new Set());
      setSelectedAnalyst('');
      await loadUnassignedCandidates();
      onAssignmentComplete();
      alert(`${selectedCandidates.size} candidato(s) alocado(s) com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao alocar candidatos:', error);
      alert('Erro ao alocar candidatos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Alocação de Candidatos
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Atribua candidatos para os analistas realizarem a triagem
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={loadAnalysts} 
              disabled={loadingAnalysts} 
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnalysts ? 'animate-spin' : ''}`} />
              Recarregar Analistas
            </button>
            <button 
              onClick={loadUnassignedCandidates} 
              disabled={loading} 
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Recarregar Candidatos
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-800 font-medium">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Candidatos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Candidatos Não Alocados ({unassignedCandidates.length})
              </h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Selecionados: <span className="font-semibold text-blue-600">{selectedCandidates.size}</span>
                </span>
                <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {selectedCandidates.size === unassignedCandidates.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-gray-500 mt-2">Carregando candidatos...</p>
              </div>
            ) : unassignedCandidates.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum candidato não alocado encontrado</p>
                <button 
                  onClick={loadUnassignedCandidates}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedCandidates.has(candidate.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(candidate.id)}
                        onChange={() => handleCandidateSelect(candidate.id)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {candidate.name || 'Nome não informado'}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          CPF: {candidate.registration_number || '—'} • Área: {candidate.AREAATUACAO || 'Não informada'}
                        </div>
                        {(candidate.CARGOADMIN || candidate.CARGOASSIS) && (
                          <div className="text-xs text-gray-500 mt-1">
                            Cargos:
                            {candidate.CARGOADMIN && ` Admin: ${candidate.CARGOADMIN}`}
                            {candidate.CARGOADMIN && candidate.CARGOASSIS && ' | '}
                            {candidate.CARGOASSIS && ` Assis: ${candidate.CARGOASSIS}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center gap-4 mt-6">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1} 
                  className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600 self-center">Página {page} de {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages} 
                  className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* Painel de Alocação */}
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Alocar para Analista</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione o Analista
                  </label>
                  {loadingAnalysts ? (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-sm text-gray-600">Carregando analistas...</span>
                    </div>
                  ) : analysts.length === 0 ? (
                    <div className="text-center py-4">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Nenhum analista disponível</p>
                      <button 
                        onClick={loadAnalysts}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Recarregar
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedAnalyst}
                      onChange={(e) => setSelectedAnalyst(e.target.value)}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Escolha um analista...</option>
                      {analysts.map(analyst => (
                        <option key={analyst.id} value={analyst.id}>
                          {analyst.name} ({analyst.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  onClick={handleAssign}
                  disabled={!selectedAnalyst || selectedCandidates.size === 0 || loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Alocando...
                    </>
                  ) : (
                    <>
                      Alocar {selectedCandidates.size} Candidato(s) 
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Informações do Sistema */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Informações do Sistema</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Analistas carregados:</span>
                  <span className="font-semibold">{analysts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Candidatos carregados:</span>
                  <span className="font-semibold">{unassignedCandidates.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Página atual:</span>
                  <span className="font-semibold">{page} de {totalPages}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignmentPanel;
