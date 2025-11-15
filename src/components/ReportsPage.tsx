import { useState, useEffect } from 'react';
import { FileText, Download, Filter, Loader2, Users, UserX, ClipboardCheck } from 'lucide-react';
import type { Candidate } from '../types/candidate';

interface ReportsPageProps {
  onClose: () => void;
}

type ReportType = 'classificados' | 'desclassificados' | 'entrevista_classificados' | 'entrevista_desclassificados';

interface Analyst {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ReportsPage({ onClose }: ReportsPageProps) {
  const [loading, setLoading] = useState(false);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [interviewers, setInterviewers] = useState<Analyst[]>([]);
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

  useEffect(() => {
    loadAnalystsAndInterviewers();
    loadStats();
  }, []);

  useEffect(() => {
    if (reportType) {
      loadReport();
    }
  }, [reportType, selectedAnalyst, selectedInterviewer]);

  async function loadAnalystsAndInterviewers() {
    try {
      // Usando o serviço existente que já temos
      const { getAnalysts } = await import('../services/userService');
      const allUsers = await getAnalysts();
      
      // Filtrar analistas (role = 'analyst')
      const analystsList = allUsers.filter(user => 
        user.role === 'analyst' || user.role === 'Analista'
      );
      
      // Filtrar entrevistadores (role = 'interviewer' ou qualquer usuário ativo para entrevista)
      const interviewersList = allUsers.filter(user => 
        user.role === 'interviewer' || user.role === 'Entrevistador' || user.active
      );

      setAnalysts(analystsList);
      setInterviewers(interviewersList);
      
      console.log('📊 Analistas carregados:', analystsList);
      console.log('🎤 Entrevistadores carregados:', interviewersList);
    } catch (error) {
      console.error('Erro ao carregar analistas e entrevistadores:', error);
      // Fallback para dados mock em caso de erro
      setAnalysts([
        { id: '1', name: 'Analista 1', email: 'analista1@email.com', role: 'analyst' },
        { id: '2', name: 'Analista 2', email: 'analista2@email.com', role: 'analyst' }
      ]);
      setInterviewers([
        { id: '3', name: 'Entrevistador 1', email: 'entrevistador1@email.com', role: 'interviewer' },
        { id: '4', name: 'Entrevistador 2', email: 'entrevistador2@email.com', role: 'interviewer' }
      ]);
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
      const { googleSheetsService } = await import('../services/googleSheets');

      const filters: any = {};
      if (selectedAnalyst !== 'todos') {
        filters.analystId = selectedAnalyst;
      }
      if (selectedInterviewer !== 'todos') {
        filters.interviewerId = selectedInterviewer;
      }

      const result = await googleSheetsService.getReport(reportType, filters);

      if (result.success && Array.isArray(result.data)) {
        setReportData(result.data);
      } else {
        setReportData([]);
      }
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (reportData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    let headers: string[] = [];
    let rows: string[][] = [];

    switch (reportType) {
      case 'classificados':
      case 'entrevista_classificados':
        headers = ['Nome Completo', 'Nome Social', 'CPF', 'Telefone', 'Cargo Pretendido', 'PCD', 'Analista', 'Entrevistador'];
        rows = reportData.map(c => [
          c.NOMECOMPLETO || '',
          c.NOMESOCIAL || '',
          c.CPF || '',
          c.TELEFONE || '',
          c.CARGOPRETENDIDO || '',
          c.VAGAPCD || '',
          c.assigned_analyst_name || '',
          c.interviewer_name || ''
        ]);
        break;

      case 'desclassificados':
        headers = ['Nome Completo', 'Nome Social', 'CPF', 'Telefone', 'Cargo Pretendido', 'Motivo Desclassificação', 'PCD', 'Analista'];
        rows = reportData.map(c => [
          c.NOMECOMPLETO || '',
          c.NOMESOCIAL || '',
          c.CPF || '',
          c.TELEFONE || '',
          c.CARGOPRETENDIDO || '',
          c['Motivo Desclassificação'] || '',
          c.VAGAPCD || '',
          c.assigned_analyst_name || ''
        ]);
        break;

      case 'entrevista_desclassificados':
        headers = ['Nome Completo', 'Nome Social', 'CPF', 'Telefone', 'Cargo Pretendido', 'Pontuação', 'PCD', 'Entrevistador'];
        rows = reportData.map(c => [
          c.NOMECOMPLETO || '',
          c.NOMESOCIAL || '',
          c.CPF || '',
          c.TELEFONE || '',
          c.CARGOPRETENDIDO || '',
          c.interview_score?.toString() || '',
          c.VAGAPCD || '',
          c.interviewer_name || ''
        ]);
        break;
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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

    // Para uma implementação real, você pode usar bibliotecas como:
    // xlsx ou exceljs para gerar arquivos Excel nativos
    // Por enquanto, vamos usar CSV com extensão .xls como fallback
    exportToCSV(); // Reutiliza a função CSV temporariamente
  }

  function exportToPDF() {
    if (reportData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Para uma implementação real, você pode usar bibliotecas como:
    // jspdf, pdfmake, ou html2canvas + jspdf
    // Esta é uma implementação básica que abre uma nova janela para impressão
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
        return [...baseHeaders, 'Pontuação', 'PCD', 'Entrevistador'];
      case 'entrevista_desclassificados':
        return [...baseHeaders, 'Pontuação', 'PCD', 'Entrevistador'];
      default:
        return [...baseHeaders, 'PCD', 'Analista'];
    }
  }

  function getTableRowData(candidate: Candidate): string[] {
    const baseData = [
      candidate.NOMECOMPLETO || 'Não informado',
      candidate.NOMESOCIAL || '-',
      candidate.CPF || 'Não informado',
      candidate.TELEFONE || 'Não informado',
      candidate.CARGOPRETENDIDO || 'Não informado'
    ];

    switch (reportType) {
      case 'desclassificados':
        return [
          ...baseData,
          candidate['Motivo Desclassificação'] || 'Não informado',
          candidate.VAGAPCD || 'Não',
          candidate.assigned_analyst_name || ''
        ];
      case 'entrevista_classificados':
      case 'entrevista_desclassificados':
        return [
          ...baseData,
          candidate.interview_score?.toString() || '0',
          candidate.VAGAPCD || 'Não',
          candidate.interviewer_name || ''
        ];
      default:
        return [
          ...baseData,
          candidate.VAGAPCD || 'Não',
          candidate.assigned_analyst_name || ''
        ];
    }
  }

  function getReportTitle(): string {
    switch (reportType) {
      case 'classificados':
        return 'Candidatos Classificados - Triagem';
      case 'desclassificados':
        return 'Candidatos Desclassificados - Triagem';
      case 'entrevista_classificados':
        return 'Candidatos Classificados - Entrevista';
      case 'entrevista_desclassificados':
        return 'Candidatos Desclassificados - Entrevista';
      default:
        return 'Relatório';
    }
  }

  function shouldShowAnalystFilter(): boolean {
    return reportType === 'classificados' || reportType === 'desclassificados';
  }

  function shouldShowInterviewerFilter(): boolean {
    return reportType === 'entrevista_classificados' || reportType === 'entrevista_desclassificados';
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
            <p className="text-sm text-gray-600 mt-1">Visualize e exporte relatórios do processo seletivo</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-800">Classificados</div>
                <div className="text-2xl font-bold text-blue-800">{stats.classificados}</div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-800">Desclassificados</div>
                <div className="text-2xl font-bold text-red-800">{stats.desclassificados}</div>
              </div>
              <UserX className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-800">Aprovados Entrevista</div>
                <div className="text-2xl font-bold text-green-800">{stats.entrevistaClassificados}</div>
              </div>
              <ClipboardCheck className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-orange-800">Reprovados Entrevista</div>
                <div className="text-2xl font-bold text-orange-800">{stats.entrevistaDesclassificados}</div>
              </div>
              <UserX className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>

          <div className="flex-1 flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de Relatório</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="classificados">Classificados - Triagem</option>
                <option value="desclassificados">Desclassificados - Triagem</option>
                <option value="entrevista_classificados">Classificados - Entrevista</option>
                <option value="entrevista_desclassificados">Desclassificados - Entrevista</option>
              </select>
            </div>

            {shouldShowAnalystFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Analista</label>
                <select
                  value={selectedAnalyst}
                  onChange={(e) => setSelectedAnalyst(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos os Analistas</option>
                  {analysts.map((analyst) => (
                    <option key={analyst.id} value={analyst.id}>
                      {analyst.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {shouldShowInterviewerFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Entrevistador</label>
                <select
                  value={selectedInterviewer}
                  onChange={(e) => setSelectedInterviewer(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos os Entrevistadores</option>
                  {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={exportToPDF}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportToExcel}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={exportToCSV}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                        {candidate.NOMECOMPLETO || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {candidate.NOMESOCIAL || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {candidate.CPF || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {candidate.TELEFONE || 'Não informado'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {candidate.CARGOPRETENDIDO || 'Não informado'}
                      </td>
                      {reportType === 'desclassificados' && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {candidate['Motivo Desclassificação'] || 'Não informado'}
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
                          {candidate.assigned_analyst_name || '-'}
                        </td>
                      )}
                      {shouldShowInterviewerFilter() && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {candidate.interviewer_name || '-'}
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
