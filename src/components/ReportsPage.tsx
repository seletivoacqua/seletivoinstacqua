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
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);
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
    loadAnalysts();
    loadInterviewers();
    loadStats();
  }, []);

  useEffect(() => {
    if (reportType) {
      loadReport();
    }
  }, [reportType, selectedAnalyst, selectedInterviewer]);

  // Função separada para carregar analistas
  async function loadAnalysts() {
    try {
      setLoadingAnalysts(true);
      console.log('🔄 Iniciando carregamento de analistas...');

      const { googleSheetsService } = await import('../services/googleSheets');
      const analystsResult = await googleSheetsService.getAnalysts();

      console.log('📊 Resultado analistas:', analystsResult);

      if (analystsResult.success && Array.isArray(analystsResult.data)) {
        setAnalysts(analystsResult.data);
        console.log('✅ Analistas carregados:', analystsResult.data.length);
      } else {
        console.error('❌ Falha ao carregar analistas:', analystsResult);
        setAnalysts([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar analistas:', error);
      setAnalysts([]);
    } finally {
      setLoadingAnalysts(false);
    }
  }

  // Função separada para carregar entrevistadores
  async function loadInterviewers() {
    try {
      setLoadingInterviewers(true);
      console.log('🔄 Iniciando carregamento de entrevistadores...');

      const { googleSheetsService } = await import('../services/googleSheets');
      const interviewersResult = await googleSheetsService.getInterviewers();

      console.log('🎤 Resultado entrevistadores:', interviewersResult);

      if (interviewersResult.success && Array.isArray(interviewersResult.data)) {
        setInterviewers(interviewersResult.data);
        console.log('✅ Entrevistadores carregados:', interviewersResult.data.length);
      } else {
        console.error('❌ Falha ao carregar entrevistadores:', interviewersResult);
        setInterviewers([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar entrevistadores:', error);
      setInterviewers([]);
    } finally {
      setLoadingInterviewers(false);
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

      let analystEmail = undefined;
      let interviewerEmail = undefined;

      if (selectedAnalyst !== 'todos') {
        const analyst = analysts.find(a => a.id === selectedAnalyst);
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
        console.log('📊 Relatório carregado:', data.length, 'registros');
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

  // ... (o restante das funções permanecem iguais)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
            <p className="text-sm text-gray-600 mt-1">Visualize e exporte relatórios do processo seletivo</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
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

      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>

          <div className="flex-1 flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de Relatório</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="classificados">Classificados - Triagem</option>
                <option value="desclassificados">Desclassificados - Triagem</option>
                <option value="entrevista_classificados">Classificados - Entrevista</option>
                <option value="entrevista_desclassificados">Desclassificados - Entrevista</option>
              </select>
            </div>

            {shouldShowAnalystFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Analista {analysts.length > 0 && `(${analysts.length})`}
                </label>
                <select
                  value={selectedAnalyst}
                  onChange={(e) => setSelectedAnalyst(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos os Analistas</option>
                  {loadingAnalysts ? (
                    <option disabled>Carregando analistas...</option>
                  ) : analysts.length === 0 ? (
                    <option disabled>Nenhum analista encontrado</option>
                  ) : (
                    analysts.map((analyst) => (
                      <option key={analyst.id} value={analyst.id}>
                        {analyst.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {shouldShowInterviewerFilter() && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Entrevistador {interviewers.length > 0 && `(${interviewers.length})`}
                </label>
                <select
                  value={selectedInterviewer}
                  onChange={(e) => setSelectedInterviewer(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos os Entrevistadores</option>
                  {loadingInterviewers ? (
                    <option disabled>Carregando entrevistadores...</option>
                  ) : interviewers.length === 0 ? (
                    <option disabled>Nenhum entrevistador encontrado</option>
                  ) : (
                    interviewers.map((interviewer) => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={exportToPDF}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportToExcel}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={exportToCSV}
                disabled={reportData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ... (o restante do JSX permanece igual) */}
    </div>
  );
}
