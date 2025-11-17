import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Filter,
  Loader2,
  Users,
  UserX,
  ClipboardCheck,
} from 'lucide-react';
import type { Candidate } from '../types/candidate';

interface ReportsPageProps {
  onClose: () => void;
}

type ReportType =
  | 'classificados'
  | 'desclassificados'
  | 'entrevista_classificados'
  | 'entrevista_desclassificados';

interface Analyst {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ReportsPage({ onClose }: ReportsPageProps) {
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  
  const [uniqueAnalysts, setUniqueAnalysts] = useState<Analyst[]>([]);
  const [interviewers, setInterviewers] = useState<Analyst[]>([]);
  
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('todos');
  const [selectedInterviewer, setSelectedInterviewer] = useState<string>('todos');
  const [reportType, setReportType] = useState<ReportType>('classificados');
  const [reportData, setReportData] = useState<Candidate[]>([]);
  
  const [stats, setStats] = useState({
    classificados: 0,
    desclassificados: 0,
    entrevistaClassificados: 0,
    entrevistaDesclassificados: 0,
  });

  // Carrega uma vez só
  useEffect(() => {
    loadInterviewers();
    loadStats();
  }, []);

  // Recarrega relatório quando mudar tipo ou filtro
  useEffect(() => {
    // Reseta filtros ao trocar tipo de relatório
    setSelectedAnalyst('todos');
    setSelectedInterviewer('todos');
    setUniqueAnalysts([]); // ← ESSA LINHA É A SALVAÇÃO
    loadReport();
  }, [reportType]);

  // Recarrega só quando mudar filtro (não quando mudar tipo)
  useEffect(() => {
    if (reportType) loadReport();
  }, [selectedAnalyst, selectedInterviewer]);

  async function loadInterviewers() {
    try {
      setLoadingLists(true);
      const { googleSheetsService } = await import('../services/googleSheets');
      const result = await googleSheetsService.getInterviewers();

      if (result.success && Array.isArray(result.data)) {
        const list: Analyst[] = result.data
          .filter((item: any) => item.email && item.name)
          .map((item: any) => ({
            id: item.email,
            email: item.email,
            name: String(item.name).trim(),
            role: item.role || 'Entrevistador',
          }));
        setInterviewers(list);
      } else {
        setInterviewers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar entrevistadores:', error);
      setInterviewers([]);
    } finally {
      setLoadingLists(false);
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
      setReportData([]);

      const { googleSheetsService } = await import('../services/googleSheets');

      let analystEmail: string | undefined;
      let interviewerEmail: string | undefined;

      if (selectedAnalyst !== 'todos' && uniqueAnalysts.length > 0) {
        const analyst = uniqueAnalysts.find(a => a.id === selectedAnalyst);
        analystEmail = analyst?.email;
      }
      if (selectedInterviewer !== 'todos') {
        const interviewer = interviewers.find(i => i.id === selectedInterviewer);
        interviewerEmail = interviewer?.email;
      }

      const result = await googleSheetsService.getReport(
        reportType,
        analystEmail,
        interviewerEmail
      );

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setReportData(data);

        // Só extrai analistas nos relatórios de triagem
        if (shouldShowAnalystFilter() && data.length > 0) {
          const analystMap = new Map<string, Analyst>();
          data.forEach((c: any) => {
            const email = c.assigned_analyst_email || c.analista_email || c.analista_triagem_email || c.analistaEmail || c.analista;
            const name = c.assigned_analyst_name || c.analista_triagem || c.Analista || c.analista;
            if (email && name) {
              analystMap.set(email, {
                id: email,
                email: email.trim(),
                name: String(name).trim(),
                role: 'Analista',
              });
            }
          });

          const uniqueList = Array.from(analystMap.values())
            .sort((a, b) => a.name.localeCompare(b.name));
          setUniqueAnalysts(uniqueList);
        }
      } else {
        setReportData([]);
        if (shouldShowAnalystFilter()) setUniqueAnalysts([]);
      }
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      setReportData([]);
      if (shouldShowAnalystFilter()) setUniqueAnalysts([]);
    } finally {
      setLoading(false);
    }
  }

  function shouldShowAnalystFilter() {
    return reportType === 'classificados' || reportType === 'desclassificados';
  }

  function shouldShowInterviewerFilter() {
    return reportType === 'entrevista_classificados' || reportType === 'entrevista_desclassificados';
  }

  function getReportTitle(): string {
    switch (reportType) {
      case 'classificados': return 'Candidatos Classificados - Triagem';
      case 'desclassificados': return 'Candidatos Desclassificados - Triagem';
      case 'entrevista_classificados': return 'Candidatos Classificados - Entrevista';
      case 'entrevista_desclassificados': return 'Candidatos Desclassificados - Entrevista';
      default: return 'Relatório';
    }
  }

  function exportToCSV() {
    if (reportData.length === 0) return alert('Não há dados para exportar');
    alert('Exportação CSV em desenvolvimento');
  }
  function exportToExcel() { exportToCSV(); }
  function exportToPDF() { alert('Exportação PDF em desenvolvimento'); }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header + Cards */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
            <p className="text-sm text-gray-600 mt-1">Visualize e exporte relatórios do processo seletivo</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4"><div className="flex items-center justify-between"><div><div className="text-sm text-blue-800">Classificados</div><div className="text-2xl font-bold text-blue-800">{stats.classificados}</div></div><Users className="w-8 h-8 text-blue-600" /></div></div>
          <div className="bg-red-50 rounded-lg p-4"><div className="flex items-center justify-between"><div><div className="text-sm text-red-800">Desclassificados</div><div className="text-2xl font-bold text-red-800">{stats.desclassificados}</div></div><UserX className="w-8 h-8 text-red-600" /></div></div>
          <div className="bg-green-50 rounded-lg p-4"><div className="flex items-center justify-between"><div><div className="text-sm text-green-800">Aprovados Entrevista</div><div className="text-2xl font-bold text-green-800">{stats.entrevistaClassificados}</div></div><ClipboardCheck className="w-8 h-8 text-green-600" /></div></div>
          <div className="bg-orange-50 rounded-lg p-4"><div className="flex items-center justify-between"><div><div className="text-sm text-orange-800">Reprovados Entrevista</div><div className="text-2xl font-bold text-orange-800">{stats.entrevistaDesclassificados}</div></div><UserX className="w-8 h-8 text-orange-600" /></div></div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>

          <div className="flex-1 flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de Relatório</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="classificados">Classificados - Triagem</option>
                <option value="desclassificados">Desclassificados - Triagem</option>
                <option value="entrevista_classificados">Classificados - Entrevista</option>
                <option value="entrevista_desclassificados">Desclassificados - Entrevista</option>
              </select>
            </div>

            {/* Filtro Analista */}
            {shouldShowAnalystFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Analista {uniqueAnalysts.length > 0 ? `(${uniqueAnalysts.length})` : ''}
                </label>
                <select value={selectedAnalyst} onChange={(e) => setSelectedAnalyst(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  disabled={loading || uniqueAnalysts.length === 0}>
                  <option value="todos">Todos os Analistas</option>
                  {uniqueAnalysts.length === 0 ? (
                    <option disabled>Carregando analistas...</option>
                  ) : (
                    uniqueAnalysts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Filtro Entrevistador */}
            {shouldShowInterviewerFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Entrevistador {interviewers.length > 0 ? `(${interviewers.length})` : ''}
                </label>
                <select value={selectedInterviewer} onChange={(e) => setSelectedInterviewer(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  disabled={loadingLists}>
                  <option value="todos">Todos os Entrevistadores</option>
                  {loadingLists ? (
                    <option disabled>Carregando...</option>
                  ) : interviewers.length === 0 ? (
                    <option disabled>Nenhum cadastrado</option>
                  ) : (
                    interviewers.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="ml-auto flex gap-2">
              <button onClick={exportToPDF} disabled={loading || reportData.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportToExcel} disabled={loading || reportData.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={exportToCSV} disabled={loading || reportData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : reportData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <p>Nenhum dado encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">{getReportTitle()}</h3>
              <p className="text-sm text-gray-600">
                {reportData.length} registro{reportData.length !== 1 && 's'} encontrado{reportData.length !== 1 && 's'}
              </p>
            </div>
            <div className="text-center py-8 text-gray-500">
              Tabela completa aqui (seu código original da tabela)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
