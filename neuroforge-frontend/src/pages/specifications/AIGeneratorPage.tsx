import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ArrowLeft, Save, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { specificationService, GenerateSpecificationRequest, GenerateSpecificationResponse, SaveAISpecificationRequest } from '@/services/specificationService';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { useToast } from '@/hooks/use-toast';

export default function AIGeneratorPage() {
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const { role, user } = useAuth();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [generatedResponse, setGeneratedResponse] = useState<GenerateSpecificationResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [aiSpecificationId, setAiSpecificationId] = useState<string | null>(null);

  const projectId = searchParams.get('projectId');
  const basePath = role === 'org-admin' 
    ? `/org-admin/projects/${projectId}?tab=requirements` 
    : `/project-manager/projects/${projectId}?tab=requirements`;

  const generateMutation = useMutation({
    mutationFn: (data: GenerateSpecificationRequest) =>
      specificationService.generate(data),
    onSuccess: (res) => {
      const response = res.data?.data;
      setGeneratedResponse(response);
      setIsEditing(true);
      toast({ title: 'Specification Generated!', description: 'AI has generated your specification.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to generate specification.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a requirement prompt.', variant: 'destructive' });
      return;
    }
    await generateMutation.mutateAsync({ prompt });
  };

  const handleSaveDraft = () => {
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Please enter a specification title.', variant: 'destructive' });
      return;
    }

    const saveRequest: SaveAISpecificationRequest = {
      title: title.trim(),
      description: generatedResponse?.description || '',
      userStories: generatedResponse?.userStories || [],
      acceptanceCriteria: generatedResponse?.acceptanceCriteria || [],
      functionalRequirements: generatedResponse?.functionalRequirements || [],
      nonFunctionalRequirements: generatedResponse?.nonFunctionalRequirements || [],
      aiSpecificationId: aiSpecificationId || undefined,
      organizationId: user?.organizationId,
    };

    saveMutation.mutate(saveRequest);
  };

  const saveMutation = useMutation({
    mutationFn: (data: SaveAISpecificationRequest) =>
      specificationService.saveAI(data),
    onSuccess: (res) => {
      const specification = res.data?.data;
      toast({ title: 'Specification Saved!', description: 'AI-generated specification saved as draft.' });
      // Redirect to the project list page (specifications will appear in requirements tab)
      setLocation(basePath);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to save specification.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const handleCreateVersion = () => {
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Please save the specification first to create a version.', variant: 'destructive' });
      return;
    }
    // Create version is handled by the save functionality - each save creates a new version
    handleSaveDraft();
  };

  const EditableSection = ({ title, icon: Icon, value, onChange }: { title: string; icon: any; value: string | string[]; onChange: (title: string, value: string) => void }) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      {isEditing ? (
        <textarea
          className="w-full bg-background border border-border rounded-lg p-3 text-sm text-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          value={Array.isArray(value) ? value.join('\n') : value || ''}
          onChange={(e) => onChange(title, e.target.value)}
        />
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
          {Array.isArray(value) ? value.map((item, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </div>
          )) : value || '—'}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="AI Specification Generator" />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <Link href={basePath} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to Project
            </Link>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI Specification Generator</h2>
                  <p className="text-sm text-muted-foreground">Describe your requirement and let AI generate a structured specification</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Requirement Description</label>
                  <textarea
                    className="w-full bg-background border border-border rounded-xl p-4 text-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Example: Users should be able to book CNG slots and pay online..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={generateMutation.isPending}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !prompt.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generateMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Specification
                    </>
                  )}
                </button>
              </div>
            </div>

            {generatedResponse && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="text-lg font-semibold text-white">Generated Specification</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isEditing ? 'View Mode' : 'Edit Mode'}
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <label className="block text-sm font-medium text-white mb-2">Specification Title *</label>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter specification title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <EditableSection
                  title="Description"
                  icon={FileText}
                  value={generatedResponse.description}
                  onChange={(title: string, value: string) => {
                    setGeneratedResponse({ ...generatedResponse, description: value });
                  }}
                />

                <EditableSection
                  title="User Stories"
                  icon={FileText}
                  value={generatedResponse.userStories}
                  onChange={(title: string, value: string) => {
                    setGeneratedResponse({
                      ...generatedResponse,
                      userStories: value.split('\n').filter(Boolean)
                    });
                  }}
                />

                <EditableSection
                  title="Acceptance Criteria"
                  icon={CheckCircle}
                  value={generatedResponse.acceptanceCriteria}
                  onChange={(title: string, value: string) => {
                    setGeneratedResponse({
                      ...generatedResponse,
                      acceptanceCriteria: value.split('\n').filter(Boolean)
                    });
                  }}
                />

                <EditableSection
                  title="Functional Requirements"
                  icon={AlertCircle}
                  value={generatedResponse.functionalRequirements}
                  onChange={(title: string, value: string) => {
                    setGeneratedResponse({
                      ...generatedResponse,
                      functionalRequirements: value.split('\n').filter(Boolean)
                    });
                  }}
                />

                <EditableSection
                  title="Non-Functional Requirements"
                  icon={AlertCircle}
                  value={generatedResponse.nonFunctionalRequirements}
                  onChange={(title: string, value: string) => {
                    setGeneratedResponse({
                      ...generatedResponse,
                      nonFunctionalRequirements: value.split('\n').filter(Boolean)
                    });
                  }}
                />

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saveMutation.isPending || !title.trim()}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save as Specification
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
