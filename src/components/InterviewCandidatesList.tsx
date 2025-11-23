import { useState, useEffect } from 'react';
import { Calendar, Loader2, UserPlus } from 'lucide-react';
import type { Candidate } from '../types/candidate';
import { useAuth } from '../contexts/AuthContext';

export default function InterviewCandidatesList() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState('');
  const [searchName, setSearchName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // 🔄 Adicionado para forçar atualização

  useEffect(() => {
    loadInterviewCandidates();
    loadInterviewers();
  }, [refreshKey]); // 🔄 Recarregar quando refreshKey mudar

  async function loadInterviewCandidates() {
    try {
      setLoading(true);
      console.log('🔄 Carregando candidatos para entrevista...');
      
      const { googleSheetsService } = await import('../services/googleSheets');

      const result = await googleSheetsService.getInterviewCandidates();

      if (!result.success) {
        console.error('❌ Erro ao carregar:', result.error);
        alert(`Erro ao carregar candidatos: ${result.error}`);
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
      console.error('❌ Erro ao carregar candidatos para entrevista:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
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

  async function loadInterviewers() {
    try {
      console.log('🔄 Carregando entrevistadores...');
      const { googleSheetsService } = await import('../services/googleSheets');
      const result = await googleSheetsService.getInterviewers();

      if (result.success && Array.isArray(result.data)) {
        console.log(`✅ ${result.data.length} entrevistadores carregados`);
        setInterviewers(result.data);
      } else {
        console.warn('⚠️ Nenhum entrevistador encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar entrevistadores:', error);
    }
  }

  function toggleCandidate(id: string) {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCandidates(newSelected);
  }

  function toggleAll() {
    if (selectedCandidates.size === filteredCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(filteredCandidates.map(c => c.id)));
    }
  }

  async function handleAllocate() {
    if (!selectedInterviewer) {
      alert('Selecione um entrevistador');
      return;
    }

    if (selectedCandidates.size === 0) {
      alert('Selecione pelo menos um candidato');
      return;
    }

    try {
      setAllocating(true);
      console.log(`📤 Alocando ${selectedCandidates.size} candidatos para ${selectedInterviewer}...`);
      
      const { googleSheetsService } = await import('../services/googleSheets');

      // 🔄 Converter IDs para registration numbers
      const candidateIds = Array.from(selectedCandidates)
        .map(id => {
          const candidate = candidates.find(c => c.id === id);
          return candidate?.registration_number || candidate?.CPF || id;
        })
        .filter(Boolean)
        .join(',');

      console.log('📋 Candidatos a alocar:', candidateIds);

      const result = await googleSheetsService.allocateToInterviewer(
        candidateIds,
        selectedInterviewer,
        user?.email || 'admin'
      );

      if (!result.success) {
        throw new Error(result.error || 'Erro ao alocar candidatos');
      }

      console.log('✅ Candidatos alocados com sucesso:', result);
      
      alert(`${selectedCandidates.size} candidato(s) alocado(s) para entrevista com sucesso!`);
      
      // 🔄 CORREÇÃO CRÍTICA: Limpar seleções e forçar recarregamento
      setSelectedCandidates(new Set());
      setSelectedInterviewer('');
      
      // 🔄 Forçar atualização da lista
      setRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Erro ao alocar candidatos:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setAllocating(false);
    }
  }

  // 🔄 Função para recarregar manualmente
  async function handleRefresh() {
    console.log('🔄 Recarregando manualmente...');
    await loadInterviewCandidates();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando candidatos...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-2xl font-bold text-gray-800">Candidatos para Entrevista</h2>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4" />
              Atualizar
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-3">
            {selectedCandidates.size > 0
              ? `${selectedCandidates.size} candidato(s) selecionado(s)`
              : `${filteredCandidates.length} de ${candidates.length} candidato(s) aguardando alocação`}
          </p>
          
          <div className="flex gap-4">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {selectedCandidates.size > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={selectedInterviewer}
              onChange={(e) => setSelectedInterviewer(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-64"
            >
              <option value="">Selecione o entrevistador</option>
              {interviewers.map((interviewer) => (
                <option key={interviewer.email} value={interviewer.email}>
                  {interviewer.name || interviewer.nome || interviewer.email}
                </option>
              ))}
            </select>
            <button
              onClick={handleAllocate}
              disabled={allocating || !selectedInterviewer}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
            >
              {allocating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Alocar ({selectedCandidates.size})
            </button>
          </div>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Calendar className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg mb-2">Nenhum candidato para entrevista</p>
          <p className="text-gray-400 text-sm">Candidatos classificados na triagem aparecerão aqui</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4" />
            Recarregar
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Nome Completo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Nome Social
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Cargo Pretendido
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  CPF
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Telefone
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCandidates.map((candidate) => {
                const email = (candidate as any).EMAIL || (candidate as any).Email || (candidate as any).email;
                const telefone = (candidate as any).TELEFONE || (candidate as any).Telefone || (candidate as any).telefone;

                return (
                  <tr
                    key={candidate.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedCandidates.has(candidate.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                      {candidate.NOMECOMPLETO || 'Não informado'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {candidate.NOMESOCIAL || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {[candidate.CARGOADMIN, candidate.CARGOASSIS].filter(Boolean).join(' | ') || 'Não informado'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {candidate.CPF || 'Não informado'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {email || 'Não informado'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {telefone || 'Não informado'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
