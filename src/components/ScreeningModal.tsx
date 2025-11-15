import { useState } from 'react';
import { X, Check, FileText, Award, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Candidate {
  id: string;
  full_name?: string;
  nome_completo?: string;
  registration_number?: string;
  CPF?: string;
}

interface ScreeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  onScreeningComplete: () => void;
}

interface DocumentCheck {
  name: string;
  value: 'conforme' | 'nao_conforme' | 'nao_se_aplica';
}

interface TechnicalEvaluation {
  capacidade_tecnica: number;
  experiencia: number;
}

export default function ScreeningModal({
  isOpen,
  onClose,
  candidate,
  onScreeningComplete
}: ScreeningModalProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<'documents' | 'technical' | 'result'>('documents');
  const [loading, setLoading] = useState(false);
  
  // Estado para documentos obrigatórios
  const [documents, setDocuments] = useState<DocumentCheck[]>([
    { name: 'Diploma/Certificado de escolaridade Ensino Médio', value: 'nao_se_aplica' },
    { name: 'Diploma/Certificado de escolaridade Ensino Técnico', value: 'nao_se_aplica' },
    { name: 'Diploma/Certificado de escolaridade Ensino Superior', value: 'nao_se_aplica' },
    { name: 'Conselho de classe', value: 'nao_se_aplica' },
    { name: 'Comprovante do conselho', value: 'nao_se_aplica' }
  ]);

  // Estado para avaliação técnica
  const [technicalEvaluation, setTechnicalEvaluation] = useState<TechnicalEvaluation>({
    capacidade_tecnica: 0,
    experiencia: 0
  });

  const [classification, setClassification] = useState<'classificado' | 'desclassificado' | null>(null);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  // Função para atualizar documento
  const updateDocument = (index: number, value: 'conforme' | 'nao_conforme' | 'nao_se_aplica') => {
    const newDocuments = [...documents];
    newDocuments[index].value = value;
    setDocuments(newDocuments);
  };

  // Função para verificar se há documentos não conformes
  const hasNonConformDocuments = () => {
    return documents.some(doc => doc.value === 'nao_conforme');
  };

  // Função para classificar candidato
  const handleClassify = () => {
    setClassification('classificado');
    setCurrentStep('technical');
  };

  // Função para desclassificar candidato
  const handleDisqualify = async () => {
    setClassification('desclassificado');
    await submitScreening();
  };

  // Função para atualizar avaliação técnica
  const updateTechnicalEvaluation = (field: keyof TechnicalEvaluation, value: number) => {
    setTechnicalEvaluation(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Função para enviar a triagem
  const submitScreening = async () => {
    try {
      setLoading(true);
      const { googleSheetsService } = await import('../services/googleSheets');

      // Preparar dados da triagem
      const screeningData = {
        candidateId: candidate.id,
        registrationNumber: candidate.registration_number,
        CPF: candidate.CPF,
        status: classification,
        documents: documents.reduce((acc, doc, index) => {
          acc[`documento_${index + 1}`] = doc.value;
          return acc;
        }, {} as Record<string, string>),
        capacidade_tecnica: technicalEvaluation.capacidade_tecnica,
        experiencia: technicalEvaluation.experiencia,
        total_score: technicalEvaluation.capacidade_tecnica + technicalEvaluation.experiencia,
        notes,
        analystEmail: user?.email,
        screenedAt: new Date().toISOString()
      };

      console.log('📊 Enviando dados da triagem:', screeningData);

      // Aqui você precisará criar uma função no seu googleSheetsService para salvar a triagem
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

  // Função para fechar modal
  const handleClose = () => {
    setCurrentStep('documents');
    setDocuments([
      { name: 'Diploma/Certificado de escolaridade Ensino Médio', value: 'nao_se_aplica' },
      { name: 'Diploma/Certificado de escolaridade Ensino Técnico', value: 'nao_se_aplica' },
      { name: 'Diploma/Certificado de escolaridade Ensino Superior', value: 'nao_se_aplica' },
      { name: 'Conselho de classe', value: 'nao_se_aplica' },
      { name: 'Comprovante do conselho', value: 'nao_se_aplica' }
    ]);
    setTechnicalEvaluation({
      capacidade_tecnica: 0,
      experiencia: 0
    });
    setClassification(null);
    setNotes('');
    onClose();
  };

  // Renderizar step de documentos
  const renderDocumentsStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Documentos Obrigatórios</h3>
        <p className="text-sm text-blue-600">
          Verifique a conformidade dos documentos do candidato. Documentos não conformes resultam em desclassificação.
        </p>
      </div>

      <div className="space-y-4">
        {documents.map((doc, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {doc.name}
            </label>
            <div className="flex gap-4">
              {[
                { value: 'conforme' as const, label: 'Conforme', color: 'green' },
                { value: 'nao_conforme' as const, label: 'Não Conforme', color: 'red' },
                { value: 'nao_se_aplica' as const, label: 'Não se Aplica', color: 'gray' }
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`document-${index}`}
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

      <div className="border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Observações
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
          className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        
        {hasNonConformDocuments() ? (
          <button
            onClick={handleDisqualify}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Desclassificar
          </button>
        ) : (
          <>
            <button
              onClick={handleDisqualify}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Desclassificar
            </button>
            <button
              onClick={handleClassify}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Classificar
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Renderizar step de avaliação técnica
  const renderTechnicalStep = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-800 mb-2">Avaliação Técnica - Candidato Classificado</h3>
        <p className="text-sm text-green-600">
          Avalie o candidato nas categorias abaixo. Pontuação máxima: 20 pontos.
        </p>
      </div>

      {/* Capacidade Técnica */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-blue-600" />
          <label className="block text-sm font-medium text-gray-700">
            1. Capacidade técnica - currículo, pós-graduação, mestrado e/ou cursos profissionalizantes
          </label>
        </div>
        
        <div className="space-y-3">
          {[
            { value: 10, label: 'Excelente - Possui formação e cursos relevantes avançados' },
            { value: 7, label: 'Bom - Possui formação adequada e alguns cursos complementares' },
            { value: 3, label: 'Regular - Formação básica, poucos cursos complementares' },
            { value: 0, label: 'Insuficiente - Formação inadequada ou sem cursos relevantes' }
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="capacidade_tecnica"
                value={option.value}
                checked={technicalEvaluation.capacidade_tecnica === option.value}
                onChange={() => updateTechnicalEvaluation('capacidade_tecnica', option.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{option.value} pontos</span>
                <p className="text-sm text-gray-500">{option.label}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Experiência */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-green-600" />
          <label className="block text-sm font-medium text-gray-700">
            2. Experiência conforme currículo
          </label>
        </div>
        
        <div className="space-y-3">
          {[
            { value: 10, label: 'Excelente - Ampla experiência comprovada na área' },
            { value: 7, label: 'Bom - Experiência relevante e adequada ao cargo' },
            { value: 3, label: 'Regular - Experiência básica ou parcialmente relacionada' },
            { value: 0, label: 'Insuficiente - Sem experiência relevante' }
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="experiencia"
                value={option.value}
                checked={technicalEvaluation.experiencia === option.value}
                onChange={() => updateTechnicalEvaluation('experiencia', option.value)}
                className="mt-1 text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{option.value} pontos</span>
                <p className="text-sm text-gray-500">{option.label}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Resumo da pontuação */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Resumo da Pontuação</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Capacidade Técnica:</span>
            <span className="font-medium ml-2">{technicalEvaluation.capacidade_tecnica} pontos</span>
          </div>
          <div>
            <span className="text-gray-600">Experiência:</span>
            <span className="font-medium ml-2">{technicalEvaluation.experiencia} pontos</span>
          </div>
          <div className="col-span-2 border-t pt-2">
            <span className="text-gray-600 font-medium">Total:</span>
            <span className="font-bold text-blue-600 ml-2">
              {technicalEvaluation.capacidade_tecnica + technicalEvaluation.experiencia} / 20 pontos
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={() => setCurrentStep('documents')}
          className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Voltar
        </button>
        <button
          onClick={submitScreening}
          disabled={loading || technicalEvaluation.capacidade_tecnica === 0 || technicalEvaluation.experiencia === 0}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Concluir Triagem
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Triagem de Candidato
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {candidate.nome_completo || candidate.full_name} 
              {candidate.registration_number && ` • ${candidate.registration_number}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === 'documents' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-600'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className={`w-16 h-1 ${
                currentStep === 'technical' || currentStep === 'result' 
                  ? 'bg-blue-600' 
                  : 'bg-gray-300'
              }`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === 'technical' || currentStep === 'result'
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-600'
              }`}>
                <Award className="w-4 h-4" />
              </div>
            </div>
          </div>

          {currentStep === 'documents' && renderDocumentsStep()}
          {currentStep === 'technical' && renderTechnicalStep()}
        </div>
      </div>
    </div>
  );
}
