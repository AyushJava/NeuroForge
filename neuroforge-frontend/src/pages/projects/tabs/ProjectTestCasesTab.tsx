import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, ChevronUp, ChevronDown, FlaskConical, Loader2, X } from 'lucide-react';
import { projectService, Project } from '@/services/projectService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Modal from '@/components/common/Modal';

interface Props {
  project: Project;
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  steps: string;
  expectedResult: string;
  status: string;
  priority?: string;
  testType?: string;
  linkedAcceptanceCriteria?: string;
  specificationId?: string;
  specificationTitle?: string;
  specificationVersion?: number;
  createdAt: string;
  createdBy: string;
}

interface Specification {
  id: string;
  title: string;
  currentVersion: number;
  status: string;
}

export default function ProjectTestCasesTab({ project }: Props) {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showTestGenModal, setShowTestGenModal] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<Specification | null>(null);

  // Fetch approved specifications for this project
  const { data: specsData, isLoading: specsLoading } = useQuery({
    queryKey: ['approvedSpecs', project.id],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8081/api/specifications/project/${project.id}/approved`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch specifications');
      }
      const data = await response.json();
      return data.data?.content || [];
    },
    enabled: !!project.id && showSpecModal,
  });

  const specifications: Specification[] = specsData || [];

  // Fetch test cases for this project
  const { data: testCasesData, isLoading, isError, refetch } = useQuery({
    queryKey: ['testCases', project.id],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8081/api/test-cases/project/${project.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch test cases');
      }
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!project.id,
  });

  const testCases: TestCase[] = testCasesData || [];

  // Filter test cases
  const filteredTestCases = testCases.filter((test: TestCase) => {
    const matchesSearch = !searchTerm || 
      test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (test.specificationTitle && test.specificationTitle.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = priorityFilter === 'ALL' || test.priority === priorityFilter;
    const matchesType = typeFilter === 'ALL' || test.testType === typeFilter;
    
    return matchesSearch && matchesPriority && matchesType;
  });

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTests(newExpanded);
  };

  const canEdit = role === 'qa' || role === 'super-admin' || role === 'org-admin';

  const handleGenerateClick = () => {
    setShowSpecModal(true);
  };

  const handleSelectSpecification = (specId: string) => {
    const spec = specifications.find(s => s.id === specId);
    if (spec) {
      setSelectedSpec(spec);
      setShowSpecModal(false);
      setShowTestGenModal(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load test cases. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Test Cases</h2>
          <p className="text-muted-foreground mt-1">
            {filteredTestCases.length} test case{filteredTestCases.length !== 1 ? 's' : ''} for this project
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleGenerateClick}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            Generate Test Cases
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID, title, or specification..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-lg text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 bg-background/50 border border-border rounded-lg text-white"
        >
          <option value="ALL">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-background/50 border border-border rounded-lg text-white"
        >
          <option value="ALL">All Types</option>
          <option value="FUNCTIONAL">Functional</option>
          <option value="SECURITY">Security</option>
          <option value="PERFORMANCE">Performance</option>
          <option value="USABILITY">Usability</option>
        </select>
      </div>

      {/* Test Cases List */}
      {filteredTestCases.length === 0 ? (
        <div className="text-center py-12 bg-background/30 rounded-lg border border-border">
          <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-white mb-2">No test cases found</p>
          <p className="text-muted-foreground">
            {testCases.length === 0 
              ? 'No test cases have been saved for this project yet.'
              : 'No test cases match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTestCases.map((test: TestCase, index: number) => {
            const isExpanded = expandedTests.has(index);
            const testId = `TC-${String(index + 1).padStart(3, '0')}`;
            
            return (
              <div key={test.id} className="bg-background/50 border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-background/70 transition-colors"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">{testId}</span>
                      <span className="text-sm font-medium text-white">{test.title}</span>
                      {test.specificationTitle && (
                        <span className="text-xs text-muted-foreground">
                          → {test.specificationTitle} (v{test.specificationVersion || 1})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        test.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                        test.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {test.priority || 'MEDIUM'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-medium">
                        {test.testType || 'FUNCTIONAL'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 border-t border-border space-y-4">
                    {/* Description */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                      <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                        {test.description || 'No description provided'}
                      </div>
                    </div>

                    {/* Preconditions */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Preconditions</label>
                      <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                        {test.steps ? (
                          <ul className="list-disc list-inside space-y-1">
                            {test.steps.split('\n').filter(s => s.trim()).map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">No preconditions specified</span>
                        )}
                      </div>
                    </div>

                    {/* Test Steps */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Test Steps</label>
                      <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                        {test.steps ? (
                          <ol className="list-decimal list-inside space-y-1">
                            {test.steps.split('\n').filter(s => s.trim()).map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        ) : (
                          <span className="text-muted-foreground">No test steps specified</span>
                        )}
                      </div>
                    </div>

                    {/* Expected Result */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Result</label>
                      <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                        {test.expectedResult || 'No expected result specified'}
                      </div>
                    </div>

                    {/* Linked Acceptance Criteria */}
                    {test.linkedAcceptanceCriteria && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Linked Acceptance Criteria</label>
                        <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                          {test.linkedAcceptanceCriteria}
                        </div>
                      </div>
                    )}

                    {/* Linked Specification */}
                    {test.specificationTitle && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Linked Specification</label>
                        <div className="text-sm text-white bg-background/30 rounded px-3 py-2">
                          {test.specificationTitle}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                      <span>Status: {test.status}</span>
                      <span>Created: {new Date(test.createdAt).toLocaleDateString()}</span>
                      <span>By: {test.createdBy}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Specification Selection Modal */}
      {showSpecModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-white">Select Specification for Test Generation</h3>
              <button
                onClick={() => setShowSpecModal(false)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {specsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : specifications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No approved specifications found for this project.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Only approved specifications can be used for test case generation.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {specifications.map((spec) => (
                    <button
                      key={spec.id}
                      onClick={() => handleSelectSpecification(spec.id)}
                      className="w-full p-4 bg-background/50 border border-border rounded-lg hover:bg-background/70 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{spec.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Version v{spec.currentVersion}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                          {spec.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Test Generation Modal */}
      <Modal
        isOpen={showTestGenModal}
        onClose={() => {
          setShowTestGenModal(false);
          setSelectedSpec(null);
        }}
        title="Generate Test Cases"
      >
        <TestGenerationModal
          specification={selectedSpec}
          onSuccess={() => {
            setShowTestGenModal(false);
            setSelectedSpec(null);
            toast({ title: 'Test cases generated successfully' });
            queryClient.invalidateQueries({ queryKey: ['testCases'] });
          }}
          onCancel={() => {
            setShowTestGenModal(false);
            setSelectedSpec(null);
          }}
        />
      </Modal>
    </div>
  );
}

function TestGenerationModal({ specification, onSuccess, onCancel }: {
  specification: Specification | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<any[]>([]);
  const [editingTests, setEditingTests] = useState<any[]>([]);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    if (!specification) return;
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch('http://localhost:8081/api/test-cases/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ specificationId: specification.id }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate test cases');
      }
      if (data.success) {
        setGeneratedTests(data.data.testCases || []);
        setEditingTests(data.data.testCases || []);
        setExpandedTests(new Set(data.data.testCases.map((_: any, i: number) => i)));
      } else {
        throw new Error(data.message || 'Failed to generate test cases');
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to generate test cases',
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!specification) return;
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch(`http://localhost:8081/api/test-cases/save?specificationId=${specification.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editingTests),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save test cases');
      }
      if (data.success) {
        toast({ 
          title: 'Success', 
          description: 'Test cases saved successfully' 
        });
        onSuccess();
      } else {
        throw new Error(data.message || 'Failed to save test cases');
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save test cases',
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-background/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-1">Specification</p>
        <p className="font-medium text-white">{specification?.title}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Version {specification?.currentVersion} • {specification?.status}
        </p>
      </div>

      {generatedTests.length === 0 ? (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FlaskConical className="w-4 h-4" />
              Generate Test Cases
            </>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">Generated Test Cases ({generatedTests.length})</p>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {editingTests.map((test, index) => {
              const isExpanded = expandedTests.has(index);
              const testId = `TC-${String(index + 1).padStart(3, '0')}`;
              
              return (
                <div key={index} className="bg-background/50 border border-border rounded-lg overflow-hidden">
                  <div 
                    className="p-3 cursor-pointer hover:bg-background/70 transition-colors"
                    onClick={() => {
                      const newExpanded = new Set(expandedTests);
                      if (newExpanded.has(index)) {
                        newExpanded.delete(index);
                      } else {
                        newExpanded.add(index);
                      }
                      setExpandedTests(newExpanded);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{testId}</span>
                        <span className="text-sm font-medium text-white">{test.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          test.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                          test.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {test.priority || 'MEDIUM'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-medium">
                          {test.testType || 'FUNCTIONAL'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-border space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                        <div className="text-sm text-white bg-background/30 rounded px-2 py-1.5">
                          {test.description || 'No description provided'}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Preconditions</label>
                        <div className="text-sm text-white bg-background/30 rounded px-2 py-1.5">
                          {Array.isArray(test.preconditions) && test.preconditions.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1">
                              {test.preconditions.map((cond: string, i: number) => (
                                <li key={i}>{cond}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">No preconditions specified</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Test Steps</label>
                        <div className="text-sm text-white bg-background/30 rounded px-2 py-1.5">
                          {Array.isArray(test.testSteps) && test.testSteps.length > 0 ? (
                            <ol className="list-decimal list-inside space-y-1">
                              {test.testSteps.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          ) : (
                            <span className="text-muted-foreground">No test steps specified</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Result</label>
                        <div className="text-sm text-white bg-background/30 rounded px-2 py-1.5">
                          {test.expectedResult || 'No expected result specified'}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Linked Acceptance Criteria</label>
                        <div className="text-sm text-white bg-background/30 rounded px-2 py-1.5">
                          {test.linkedAcceptanceCriteria || 'No linked acceptance criteria'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                          <select
                            className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-white"
                            value={test.priority || 'MEDIUM'}
                            onChange={(e) => {
                              const updated = [...editingTests];
                              updated[index].priority = e.target.value;
                              setEditingTests(updated);
                            }}
                          >
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Test Type</label>
                          <select
                            className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-white"
                            value={test.testType || 'FUNCTIONAL'}
                            onChange={(e) => {
                              const updated = [...editingTests];
                              updated[index].testType = e.target.value;
                              setEditingTests(updated);
                            }}
                          >
                            <option value="FUNCTIONAL">Functional</option>
                            <option value="SECURITY">Security</option>
                            <option value="PERFORMANCE">Performance</option>
                            <option value="USABILITY">Usability</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
            >
              Save Test Cases
            </button>
            <button
              onClick={() => {
                setGeneratedTests([]);
                setEditingTests([]);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-500/20 text-slate-400 rounded-lg hover:bg-slate-500/30 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full px-4 py-2 bg-slate-500/10 text-slate-400 rounded-lg hover:bg-slate-500/20 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
