import { useState, useEffect, useMemo } from 'react';
import { X, FileText, Users, Filter, Search, Download, Loader2, ClipboardCheck, UserX } from 'lucide-react';
import { getAnalysts, getInterviewers } from '../services/userService';
import { User as UserType } from '../contexts/AuthContext';
import type { Candidate } from '../types/candidate';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateClassifiedReport: (filterType: string, filterValue: string) => void;
  onGenerateDisqualifiedReport: (filterType: string, filterValue: string) => void;
  onGenerateGeneralReport: (filterType: string, filterValue: string) => void;
}

interface Filters {
  statusTriagem: 'todos' | 'classificado' | 'desclassificado';
  statusEntrevista: 'todos' | 'classificados' | 'desclassificados';
  analista: string;
  entrevistador: string;
  pcd: 'todos' | 'sim' | 'nao';
}

export default function ReportModal({
  isOpen,
  onClose,
  onGenerateClassifiedReport,
  onGenerateDisqualifiedReport,
  onGenerateGeneralReport
}: ReportModalProps) {
  const [analysts, setAnalysts] = useState<UserType[]>([]);
  const [interviewers, setInterviewers] = useState<UserType[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<Filters>({
    statusTriagem: 'todos',
    statusEntrevista: 'todos',
    analista: 'todos',
    entrevistador: 'todos',
    pcd: 'todos'
  });
  const [stats, setStats] = useState({
    total: 0,
    classificadosTriagem: 0,
    desclassificadosTriagem: 0,
    classificadosEntrevista: 0,
    desclassificadosEntrevista: 0,
    pcd: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [analystsData, interviewersData] = await Promise.all([
        getAnalysts(),
        getInterviewers()
      ]);
      setAnalysts(analystsData);
      setInterviewers(interviewersData);

      await loadAllCandidates();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  async function loadAllCandidates() {
    try {
      console.log('📋 Carregando todos os candidatos...');

      const { googleSheetsService } = await import('../services/googleSheets');

      const result = await googleSheetsService.getCandidates();

      console.log('📦 Resultado candidatos:', result);

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setAllCandidates(data);
        console.log('✅ Candidatos carregados:', data.length);
        calculateStats(data);
      } else {
        console.error('❌ Falha ao carregar candidatos:', result);
        setAllCandidates([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar candidatos:', error);
      setAllCandidates([]);
    }
  }

  function calculateStats(candidates: Candidate[]) {
    const stats = {
      total: candidates.length,
      classificadosTriagem: 0,
      desclassificadosTriagem: 0,
      classificadosEntrevista: 0,
      desclassificadosEntrevista: 0,
      pcd: 0
    };

    candidates.forEach(candidate => {
      const statusTriagem = (candidate.status_triagem || candidate.statusTriagem || candidate.status || '').toLowerCase();
      const statusEntrevista = (candidate.status_entrevista || candidate.interview_status || '').toLowerCase();
      const isPcd = getCandidateField(candidate, 'VAGAPCD', 'vaga_pcd').toLowerCase() === 'sim';

      if (statusTriagem === 'classificado') {
        stats.classificadosTriagem++;
      } else if (statusTriagem === 'desclassificado') {
        stats.desclassificadosTriagem++;
      }

      if (statusEntrevista === 'aprovado' || statusEntrevista === 'classificado') {
        stats.classificadosEntrevista++;
      } else if (statusEntrevista === 'reprovado' || statusEntrevista === 'desclassificado') {
        stats.desclassificadosEntrevista++;
      }

      if (isPcd) {
        stats.pcd++;
      }
    });

    setStats(stats);
  }

  function getCandidateField(candidate: Candidate, ...fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      const value = (candidate as any)[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  }

  const filteredCandidates = useMemo(() => {
    let result = [...allCandidates];

    if (filters.statusTriagem !== 'todos') {
      result = result.filter(candidate => {
        const status = (candidate.status_triagem || candidate.statusTriagem || candidate.status || '').toLowerCase();
        return status === filters.statusTriagem;
      });
    }

    if (filters.statusEntrevista !== 'todos') {
      result = result.filter(candidate => {
        const status = (candidate.status_entrevista || candidate.interview_status || '').toLowerCase();
        if (filters.statusEntrevista === 'classificados') {
          return status === 'aprovado' || status === 'classificado';
        } else if (filters.statusEntrevista === 'desclassificados') {
          return status === 'reprovado' || status === 'desclassificado';
        }
        return false;
      });
    }

    if (filters.analista !== 'todos') {
      result = result.filter(candidate => {
        const analistaEmail = getCandidateField(candidate, 'assigned_to', 'Analista', 'analista_triagem');
        const analyst = analysts.find(a => a.id === filters.analista);
        return analistaEmail === analyst?.email || analistaEmail === filters.analista;
      });
    }

    if (filters.entrevistador !== 'todos') {
      result = result.filter(candidate => {
        const entrevistadorEmail = getCandidateField(candidate, 'entrevistador', 'Entrevistador', 'interviewer');
        const interviewer = interviewers.find(i => i.id === filters.entrevistador);
        return entrevistadorEmail === interviewer?.email || entrevistadorEmail === filters.entrevistador;
      });
    }

    if (filters.pcd !== 'todos') {
      result = result.filter(candidate => {
        const isPcd = getCandidateField(candidate, 'VAGAPCD', 'vaga_pcd').toLowerCase() === 'sim';
        return filters.pcd === 'sim' ? isPcd : !isPcd;
      });
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter(candidate => {
        const nomeCompleto = getCandidateField(candidate, 'NOMECOMPLETO', 'nome_completo', 'full_name').toLowerCase();
        const nomeSocial = getCandidateField(candidate, 'NOMESOCIAL', 'nome_social').toLowerCase();
        const cpf = getCandidateField(candidate, 'CPF', 'cpf').toLowerCase();
        return nomeCompleto.includes(searchLower) ||
               nomeSocial.includes(searchLower) ||
               cpf.includes(searchLower);
      });
    }

    return result;
  }, [allCandidates, filters, searchTerm, analysts, interviewers]);

  function updateFilter(key: keyof Filters, value: any) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      statusTriagem: 'todos',
      statusEntrevista: 'todos',
      analista: 'todos',
      entrevistador: 'todos',
      pcd: 'todos'
    });
    setSearchTerm('');
  }

  function getActiveFiltersCount(): number {
    let count = 0;
    if (filters.statusTriagem !== 'todos') count++;
    if (filters.statusEntrevista !== 'todos') count++;
    if (filters.analista !== 'todos') count++;
    if (filters.entrevistador !== 'todos') count++;
    if (filters.pcd !== 'todos') count++;
    if (searchTerm.trim()) count++;
    return count;
  }

  function exportToCSV() {
    if (filteredCandidates.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const headers = [
      'Nome Completo',
      'Nome Social',
      'CPF',
      'Telefone',
      'Cargos',
      'Status Triagem',
      'Analista',
      'Status Entrevista',
      'Pontuação Entrevista',
      'Entrevistador',
      'PCD'
    ];

    const rows = filteredCandidates.map(c => [
      getCandidateField(c, 'NOMECOMPLETO', 'nome_completo', 'full_name'),
      getCandidateField(c, 'NOMESOCIAL', 'nome_social'),
      getCandidateField(c, 'CPF', 'cpf'),
      getCandidateField(c, 'TELEFONE', 'telefone'),
      [getCandidateField(c, 'CARGOADMIN'), getCandidateField(c, 'CARGOASSIS')].filter(Boolean).join(' | ') || getCandidateField(c, 'cargo'),
      getCandidateField(c, 'status_triagem', 'statusTriagem', 'status'),
      getCandidateField(c, 'assigned_analyst_name', 'Analista', 'analista_triagem'),
      getCandidateField(c, 'status_entrevista', 'interview_status'),
      c.interview_score?.toString() || c.pontuacao_entrevista?.toString() || '-',
      getCandidateField(c, 'interviewer_name', 'entrevistador', 'Entrevistador'),
      getCandidateField(c, 'VAGAPCD', 'vaga_pcd')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_candidatos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Relatório com Filtros Cruzados</h2>
            <p className="text-sm text-slate-600 mt-1">Combine múltiplos filtros para análises detalhadas</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-700">Total Geral</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                </div>
                <Users className="w-8 h-8 text-slate-600" />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-700">Classif. Triagem</div>
                  <div className="text-2xl font-bold text-blue-800">{stats.classificadosTriagem}</div>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-red-700">Descl. Triagem</div>
                  <div className="text-2xl font-bold text-red-800">{stats.desclassificadosTriagem}</div>
                </div>
                <UserX className="w-8 h-8 text-red-600" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-700">Classif. Entrevista</div>
                  <div className="text-2xl font-bold text-green-800">{stats.classificadosEntrevista}</div>
                </div>
                <ClipboardCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-orange-700">Descl. Entrevista</div>
                  <div className="text-2xl font-bold text-orange-800">{stats.desclassificadosEntrevista}</div>
                </div>
                <UserX className="w-8 h-8 text-orange-600" />
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-700">PCD</div>
                  <div className="text-2xl font-bold text-purple-800">{stats.pcd}</div>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  Filtros Cruzados {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()} ativos)`}
                </span>
              </div>
              {getActiveFiltersCount() > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Status Triagem</label>
                <select
                  value={filters.statusTriagem}
                  onChange={(e) => updateFilter('statusTriagem', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="classificado">Classificados</option>
                  <option value="desclassificado">Desclassificados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Status Entrevista</label>
                <select
                  value={filters.statusEntrevista}
                  onChange={(e) => updateFilter('statusEntrevista', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="classificados">Classificados</option>
                  <option value="desclassificados">Desclassificados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  Analista {analysts.length > 0 && `(${analysts.length})`}
                </label>
                <select
                  value={filters.analista}
                  onChange={(e) => updateFilter('analista', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  {analysts.map((analyst) => (
                    <option key={analyst.id} value={analyst.id}>
                      {analyst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  Entrevistador {interviewers.length > 0 && `(${interviewers.length})`}
                </label>
                <select
                  value={filters.entrevistador}
                  onChange={(e) => updateFilter('entrevistador', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">PCD</label>
                <select
                  value={filters.pcd}
                  onChange={(e) => updateFilter('pcd', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Buscar Candidato</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <span className="font-bold text-lg">{filteredCandidates.length}</span> candidatos encontrados
              {allCandidates.length > filteredCandidates.length && ` de ${allCandidates.length} total`}
            </div>

            <button
              onClick={exportToCSV}
              disabled={filteredCandidates.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500">Nenhum candidato encontrado com os filtros selecionados</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-slate-200 max-h-96 overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome Completo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      CPF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status Triagem
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Analista
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status Entrevista
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Entrevistador
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      PCD
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCandidates.map((candidate, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                        {getCandidateField(candidate, 'NOMECOMPLETO', 'nome_completo', 'full_name') || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {getCandidateField(candidate, 'CPF', 'cpf') || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {[getCandidateField(candidate, 'CARGOADMIN'), getCandidateField(candidate, 'CARGOASSIS')].filter(Boolean).join(' | ') || getCandidateField(candidate, 'cargo') || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(() => {
                          const status = getCandidateField(candidate, 'status_triagem', 'statusTriagem', 'status');
                          const statusLower = status.toLowerCase();
                          if (statusLower === 'classificado') {
                            return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Classificado</span>;
                          } else if (statusLower === 'desclassificado') {
                            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Desclassificado</span>;
                          }
                          return <span className="text-gray-400">{status || '-'}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCandidateField(candidate, 'assigned_analyst_name', 'Analista', 'analista_triagem') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(() => {
                          const status = getCandidateField(candidate, 'status_entrevista', 'interview_status');
                          const statusLower = status.toLowerCase();
                          if (statusLower === 'aprovado' || statusLower === 'classificado') {
                            return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Aprovado</span>;
                          } else if (statusLower === 'reprovado' || statusLower === 'desclassificado') {
                            return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Reprovado</span>;
                          }
                          return <span className="text-gray-400">{status || '-'}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCandidateField(candidate, 'interviewer_name', 'entrevistador', 'Entrevistador') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getCandidateField(candidate, 'VAGAPCD', 'vaga_pcd') === 'Sim' ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            Sim
                          </span>
                        ) : (
                          <span className="text-gray-400">Não</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
