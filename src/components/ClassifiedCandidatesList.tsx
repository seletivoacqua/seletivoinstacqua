import { useState, useEffect } from 'react';
import { CheckCircle, Mail, MessageSquare, Loader2, Send, Calendar, RefreshCw, Search } from 'lucide-react';
import MessagingModal from './MessagingModal';
import type { Candidate } from '../types/candidate';

function isMessageSent(value: any): boolean {
  return value === true || value === 'Sim' || value === 'TRUE' || value === 'true';
}

export default function ClassifiedCandidatesList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showMessagingModal, setShowMessagingModal] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [filterPCD, setFilterPCD] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');

  useEffect(() => {
    loadClassifiedCandidates();
  }, []);

  async function loadClassifiedCandidates() {
    try {
      setLoading(true);
      const { googleSheetsService } = await import('../services/googleSheets');

      console.log('🚀 Iniciando busca por candidatos classificados...');
      const result = await googleSheetsService.getCandidatesByStatus('Classificado');

      console.log('📊 Resultado completo:', JSON.stringify(result, null, 2));
      console.log('✅ result.success:', result.success);
      console.log('📦 result.data:', result.data);
      console.log('📦 Tipo de result.data:', typeof result.data);
      console.log('📦 É array?', Array.isArray(result.data));

      if (!result.success) {
        console.error('❌ Erro retornado:', result.error);
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

      console.log('📋 Candidatos extraídos:', candidatesData);
      console.log('📏 Total:', candidatesData.length);

      if (candidatesData.length > 0) {
        console.log('👤 Primeiro candidato:', JSON.stringify(candidatesData[0], null, 2));
        console.log('🔑 Campos:', Object.keys(candidatesData[0]));
      }

      setCandidates(candidatesData);
    } catch (error) {
      console.error('❌ Erro ao carregar candidatos classificados:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
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

  function getSelectedCandidatesData() {
    return candidates.filter(c => selectedCandidates.has(c.id));
  }

  async function handleMoveToInterview() {
    const selected = getSelectedCandidatesData();

    console.log('🔍 Candidatos selecionados:', selected);
    console.log('🔍 Verificando status de mensagens...');
    selected.forEach(c => {
      console.log(`  - ${c.NOMECOMPLETO}:`, {
        email_sent: c.email_sent,
        email_sent_type: typeof c.email_sent,
        sms_sent: c.sms_sent,
        sms_sent_type: typeof c.sms_sent
      });
    });

    const withMessages = selected.filter(c => {
      const hasEmail = isMessageSent(c.email_sent);
      const hasSms = isMessageSent(c.sms_sent);
      return hasEmail || hasSms;
    });

    console.log('✅ Candidatos com mensagens:', withMessages.length);

    if (withMessages.length === 0) {
      alert('Selecione apenas candidatos que já receberam email ou SMS');
      return;
    }

    if (withMessages.length !== selected.length) {
      const diff = selected.length - withMessages.length;
      if (!confirm(`${diff} candidato(s) selecionado(s) ainda não receberam mensagens. Deseja continuar apenas com os ${withMessages.length} que receberam?`)) {
        return;
      }
    }

    try {
      setAllocating(true);
      const { googleSheetsService } = await import('../services/googleSheets');

      const candidateIds = withMessages.map(c => c.registration_number).join(',');
      const result = await googleSheetsService.moveToInterview(candidateIds);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao mover para entrevista');
      }

      alert(`${withMessages.length} candidato(s) movido(s) para entrevista com sucesso!`);
      setSelectedCandidates(new Set());
      loadClassifiedCandidates();
    } catch (error) {
      console.error('Erro ao mover para entrevista:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setAllocating(false);
    }
  }

  // Função para renderizar os cargos - NOVA
  const renderCargos = (candidate: Candidate) => {
    const cargos = [];
    if (candidate.CARGOADMIN) cargos.push(`Admin: ${candidate.CARGOADMIN}`);
    if (candidate.CARGOASSIS) cargos.push(`Assis: ${candidate.CARGOASSIS}`);

    return cargos.length > 0 ? cargos.join(' | ') : 'Não informado';
  };

  // Função para verificar se é PCD
  const isPCD = (candidate: Candidate): boolean => {
    const vagaPcd = candidate.VAGAPCD || candidate.vaga_pcd || '';
    return vagaPcd.toLowerCase() === 'sim' || vagaPcd.toLowerCase() === 'true' || vagaPcd === 'TRUE';
  };

  // Função para obter pontuação (soma de capacidade_tecnica e experiencia)
  const getScore = (candidate: Candidate): number => {
    const capacidadeTecnica = Number((candidate as any).capacidade_tecnica) || 0;
    const experiencia = Number((candidate as any).experiencia) || 0;
    return capacidadeTecnica + experiencia;
  };

  // Filtrar candidatos
  const filteredCandidates = candidates.filter(candidate => {
    // Filtro por nome
    if (searchName) {
      const name = (candidate.NOMECOMPLETO || '').toLowerCase();
      if (!name.includes(searchName.toLowerCase())) {
        return false;
      }
    }

    // Filtro PCD
    if (filterPCD !== 'all') {
      const candidateIsPCD = isPCD(candidate);
      if (filterPCD === 'pcd' && !candidateIsPCD) return false;
      if (filterPCD === 'nao-pcd' && candidateIsPCD) return false;
    }

    // Filtro por pontuação (mínima)
    if (filterScore !== 'all') {
      const score = getScore(candidate);
      const minScore = Number(filterScore);
      if (score < minScore) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <CheckCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">Nenhum candidato classificado ainda</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Candidatos Classificados</h2>
          <p className="text-sm text-gray-600 mt-1">
            {selectedCandidates.size > 0
              ? `${selectedCandidates.size} candidato(s) selecionado(s)`
              : `${filteredCandidates.length} de ${candidates.length} candidato(s)`}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadClassifiedCandidates}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          {selectedCandidates.size > 0 && (
            <>
              <button
                onClick={() => setShowMessagingModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Enviar Mensagens
              </button>
              <button
                onClick={handleMoveToInterview}
                disabled={allocating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {allocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                Mover para Entrevista
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca por nome */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por Nome
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Digite o nome..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro PCD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vaga PCD
            </label>
            <select
              value={filterPCD}
              onChange={(e) => setFilterPCD(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="pcd">Somente PCD</option>
              <option value="nao-pcd">Não PCD</option>
            </select>
          </div>

          {/* Filtro Pontuação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pontuação (Mínima)
            </label>
            <input
              type="number"
              value={filterScore === 'all' ? '' : filterScore}
              onChange={(e) => setFilterScore(e.target.value || 'all')}
              placeholder="Ex: 7"
              min="0"
              step="0.1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
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
                Área
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Cargos
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
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                PCD
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Pontuação
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Status Mensagens
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
                    {candidate.AREAATUACAO || 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {renderCargos(candidate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {candidate.CPF || 'Não informado'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {email ? (
                      <a href={`mailto:${email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {email}
                      </a>
                    ) : (
                      'Não informado'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {telefone || 'Não informado'}
                  </td>
                  <td className="px-4 py-3">
                    {isPCD(candidate) ? (
                      <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        Não
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-12 h-8 bg-blue-100 text-blue-700 font-semibold text-sm rounded">
                      {getScore(candidate).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isMessageSent(candidate.email_sent) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          <Mail className="w-3 h-3" />
                          Email enviado
                        </span>
                      )}
                      {isMessageSent(candidate.sms_sent) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          <MessageSquare className="w-3 h-3" />
                          SMS enviado
                        </span>
                      )}
                      {!isMessageSent(candidate.email_sent) && !isMessageSent(candidate.sms_sent) && (
                        <span className="text-xs text-gray-400">Nenhuma mensagem enviada</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MessagingModal
        isOpen={showMessagingModal}
        onClose={() => setShowMessagingModal(false)}
        candidates={getSelectedCandidatesData()}
        onMessagesSent={() => {
          setSelectedCandidates(new Set());
          setShowMessagingModal(false);
          loadClassifiedCandidates();
        }}
      />
    </div>
  );
}
