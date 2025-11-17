import { useState, useMemo, useEffect } from 'react';
import { X, Check, FileText, User, Car, Briefcase, Award, Stethoscope, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Candidate {
  id: string;
  full_name?: string;
  nome_completo?: string;
  registration_number?: string;
  CPF?: string;
  AREAATUACAO?: string;
  CARGOPRETENDIDO?: string;
  VAGAPCD?: string;
}

interface ScreeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  onScreeningComplete: () => void;
}

interface DocumentCheck {
  name: string;
  key: string;
  value: 'conforme' | 'nao_conforme' | 'nao_se_aplica';
  required: boolean;
  icon: React.ReactNode;
  conditionallyRequired?: boolean;
}

export default function ScreeningModal({
  isOpen,
  onClose,
  candidate,
  onScreeningComplete
}: ScreeningModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState('');

  // 🎯 LISTA EXATA DOS CARGOS QUE EXIGEM REGULARIDADE PROFISSIONAL
  const cargosComRegularidadeObrigatoria = useMemo(() => [
    'Assistente Social (30h)',
    'Biomédico (36h)',
    'Enfermeiro (a) Especialista - Auditor (36h)',
    'Enfermeiro (a) Especialista - Centro Cirúrgico (36h)',
    'Enfermeiro (a) Especialista - CME (36h)',
    'Enfermeiro (a) Especialista - Epidemiologia (36h)',
    'Enfermeiro (a) Especialista - Hemodinâmica (36h)',
    'Enfermeiro (a) Especialista - NEP (36h)',
    'Enfermeiro (a) Especialista - Núcleo de Qualidade e Segurança do Paciente (36h)',
    'Enfermeiro (a) Especialista - SCHI (36h)',
    'Enfermeiro (a) Especialista - UTI Cirúrgica (36h)',
    'Enfermeiro (a) Especialista - UTI Geral (36h)',
    'Enfermeiro (a) Especialista - UTI Pediátrica (36h)',
    'Enfermeiro (a) Generalista (30h)',
    'Farmacêutico (36h)',
    'Fisioterapeuta Especialista (30h)',
    'Fisioterapeuta Generalista (30h)',
    'Fonoaudiólogo (30h)',
    'Nutricionista (30h)',
    'Psicólogo (30h)',
    'Tecnico em Enfermagem (36h)',
    'Técnico em Laboratório (36h)'
  ], []);

  // 🎯 LISTA EXATA DOS CARGOS QUE EXIGEM CNH
  const cargosComCNHObrigatoria = useMemo(() => [
  'Motorista - Categoria D (44h)',
   
  ], []);

  // 🎯 VERIFICAÇÃO SIMPLES E EXATA
  const cargoRequirements = useMemo(() => {
    const currentCargo = candidate.CARGOPRETENDIDO || '';

    return {
      requiresCNH: cargosComCNHObrigatoria.includes(currentCargo),
      requiresRegularidade: cargosComRegularidadeObrigatoria.includes(currentCargo)
    };
  }, [candidate.CARGOPRETENDIDO, cargosComCNHObrigatoria, cargosComRegularidadeObrigatoria]);

  // 🎯 DOCUMENTOS COM CONDIÇÕES DINÂMICAS BASEADAS NOS CARGOS
  const initialDocuments: DocumentCheck[] = useMemo(() => [
    { 
      name: 'RG e CPF', 
      key: 'checkrg-cpf',
      value: 'nao_se_aplica', 
      required: true,
      icon: <User className="w-4 h-4" />
    },
    { 
      name: 'CNH', 
      key: 'check-cnh',
      value: 'nao_se_aplica', 
      required: cargoRequirements.requiresCNH,
      conditionallyRequired: cargoRequirements.requiresCNH,
      icon: <Car className="w-4 h-4" />
    },
    { 
      name: 'Comprovação de Experiência Profissional', 
      key: 'check-experiencia',
      value: 'nao_se_aplica', 
      required: true,
      icon: <Briefcase className="w-4 h-4" />
    },
    { 
      name: 'Regularidade Profissional', 
      key: 'check-regularidade',
      value: 'nao_se_aplica', 
      required: cargoRequirements.requiresRegularidade,
      conditionallyRequired: cargoRequirements.requiresRegularidade,
      icon: <Award className="w-4 h-4" />
    },
    { 
      name: 'Laudo médico (PCD)', 
      key: 'check-laudo',
      value: 'nao_se_aplica', 
      required: candidate.VAGAPCD === 'Sim',
      icon: <Stethoscope className="w-4 h-4" />
    },
    { 
      name: 'Currículo atualizado', 
      key: 'check-curriculo',
      value: 'nao_se_aplica', 
      required: true,
      icon: <FileText className="w-4 h-4" />
    }
  ], [cargoRequirements, candidate.VAGAPCD]);

  const [documents, setDocuments] = useState<DocumentCheck[]>(initialDocuments);
  const [classification, setClassification] = useState<'classificado' | 'desclassificado' | null>(null);
  const [notes, setNotes] = useState('');

  // 🎯 ATUALIZAR DOCUMENTOS QUANDO OS REQUISITOS MUDAREM
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  if (!isOpen) return null;

  // Atualizar documento
  const updateDocument = (index: number, value: 'conforme' | 'nao_conforme' | 'nao_se_aplica') => {
    const newDocuments = [...documents];
    newDocuments[index].value = value;
    setDocuments(newDocuments);
  };

  // 🎯 VERIFICAÇÕES SIMPLIFICADAS DE CLASSIFICAÇÃO
  const hasRequiredNonConformDocuments = () => {
    return documents.some(doc => doc.required && doc.value === 'nao_conforme');
  };

  const allRequiredDocumentsEvaluated = () => {
    return documents
      .filter(doc => doc.required)
      .every(doc => doc.value !== 'nao_se_aplica');
  };

  const getProblematicDocuments = () => {
    return documents.filter(doc => 
      doc.required && doc.value === 'nao_conforme'
    );
  };

  // 🎯 VALIDAÇÃO SIMPLES PARA CLASSIFICAÇÃO
  const canClassify = () => {
    if (!allRequiredDocumentsEvaluated()) {
      const missingDocs = documents.filter(doc => 
        doc.required && doc.value === 'nao_se_aplica'
      ).map(doc => doc.name);
      
      return { 
        canClassify: false, 
        reason: `Avalie todos os documentos obrigatórios antes de classificar: ${missingDocs.join(', ')}` 
      };
    }
    
    if (hasRequiredNonConformDocuments()) {
      const problematicDocs = getProblematicDocuments();
      return { 
        canClassify: false, 
        reason: `Não é possível classificar candidato com documentos obrigatórios não conformes: ${problematicDocs.map(d => d.name).join(', ')}` 
      };
    }

    return { canClassify: true, reason: '' };
  };

  // 🎯 CLASSIFICAR CANDIDATO
  const handleClassify = async () => {
    const validation = canClassify();

    if (!validation.canClassify) {
      alert(validation.reason);
      return;
    }

    await submitScreening('classificado');
  };

  // 🎯 DESCLASSIFICAR CANDIDATO
  const handleDisqualify = async () => {
    if (!disqualificationReason.trim() && !hasRequiredNonConformDocuments()) {
      alert('Informe o motivo da desclassificação.');
      return;
    }

    await submitScreening('desclassificado');
  };

  // 🎯 ENVIAR TRIAGEM
 const submitScreening = async (finalClassification: 'classificado' | 'desclassificado') => {
  try {
    setLoading(true);
    setClassification(finalClassification);
    const { googleSheetsService } = await import('../services/googleSheets');

    // ✅ Validação: pelo menos um identificador deve existir
    if (!candidate.registration_number && !candidate.CPF && !candidate.id) {
      throw new Error('Nenhum identificador válido encontrado para o candidato (CPF, número de inscrição ou ID)');
    }

    const statusForScript = finalClassification === 'classificado' ? 'classificado' : 'desclassificado';

    // ✅ Priorize o registrationNumber, depois CPF, depois candidateId
    const screeningData = {
      candidateId: candidate.id,
      registrationNumber: candidate.registration_number,
      cpf: candidate.CPF,
      status: statusForScript,
      
      'checkrg-cpf': documents.find(d => d.key === 'checkrg-cpf')?.value,
      'check-cnh': documents.find(d => d.key === 'check-cnh')?.value,
      'check-experiencia': documents.find(d => d.key === 'check-experiencia')?.value,
      'check-regularidade': documents.find(d => d.key === 'check-regularidade')?.value,
      'check-laudo': documents.find(d => d.key === 'check-laudo')?.value,
      'check-curriculo': documents.find(d => d.key === 'check-curriculo')?.value,

      ...(finalClassification === 'desclassificado' && {
        disqualification_reason: disqualificationReason || getDisqualificationReason(),
        documentos_nao_conformes: documents
          .filter(doc => doc.value === 'nao_conforme')
          .map(doc => doc.name)
          .join(', ')
      }),

      notes: formatNotes(finalClassification),
      analystEmail: user?.email,
      screenedAt: new Date().toISOString()
    };

    console.log('📊 Dados da triagem:', screeningData);

    const result = await googleSheetsService.saveScreening(screeningData);

    if (!result.success) {
      throw new Error(result.error || 'Erro ao salvar triagem');
    }

    console.log('✅ Triagem salva com sucesso');
    onScreeningComplete();
    handleClose();

  } catch (error) {
    console.error('❌ Erro ao salvar triagem:', error);
    alert(`Erro ao salvar triagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  } finally {
    setLoading(false);
  }
};

  // 🎯 FUNÇÕES AUXILIARES
  const getDisqualificationReason = (): string => {
    const problematicDocs = getProblematicDocuments();
    if (problematicDocs.length > 0) {
      return `Documentos obrigatórios não conformes: ${problematicDocs.map(d => d.name).join(', ')}`;
    }
    return disqualificationReason || 'Desclassificado por documento obrigatório não conforme';
  };

  const formatNotes = (finalClassification: 'classificado' | 'desclassificado'): string => {
    const parts = [];

    const documentResults = documents.map(doc =>
      `${doc.name}: ${formatDocumentValue(doc.value)}${doc.conditionallyRequired ? ' (Obrigatório para este cargo)' : ''}`
    ).join(' | ');

    parts.push(`VERIFICAÇÃO DOCUMENTAL: ${documentResults}`);

    if (finalClassification === 'desclassificado' && disqualificationReason) {
      parts.push(`MOTIVO DESCLASSIFICAÇÃO: ${disqualificationReason}`);
    }

    if (notes.trim()) {
      parts.push(`OBSERVAÇÕES: ${notes}`);
    }

    parts.push(`CARGO: ${candidate.CARGOPRETENDIDO} | CNH OBRIGATÓRIA: ${cargoRequirements.requiresCNH ? 'Sim' : 'Não'} | REGULARIDADE OBRIGATÓRIA: ${cargoRequirements.requiresRegularidade ? 'Sim' : 'Não'}`);

    return parts.join('\n');
  };

  const formatDocumentValue = (value: string): string => {
    switch (value) {
      case 'conforme': return 'CONFORME';
      case 'nao_conforme': return 'NÃO CONFORME';
      case 'nao_se_aplica': return 'NÃO SE APLICA';
      default: return value;
    }
  };

  // 🎯 FECHAR MODAL
  const handleClose = () => {
    setDocuments(initialDocuments);
    setClassification(null);
    setNotes('');
    setDisqualificationReason('');
    onClose();
  };

  const getCandidateName = () => {
    return candidate.nome_completo || candidate.full_name || 'Candidato';
  };

  const getCandidateCPF = () => {
    return candidate.CPF || 'Não informado';
  };

  const getAreaAtuacao = () => {
    return candidate.AREAATUACAO || 'Não informado';
  };

  const getCargoPretendido = () => {
    return candidate.CARGOPRETENDIDO || 'Não informado';
  };

  const getVagaPCD = () => {
    return candidate.VAGAPCD === 'Sim' ? 'Sim' : 'Não';
  };

  // 🎯 RENDERIZAÇÃO DO MODAL
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho com informações do candidato */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">
              Triagem de Candidato
            </h2>
            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Nome:</span>
                <p className="text-gray-900">{getCandidateName()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">CPF:</span>
                <p className="text-gray-900">{getCandidateCPF()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Área Pretendida:</span>
                <p className="text-gray-900">{getAreaAtuacao()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Cargo Pretendido:</span>
                <p className="text-gray-900 font-semibold">{getCargoPretendido()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Vaga PCD:</span>
                <p className={`font-medium ${getVagaPCD() === 'Sim' ? 'text-red-600' : 'text-gray-900'}`}>
                  {getVagaPCD()}
                </p>
              </div>
              {candidate.registration_number && (
                <div>
                  <span className="font-medium text-gray-700">Inscrição:</span>
                  <p className="text-gray-900">{candidate.registration_number}</p>
                </div>
              )}
            </div>

            {/* 🎯 INDICADOR DE REQUISITOS DO CARGO */}
            {(cargoRequirements.requiresCNH || cargoRequirements.requiresRegularidade) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Requisitos deste cargo:</span>
                  <span className="text-yellow-700">
                    {cargoRequirements.requiresCNH && 'CNH Obrigatória • '}
                    {cargoRequirements.requiresRegularidade && 'Regularidade Profissional Obrigatória'}
                  </span>
                </div>
                {cargoRequirements.requiresRegularidade && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⚠️ Profissional da saúde - exige registro no conselho de classe
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 ml-4"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Verificação de Documentos</p>
                <p className="text-xs text-gray-500">Avalie a conformidade dos documentos</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Verificação de Documentos</h3>
              <p className="text-sm text-blue-600">
                Avalie a conformidade dos documentos do candidato. Documentos obrigatórios não conformes resultam em desclassificação.
                <br />
                <span className="font-medium">Cargo atual: {getCargoPretendido()}</span>
              </p>
            </div>

            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div key={doc.key} className={`border rounded-lg p-4 ${
                  doc.required ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {doc.icon}
                      <label className="block text-sm font-medium text-gray-700">
                        {doc.name}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      {doc.required && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Obrigatório</span>
                      )}
                      {doc.conditionallyRequired && doc.required && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Para este cargo</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {[
                      { value: 'conforme' as const, label: 'Conforme', color: 'green' },
                      { value: 'nao_conforme' as const, label: 'Não Conforme', color: 'red' },
                      { value: 'nao_se_aplica' as const, label: 'Não se Aplica', color: 'gray' }
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`document-${doc.key}`}
                          value={option.value}
                          checked={doc.value === option.value}
                          onChange={() => updateDocument(index, option.value)}
                          className={`text-${option.color}-600 focus:ring-${option.color}-500`}
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Motivo da desclassificação */}
            {(hasRequiredNonConformDocuments() || disqualificationReason) && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 text-red-600" />
                  <label className="block text-sm font-medium text-red-700">
                    Motivo da Desclassificação
                  </label>
                </div>
                <textarea
                  value={disqualificationReason}
                  onChange={(e) => setDisqualificationReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Descreva o motivo da desclassificação..."
                  required
                />
                {hasRequiredNonConformDocuments() && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ Documentos obrigatórios não conformes detectados
                  </p>
                )}
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações Gerais
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Adicione observações sobre a documentação..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleDisqualify}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Desclassificar
              </button>
              
              {canClassify().canClassify && (
                <button
                  onClick={handleClassify}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Classificar
                </button>
              )}
            </div>

            {!canClassify().canClassify && allRequiredDocumentsEvaluated() && (
              <div className="text-center py-2">
                <p className="text-sm text-orange-600">
                  ⚠️ {canClassify().reason}
                </p>
              </div>
            )}

            {loading && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
                  <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                  Salvando triagem...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
