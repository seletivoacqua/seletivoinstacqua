import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { candidateService } from '../services/candidateService';
import AssignmentPanel from './AssignmentPanel';
import AnalystDashboard from './AnalystDashboard';
import CsvImportTool from './CsvImportTool';
import ClassifiedCandidatesList from './ClassifiedCandidatesList';
import DisqualifiedCandidatesList from './DisqualifiedCandidatesList';
import ReviewCandidatesList from './ReviewCandidatesList';
import InterviewCandidatesList from './InterviewCandidatesList';
import ReportsPage from './ReportsPage';
import { BarChart3, Users, Upload, CheckCircle, XCircle, Eye, Calendar, FileText } from 'lucide-react';

export default function AdminDashboard() {
  console.log('🎨 AdminDashboard RENDERIZADO - Este é o painel de ADMINISTRADOR');
  const { user, logout } = useAuth();
  console.log('👤 AdminDashboard - Usuário:', user);
  const [activeTab, setActiveTab] = useState<'allocation' | 'my-candidates' | 'import' | 'classified' | 'disqualified' | 'review' | 'interview' | 'reports'>('allocation');
  const [stats, setStats] = useState({
    total: 0,
    pendente: 0,
    em_analise: 0,
    concluido: 0,
    total_triados: 0 // Nova estatística
  });

  // Chave para armazenar no localStorage
  const TOTAL_TRIADOS_KEY = 'total_candidatos_triados';

  useEffect(() => {
    loadStats();
    loadTotalTriados();
  }, []);

  async function loadStats() {
    try {
      const data = await candidateService.getStatistics();
      setStats(prev => ({
        ...data,
        total_triados: prev.total_triados // Mantém o valor atual de total_triados
      }));
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }

  function loadTotalTriados() {
    try {
      const savedTotal = localStorage.getItem(TOTAL_TRIADOS_KEY);
      if (savedTotal) {
        const totalTriados = parseInt(savedTotal, 10);
        setStats(prev => ({
          ...prev,
          total_triados: totalTriados
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar total de triados:', error);
    }
  }

  function updateTotalTriados() {
    try {
      // Incrementa o total de triados
      const currentTotal = stats.total_triados + 1;
      
      // Atualiza o estado
      setStats(prev => ({
        ...prev,
        total_triados: currentTotal
      }));

      // Salva no localStorage
      localStorage.setItem(TOTAL_TRIADOS_KEY, currentTotal.toString());
    } catch (error) {
      console.error('Erro ao atualizar total de triados:', error);
    }
  }

  // Função para resetar o contador (opcional - para admin)
  function resetTotalTriados() {
    if (window.confirm('Tem certeza que deseja resetar o contador de candidatos triados? Esta ação não pode ser desfeita.')) {
      localStorage.setItem(TOTAL_TRIADOS_KEY, '0');
      setStats(prev => ({
        ...prev,
        total_triados: 0
      }));
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-y-auto">
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Sistema de Triagem</h1>
              <p className="text-sm text-gray-600">Admin: {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetTotalTriados}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                title="Resetar contador de triados"
              >
                Resetar Contador
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Sair
              </button>
            </div>
          </div>

          {/* Grid de Estatísticas Atualizado */}
          <div className="grid grid-cols-5 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total de Candidatos</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-yellow-800">Pendente</div>
              <div className="text-2xl font-bold text-yellow-800">{stats.pendente}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-800">Em Análise</div>
              <div className="text-2xl font-bold text-blue-800">{stats.em_analise}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-800">Concluído</div>
              <div className="text-2xl font-bold text-green-800">{stats.concluido}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="flex items-center gap-2 text-sm text-purple-800">
                <CheckCircle className="w-4 h-4" />
                Total Triados
              </div>
              <div className="text-2xl font-bold text-purple-800">{stats.total_triados}</div>
              <div className="text-xs text-purple-600 mt-1">
                Desde o início do sistema
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 border-t">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'import'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => setActiveTab('allocation')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'allocation'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Alocação
            </button>
            <button
              onClick={() => setActiveTab('my-candidates')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'my-candidates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Meus Candidatos
            </button>
            <button
              onClick={() => setActiveTab('classified')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'classified'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Classificados
            </button>
            <button
              onClick={() => setActiveTab('disqualified')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'disqualified'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Desclassificados
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'review'
                  ? 'border-yellow-600 text-yellow-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              À Revisar
            </button>
            <button
              onClick={() => setActiveTab('interview')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'interview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Entrevista
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Relatórios
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'import' && <CsvImportTool />}
        {activeTab === 'allocation' && (
          <AssignmentPanel
            adminId={user?.id || ''}
            onAssignmentComplete={() => {
              loadStats();
            }}
          />
        )}
        {activeTab === 'my-candidates' && (
          <AnalystDashboard onCandidateTriaged={updateTotalTriados} />
        )}
        {activeTab === 'classified' && <ClassifiedCandidatesList />}
        {activeTab === 'disqualified' && <DisqualifiedCandidatesList />}
        {activeTab === 'reports' && <ReportsPage onClose={() => setActiveTab('allocation')} />}
        {activeTab === 'review' && <ReviewCandidatesList />}
        {activeTab === 'interview' && <InterviewCandidatesList />}
      </div>
    </div>
  );
}
