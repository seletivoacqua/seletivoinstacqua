import { useState, useEffect } from 'react';
import { FileText, Download, Filter, Loader2, Users, UserX, ClipboardCheck, AlertCircle, RefreshCw } from 'lucide-react';
import type { Candidate } from '../types/candidate';
import { getAnalysts, getInterviewers } from '../services/userService';
import { User } from '../contexts/AuthContext';

interface ReportsPageProps {
  onClose: () => void;
}

type ReportType = 'classificados' | 'desclassificados' | 'entrevista_classificados' | 'entrevista_desclassificados';

export default function ReportsPage({ onClose }: ReportsPageProps) {
  const [loading, setLoading] = useState(false);
  const [analysts, setAnalysts] = useState<User[]>([]);
  const [interviewers, setInterviewers] = useState<User[]>([]);
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('todos');
  const [selectedInterviewer, setSelectedInterviewer] = useState<string>('todos');
  const [reportType, setReportType] = useState<ReportType>('classificados');
  const [reportData, setReportData] = useState<Candidate[]>([]);
  const [stats, setStats] = useState({
    classificados: 0,
    desclassificados: 0,
    entrevistaClassificados: 0,
    entrevistaDesclassificados: 0
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('🔄 ReportsPage - Iniciando carregamento');
    loadAnalystsAndInterviewers();
    loadStats();
  }, []);

  useEffect(() => {
    if (analysts.length > 0 || interviewers.length > 0) {
      loadReport();
    }
  }, [reportType, selectedAnalyst, selectedInterviewer, analysts, interviewers]);

  async function loadAnalystsAndInterviewers() {
    try {
      setLoadingUsers(true);
      setError('');
      console.log('========================================');
      console.log('📋 [ReportsPage] Iniciando carregamento de analistas e entrevistadores...');
      console.log('========================================');

      const [analystsData, interviewersData] = await Promise.all([
        getAnalysts(),
        getInterviewers()
      ]);

      console.log('========================================');
      console.log('✅ [ReportsPage] Analistas recebidos:', analystsData);
      console.log('✅ [ReportsPage] Entrevistadores recebidos:', interviewersData);
      console.log('📊 [ReportsPage] Total de analistas:', analystsData.length);
      console.log('📊 [ReportsPage] Total de entrevistadores:', interviewersData.length);
      console.log('========================================');

      setAnalysts(analystsData);
      setInterviewers(interviewersData);

      if (analystsData.length === 0 && interviewersData.length === 0) {
        const msg = 'Nenhum analista ou entrevistador encontrado. Verifique se há usuários cadastrados no sistema.';
        console.warn('⚠️ [ReportsPage]', msg);
        setError(msg);
      }
    } catch (error) {
      console.error('========================================');
      console.error('❌ [ReportsPage] Erro ao carregar usuários:', error);
      console.error('❌ [ReportsPage] Tipo do erro:', typeof error);
      console.error('❌ [ReportsPage] Mensagem:', error instanceof Error ? error.message : String(error));
      console.error('========================================');
      setError('Erro ao carregar lista de analistas e entrevistadores. Tente novamente.');
      setAnalysts([]);
      setInterviewers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadStats() {
    try {
      const { googleSheetsService } = await import('../services/googleSheets');
      const result = await googleSheetsService.getReportStats();

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }

  async function loadReport() {
    try {
      setLoading(true);
      console.log('📋 [ReportsPage] Carregando relatório:', reportType);
      
      const { googleSheetsService } = await import('../services/googleSheets');

      let analystEmail = undefined;
      let interviewerEmail = undefined;

      if (selectedAnalyst !== 'todos') {
        const analyst = analysts.find(a => a.id === selectedAnalyst);
        analystEmail = analyst?.email;
        console.log('🔍 [ReportsPage] Filtrando por analista:', analystEmail);
      }

      if (selectedInterviewer !== 'todos') {
        const interviewer = interviewers.find(i => i.id === selectedInterviewer);
        interviewerEmail = interviewer?.email;
        console.log('🔍 [ReportsPage] Filtrando por entrevistador:', interviewerEmail);
      }

      const result = await googleSheetsService.getReport({
        reportType,
        analystEmail,
        interviewerEmail
      });

      console.log('📦 [ReportsPage] Resultado do relatório:', result);

      if (result.success && Array.isArray(result.data)) {
        setReportData(result.data);
        console.log('✅ [ReportsPage] Relatório carregado:', result.data.length, 'registros');
        
        // Debug: mostrar estrutura dos dados
        if (result.data.length > 0) {
          console.log('🔍 Primeiro registro:', result.data[0]);
          console.log('📋 Campos disponíveis:', Object.keys(result.data[0]));
        }
      } else {
        console.warn('⚠️ [ReportsPage] Nenhum dado retornado ou estrutura inválida');
        setReportData([]);
      }
    } catch (error) {
      console.error('❌ [ReportsPage] Erro ao carregar relatório:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }

  // Funções auxiliares baseadas no DisqualifiedCandidatesList
  function getNomeCompleto(candidate: Candidate): string {
    return candidate.NOMECOMPLETO || 
           candidate.nome_completo || 
           candidate.full_name || 
           'Nome não informado';
  }

  function getCargo(candidate: Candidate): string {
    return candidate.CARGOPRETENDIDO || 
           candidate.cargo_administrativo || 
           candidate.cargo_assistencial || 
           'Não informado';
  }

  function getAreaAtuacao(candidate: Candidate): string {
    return candidate.AREAATUACAO || 
           candidate.area_atuacao_pretendida || 
           candidate.desired_area || 
           'Área não informada';
  }

  function getMotivoDesclassificacao(candidate: Candidate): string {
    return candidate.disqualification_reason?.reason || 
           candidate.motivo_desclassificacao || 
           'Motivo não informado';
  }

  function getAnalistaTriagem(candidate: Candidate): string {
    return candidate.assigned_to || 
           candidate.analista_triagem || 
           candidate.assigned_analyst_name ||
           'Analista não informado';
  }

  function getEntrevistador(candidate: Candidate): string {
    return candidate.interviewer_name ||
           candidate.entrevistador || 
           'Entrevistador não informado';
  }

  function getObservacoes(candidate: Candidate): string {
    return candidate.observacoes_triagem || 
           candidate.screening_notes || 
           '';
  }

  function exportToCSV() {
    if (reportData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const headers = getTableHeaders();
    const rows = reportData.map(candidate => getTableRowData(candidate));

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToExcel() {
    if (reportData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const headers = getTableHeaders();
    const rows = reportData.map(candidate => getTableRowData(candidate));

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToPDF() {
    if (reportData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const title = getReportTitle();
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header-info { margin-bottom: 20px; color: #666; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="header-info">
            <p><strong>Data de emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <p><strong>Total de registros:</strong> ${reportData.length}</p>
            ${selectedAnalyst !== 'todos' ? `<p><strong>Analista:</strong> ${analysts.find(a => a.id === selectedAnalyst)?.name}</p>` : ''}
            ${selectedInterviewer !== 'todos' ? `<p><strong>Entrevistador:</strong> ${interviewers.find(i => i.id === selectedInterviewer)?.name}</p>` : ''}
          </div>
          ${generatePDFTable()}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  function generatePDFTable(): string {
    const headers = getTableHeaders();
    const rows = reportData.map(candidate => getTableRowData(candidate));

    return `
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function getTableHeaders(): string[] {
    const baseHeaders = ['Nome Completo', 'Nome Social', 'CPF', 'Telefone', 'Cargo Pretendido'];
    
    switch (reportType) {
      case 'desclassificados':
        return [...baseHeaders, 'Motivo Desclassificação', 'PCD', 'Analista'];
      case 'entrevista_classificados':
      case 'entrevista_desclassificados':
        return [...baseHeaders, 'Pontuação', 'PCD', 'Entrevistador'];
      default:
        return [...baseHeaders, 'PCD', 'Analista'];
    }
  }

  function getTableRowData(candidate: Candidate): string[] {
    const baseData = [
      getNomeCompleto(candidate),
      candidate.NOMESOCIAL || candidate.nome_social || '-',
      candidate.CPF || candidate.cpf || candidate.cpf_numero || 'Não informado',
      candidate.TELEFONE || candidate.telefone || 'Não informado',
      getCargo(candidate)
    ];

    switch (reportType) {
      case 'desclassificados':
        return [
          ...baseData,
          getMotivoDesclassificacao(candidate),
          candidate.VAGAPCD || 'Não',
          getAnalistaTriagem(candidate)
        ];
      case 'entrevista_classificados':
      case 'entrevista_desclassificados':
        return [
          ...baseData,
          candidate.interview_score?.toString() || '0',
          candidate.VAGAPCD || 'Não',
          getEntrevistador(candidate)
        ];
      default:
        return [
          ...baseData,
          candidate.VAGAPCD || 'Não',
          getAnalistaTriagem(candidate)
        ];
    }
  }

  function getReportTitle(): string {
    const titles = {
      classificados: 'Candidatos Classificados - Triagem',
      desclassificados: 'Candidatos Desclassificados - Triagem',
      entrevista_classificados: 'Candidatos Classificados - Entrevista',
      entrevista_desclassificados: 'Candidatos Desclassificados - Entrevista'
    };
    return titles[reportType] || 'Relatório';
  }

  function shouldShowAnalystFilter(): boolean {
    return reportType === 'classificados' || reportType === 'desclassificados';
  }

  function shouldShowInterviewerFilter(): boolean {
    return reportType === 'entrevista_classificados' || reportType === 'entrevista_desclassificados';
  }

  async function reloadUsers() {
    await loadAnalystsAndInterviewers();
  }

  function clearFilters() {
    setSelectedAnalyst('todos');
    setSelectedInterviewer('todos');
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Relatórios
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Visualize e exporte relatórios do processo seletivo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadUsers}
              disabled={loadingUsers}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              Recarregar Usuários
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-800 font-medium">Classificados</div>
                <div className="text-2xl font-bold text-blue-800">{stats.classificados}</div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-800 font-medium">Desclassificados</div>
                <div className="text-2xl font-bold text-red-800">{stats.desclassificados}</div>
              </div>
              <UserX className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-800 font-medium">Aprovados Entrevista</div>
                <div className="text-2xl font-bold text-green-800">{stats.entrevistaClassificados}</div>
              </div>
              <ClipboardCheck className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-orange-800 font-medium">Reprovados Entrevista</div>
                <div className="text-2xl font-bold text-orange-800">{stats.entrevistaDesclassificados}</div>
              </div>
              <UserX className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>

          <div className="flex-1 flex items-center gap-4 flex-wrap">
            <div className="min-w-[200px]">
              <label className="block text-xs text-gray-600 mb-1 font-medium">Tipo de Relatório</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="classificados">Classificados - Triagem</option>
                <option value="desclassificados">Desclassificados - Triagem</option>
                <option value="entrevista_classificados">Classificados - Entrevista</option>
                <option value="entrevista_desclassificados">Desclassificados - Entrevista</option>
              </select>
            </div>

            {shouldShowAnalystFilter() && (
              <div className="min-w-[180px]">
                <label className="block text-xs text-gray-600 mb-1 font-medium">Analista</label>
                {loadingUsers ? (
                  <div className="flex items-center py-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Carregando...
                  </div>
                ) : (
                  <select
                    value={selectedAnalyst}
                    onChange={(e) => setSelectedAnalyst(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    disabled={analysts.length === 0}
                  >
                    <option value="todos">
                      {analysts.length === 0 ? 'Nenhum analista disponível' : 'Todos os Analistas'}
                    </option>
                    {analysts.map((analyst) => (
                      <option key={analyst.id} value={analyst.id}>
                        {analyst.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {shouldShowInterviewerFilter() && (
              <div className="min-w-[180px]">
                <label className="block text-xs text-gray-600 mb-1 font-medium">Entrevistador</label>
                {loadingUsers ? (
                  <div className="flex items-center py-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Carregando...
                  </div>
                ) : (
                  <select
                    value={selectedInterviewer}
                    onChange={(e) => setSelectedInterviewer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    disabled={interviewers.length === 0}
                  >
                    <option value="todos">
                      {interviewers.length === 0 ? 'Nenhum entrevistador disponível' : 'Todos os Entrevistadores'}
                    </option>
                    {interviewers.map((interviewer) => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={clearFilters}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-sm transition-colors self-end"
            >
              Limpar Filtros
            </button>

            <div className="ml-auto flex items-center gap-2 self-end">
              <button
                onClick={exportToPDF}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportToExcel}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={exportToCSV}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : reportData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum dado encontrado para este relatório</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">{getReportTitle()}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {reportData.length} {reportData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                {selectedAnalyst !== 'todos' && ` - Analista: ${analysts.find(a => a.id === selectedAnalyst)?.name}`}
                {selectedInterviewer !== 'todos' && ` - Entrevistador: ${interviewers.find(i => i.id === selectedInterviewer)?.name}`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome Completo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome Social
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      CPF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Telefone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Cargo Pretendido
                    </th>
                    {reportType === 'desclassificados' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Motivo Desclassificação
                      </th>
                    )}
                    {(reportType === 'entrevista_classificados' || reportType === 'entrevista_desclassificados') && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Pontuação
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      PCD
                    </th>
                    {shouldShowAnalystFilter() && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Analista
                      </th>
                    )}
                    {shouldShowInterviewerFilter() && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Entrevistador
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.map((candidate, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                        {getNomeCompleto(candidate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {candidate.NOMESOCIAL || candidate.nome_social || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {candidate.CPF || candidate.cpf || candidate.cpf_numero || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {candidate.TELEFONE || candidate.telefone || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCargo(candidate)}
                      </td>
                      {reportType === 'desclassificados' && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getMotivoDesclassificacao(candidate)}
                        </td>
                      )}
                      {(reportType === 'entrevista_classificados' || reportType === 'entrevista_desclassificados') && (
                        <td className="px-4 py-3 text-sm font-semibold">
                          <span className={
                            Number(candidate.interview_score) >= 80
                              ? 'text-green-700'
                              : Number(candidate.interview_score) >= 60
                              ? 'text-yellow-700'
                              : 'text-red-700'
                          }>
                            {candidate.interview_score || 0}/120
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        {candidate.VAGAPCD === 'Sim' ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            Sim
                          </span>
                        ) : (
                          <span className="text-gray-400">Não</span>
                        )}
                      </td>
                      {shouldShowAnalystFilter() && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getAnalistaTriagem(candidate)}
                        </td>
                      )}
                      {shouldShowInterviewerFilter() && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getEntrevistador(candidate)}
                        </td>
                      )}
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
