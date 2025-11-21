import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Filter, Loader2, Users, UserX, ClipboardCheck, Search, X } from 'lucide-react';
import type { Candidate } from '../types/candidate';

interface ReportsPageProps {
  onClose: () => void;
}

interface Analyst {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Filters {
  statusTriagem: 'todos' | 'classificados' | 'desclassificados';
  statusEntrevista: 'todos' | 'classificados' | 'desclassificados';
  analista: string;
  entrevistador: string;
  pcd: 'todos' | 'sim' | 'nao';
}

export default function ReportsPage({ onClose }: ReportsPageProps) {
  const [loading, setLoading] = useState(false);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [interviewers, setInterviewers] = useState<Analyst[]>([]);
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
    loadAnalystsAndInterviewers();
    loadAllCandidates();
  }, []);

  async function loadAnalystsAndInterviewers() {
    try {
      console.log('🔄 Iniciando carregamento de analistas e entrevistadores...');

      const { googleSheetsService } = await import('../services/googleSheets');

      const [analystsResult, interviewersResult] = await Promise.all([
        googleSheetsService.getAnalysts(),
        googleSheetsService.getInterviewers()
      ]);

      console.log('📊 Resultado analistas:', analystsResult);
      console.log('🎤 Resultado entrevistadores:', interviewersResult);

      if (analystsResult.success && analystsResult.data) {
        const analystsArray = analystsResult.data.analysts ||
                             (Array.isArray(analystsResult.data) ? analystsResult.data : []);

        const formattedAnalysts = analystsArray.map((analyst: any) => ({
          id: analyst.email || analyst.id,
          name: analyst.name || analyst.nome,
          email: analyst.email,
          role: analyst.role || 'analista'
        }));
        setAnalysts(formattedAnalysts);
        console.log('✅ Analistas carregados:', formattedAnalysts.length);
      } else {
        console.error('❌ Falha ao carregar analistas:', analystsResult);
        setAnalysts([]);
      }

      if (interviewersResult.success && interviewersResult.data) {
        const interviewersArray = interviewersResult.data.interviewers ||
                                 (Array.isArray(interviewersResult.data) ? interviewersResult.data : []);

        const formattedInterviewers = interviewersArray.map((interviewer: any) => ({
          id: interviewer.email || interviewer.id,
          name: interviewer.name || interviewer.nome,
          email: interviewer.email,
          role: 'entrevistador'
        }));
        setInterviewers(formattedInterviewers);
        console.log('✅ Entrevistadores carregados:', formattedInterviewers.length);
      } else {
        console.error('❌ Falha ao carregar entrevistadores:', interviewersResult);
        setInterviewers([]);
      }

    } catch (error) {
      console.error('❌ Erro geral ao carregar analistas e entrevistadores:', error);
      setAnalysts([]);
      setInterviewers([]);
    }
  }

  async function loadAllCandidates() {
    try {
      setLoading(true);
      console.log('📋 Carregando todos os candidatos...');

      const { googleSheetsService } = await import('../services/googleSheets');

      const result = await googleSheetsService.getCandidates();

      console.log('📦 Resultado candidatos:', result);

      if (result.success && result.data) {
        let data = [];

        if (Array.isArray(result.data)) {
          data = result.data;
        } else if (result.data.candidates && Array.isArray(result.data.candidates)) {
          data = result.data.candidates;
        } else if (typeof result.data === 'object') {
          data = Object.values(result.data);
        }

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
    } finally {
      setLoading(false);
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

    // Filtro por status de triagem
    if (filters.statusTriagem !== 'todos') {
      result = result.filter(candidate => {
        const status = (candidate.status_triagem || candidate.statusTriagem || candidate.status || '').toLowerCase();
        return status === filters.statusTriagem;
      });
    }

    // Filtro por status de entrevista
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

    // Filtro por analista
    if (filters.analista !== 'todos') {
      result = result.filter(candidate => {
        const analistaEmail = getCandidateField(candidate, 'assigned_to', 'Analista', 'analista_triagem');
        const analyst = analysts.find(a => a.id === filters.analista);
        return analistaEmail === analyst?.email || analistaEmail === filters.analista;
      });
    }

    // Filtro por entrevistador
    if (filters.entrevistador !== 'todos') {
      result = result.filter(candidate => {
        const entrevistadorEmail = getCandidateField(candidate, 'entrevistador', 'Entrevistador', 'interviewer');
        const interviewer = interviewers.find(i => i.id === filters.entrevistador);
        return entrevistadorEmail === interviewer?.email || entrevistadorEmail === filters.entrevistador;
      });
    }

    // Filtro por PCD
    if (filters.pcd !== 'todos') {
      result = result.filter(candidate => {
        const isPcd = getCandidateField(candidate, 'VAGAPCD', 'vaga_pcd').toLowerCase() === 'sim';
        return filters.pcd === 'sim' ? isPcd : !isPcd;
      });
    }

    // Filtro por busca textual
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

  function exportToExcel() {
    exportToCSV();
  }

  function exportToPDF() {
    if (filteredCandidates.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Candidatos</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header-info { margin-bottom: 20px; color: #666; font-size: 12px; }
            @media print {
              body { margin: 10px; }
              h1 { font-size: 16px; }
              th, td { padding: 4px; font-size: 9px; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Candidatos</h1>
          <div class="header-info">
            <p><strong>Data de emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <p><strong>Total de registros:</strong> ${filteredCandidates.length}</p>
            <p><strong>Filtros ativos:</strong> ${getActiveFiltersCount()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome Completo</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Cargo</th>
                <th>Status Triagem</th>
                <th>Analista</th>
                <th>Status Entrevista</th>
                <th>Entrevistador</th>
                <th>PCD</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCandidates.map(c => `
                <tr>
                  <td>${getCandidateField(c, 'NOMECOMPLETO', 'nome_completo', 'full_name') || 'Não informado'}</td>
                  <td>${getCandidateField(c, 'CPF', 'cpf') || 'Não informado'}</td>
                  <td>${getCandidateField(c, 'TELEFONE', 'telefone') || 'Não informado'}</td>
                  <td>${[getCandidateField(c, 'CARGOADMIN'), getCandidateField(c, 'CARGOASSIS')].filter(Boolean).join(' | ') || getCandidateField(c, 'cargo') || 'Não informado'}</td>
                  <td>${getCandidateField(c, 'status_triagem', 'statusTriagem', 'status') || '-'}</td>
                  <td>${getCandidateField(c, 'assigned_analyst_name', 'Analista', 'analista_triagem') || '-'}</td>
                  <td>${getCandidateField(c, 'status_entrevista', 'interview_status') || '-'}</td>
                  <td>${getCandidateField(c, 'interviewer_name', 'entrevistador', 'Entrevistador') || '-'}</td>
                  <td>${getCandidateField(c, 'VAGAPCD', 'vaga_pcd') || 'Não'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
            <p className="text-sm text-gray-600 mt-1">Visualize e exporte relatórios do processo seletivo com filtros cruzados</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-6 gap-4 mt-6">
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
      </div>

      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Filtros Cruzados {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()} ativos)`}
            </span>
          </div>
          {getActiveFiltersCount() > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar Filtros
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

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{filteredCandidates.length}</span> candidatos encontrados
            {allCandidates.length > filteredCandidates.length && ` de ${allCandidates.length} total`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              disabled={filteredCandidates.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={exportToExcel}
              disabled={filteredCandidates.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredCandidates.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum candidato encontrado com os filtros selecionados</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome Completo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      CPF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Telefone
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
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                        {getCandidateField(candidate, 'NOMECOMPLETO', 'nome_completo', 'full_name') || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {getCandidateField(candidate, 'CPF', 'cpf') || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCandidateField(candidate, 'TELEFONE', 'telefone') || 'Não informado'}
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
          </div>
        )}
      </div>
    </div>
  );
}
