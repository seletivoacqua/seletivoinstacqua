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
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set()); // Agora guarda CPFs
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalysts();
    loadUnassignedCandidates();
  }, [page]);

  async function loadAnalysts() {
    try {
      setLoadingAnalysts(true);
      setError('');
      const data = await getAnalysts();
      setAnalysts(data);
    } catch (error) {
      setError('Erro ao carregar analistas.');
    } finally {
      setLoadingAnalysts(false);
    }
  }

  async function loadUnassignedCandidates() {
    try {
      setLoading(true);
      const response = await candidateService.getUnassignedCandidates(page, 50);
      setUnassignedCandidates(response.data);
      setTotalPages(response.totalPages);
    } catch (error) {
      setError('Erro ao carregar candidatos não alocados.');
    } finally {
      setLoading(false);
    }
  }

  const toggleCandidate = (cpf: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(cpf)) next.delete(cpf);
      else next.add(cpf);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCandidates.size === unassignedCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      const allCpfs = unassignedCandidates.map(c => c.CPF).filter(Boolean);
      setSelectedCandidates(new Set(allCpfs));
    }
  };

  async function handleAssign() {
    if (!selectedAnalyst || selectedCandidates.size === 0) {
      alert('Selecione um analista e pelo menos um candidato');
      return;
    }

    try {
      setLoading(true);
      await assignCandidates({
        candidateIds: Array.from(selectedCandidates), // CPFs
        analystId: selectedAnalyst,
        adminId,
      });

      setSelectedCandidates(new Set());
      setSelectedAnalyst('');
      await loadUnassignedCandidates();
      onAssignmentComplete();
      alert('Candidatos alocados com sucesso!');
    } catch (error) {
      alert('Erro ao alocar candidatos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Cabeçalho */}
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
          <button onClick={loadAnalysts} disabled={loadingAnalysts}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loadingAnalysts ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
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
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Candidatos Não Alocados ({unassignedCandidates.length})
              </h3>
              <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                {selectedCandidates.size === unassignedCandidates.length && unassignedCandidates.length > 0
                  ? 'Desmarcar Todos' 
                  : 'Selecionar Todos'}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : unassignedCandidates.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Nenhum candidato não alocado encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedCandidates.map(candidate => {
                  const cpf = candidate.CPF || candidate.registration_number;

                  return (
                    <div
                      key={cpf}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedCandidates.has(cpf)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={() => toggleCandidate(cpf)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.has(cpf)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCandidate(cpf);
                          }}
                          className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">
                            {candidate.NOMECOMPLETO || candidate.name || 'Nome não informado'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            CPF: {cpf} • Área: {candidate.AREAATUACAO || 'Não informada'}
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
                  );
                })}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-4 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 border rounded disabled:opacity-50">
                  Anterior
                </button>
                <span className="text-sm text-gray-600 self-center">Página {page} de {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-50">
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* Painel lateral */}
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Alocar para Analista</h3>
              <div className="space-y-4">
                <select
                  value={selectedAnalyst}
                  onChange={(e) => setSelectedAnalyst(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={loadingAnalysts || analysts.length === 0}
                >
                  <option value="">
                    {analysts.length === 0 ? 'Nenhum analista disponível' : 'Escolha um analista...'}
                  </option>
                  {analysts.map(analyst => (
                    <option key={analyst.id} value={analyst.id}>
                      {analyst.name} ({analyst.role})
                    </option>
                  ))}
                </select>

                <div className="text-sm text-gray-600">
                  Selecionados: <span className="font-bold text-blue-600">{selectedCandidates.size}</span>
                </div>

                <button
                  onClick={handleAssign}
                  disabled={!selectedAnalyst || selectedCandidates.size === 0 || loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>Alocando...</>
                  ) : (
                    <>Alocar {selectedCandidates.size} Candidato(s) <ChevronRight className="w-5 h-5" /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignmentPanel;
