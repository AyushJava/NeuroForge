import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { codeReviewService, AnalyzeReviewRequest, AnalyzeReviewResponse, CodeReviewResponse } from '@/services/codeReviewService';
import { taskService, Task } from '@/services/taskService';
import { useAuth } from '@/context/AuthContext';
import { mapBackendRoleToUiRole } from '@/lib/roleUtils';

const severityColors = {
  HIGH: 'destructive',
  MEDIUM: 'default',
  LOW: 'secondary',
  INFO: 'outline',
} as const;

const severityIcons = {
  HIGH: XCircle,
  MEDIUM: AlertTriangle,
  LOW: Info,
  INFO: Info,
};

interface CodeReviewPageProps {
  projectId?: number;
  isTab?: boolean;
}

export default function CodeReviewPage({ projectId: propProjectId, isTab = false }: CodeReviewPageProps) {
  const { id: urlProjectId } = useParams<{ id: string }>();
  const projectId = propProjectId || (urlProjectId ? Number(urlProjectId) : undefined);
  const { user, role } = useAuth();
  const isProjectManager = role === 'project-manager';
  const isDeveloper = role === 'developer';

  // Prevent QA users from accessing code review
  if (role === 'qa') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">You don't have permission to access code reviews</div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Project ID not found</div>
      </div>
    );
  }
  
  const [sourceCode, setSourceCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [reviewSource, setReviewSource] = useState<'MANUAL' | 'PASTED_CODE' | 'COMMIT'>('PASTED_CODE');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [reviewResult, setReviewResult] = useState<AnalyzeReviewResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<CodeReviewResponse | null>(null);
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [chunkingProgress, setChunkingProgress] = useState<string | null>(null);
  const [chunkResults, setChunkResults] = useState<AnalyzeReviewResponse[]>([]);

  // Fetch tasks for the project
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery<Task[]>({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      try {
        console.log('Fetching tasks for project ID:', projectId);
        const response = await taskService.getTasksByProject(projectId?.toString() || '');
        console.log('Tasks API response:', response);
        
        // Handle response structure: {success: true, message: '...', data: Array}
        const tasksData = (response as any)?.data?.data || (response as any)?.data || response;
        console.log('Tasks data extracted:', tasksData);
        console.log('Is array?', Array.isArray(tasksData));
        
        const result = Array.isArray(tasksData) ? tasksData : [];
        console.log('Final tasks result:', result);
        return result;
      } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
      }
    },
    enabled: !!projectId,
  });

  // Fetch existing reviews for the selected task
  const { data: existingReviews, refetch: refetchReviews } = useQuery({
    queryKey: ['code-reviews', selectedTaskId],
    queryFn: () => selectedTaskId ? codeReviewService.getCodeReviewsByTask(parseInt(selectedTaskId)) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const analyzeMutation = useMutation({
    mutationFn: (request: AnalyzeReviewRequest) => codeReviewService.analyzeReview(request),
    onSuccess: (data) => {
      setReviewResult(data);
      setIsSubmitting(false);
      refetchReviews();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to analyze code');
      setIsSubmitting(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (reviewId: number) => codeReviewService.approveReview(reviewId),
    onSuccess: () => {
      refetchReviews();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reviewId: number) => codeReviewService.rejectReview(reviewId),
    onSuccess: () => {
      refetchReviews();
    },
  });

  // Frontend-based chunking to avoid JVM memory issues
  const chunkCode = (code: string, chunkSize: number = 3000, overlap: number = 200): string[] => {
    try {
      if (!code || code.length === 0) {
        return [];
      }

      console.log('Chunking code, length:', code.length, 'chunkSize:', chunkSize, 'overlap:', overlap);

      const chunks: string[] = [];
      let startPosition = 0;
      let previousStartPosition = -1; // Track to detect infinite loops
      const MAX_ITERATIONS = 100; // Reduced from 1000 to catch issues faster

      for (let i = 0; i < MAX_ITERATIONS && startPosition < code.length; i++) {
        let endPosition = Math.min(startPosition + chunkSize, code.length);

        // Detect infinite loop
        if (startPosition === previousStartPosition) {
          console.error('Infinite loop detected: startPosition not advancing', startPosition);
          break;
        }
        previousStartPosition = startPosition;

        // Ensure we don't create empty chunks
        if (endPosition <= startPosition) {
          console.log('Breaking: endPosition <= startPosition', startPosition, endPosition);
          break;
        }

        // Try to break at a line boundary
        if (endPosition < code.length) {
          try {
            const lastNewline = code.lastIndexOf('\n', endPosition);
            if (lastNewline > startPosition) {
              endPosition = lastNewline + 1;
            }
          } catch (e) {
            console.error('Error finding newline:', e);
            // Fallback to original endPosition
            endPosition = Math.min(startPosition + chunkSize, code.length);
          }
        }

        // Ensure we don't create empty chunks after line boundary adjustment
        if (endPosition <= startPosition) {
          endPosition = Math.min(startPosition + chunkSize, code.length);
        }

        // Final safety check
        if (endPosition <= startPosition || endPosition > code.length) {
          console.log('Breaking: invalid positions', startPosition, endPosition, code.length);
          break;
        }

        try {
          const chunk = code.substring(startPosition, endPosition);
          if (chunk.length > 0) {
            chunks.push(chunk);
            console.log(`Created chunk ${chunks.length}, length:`, chunk.length, 'start:', startPosition, 'end:', endPosition);
          }
        } catch (e) {
          console.error('Error creating chunk:', e, 'positions:', startPosition, endPosition);
          break;
        }

        // Calculate next position with overlap
        const nextPosition = endPosition - overlap;
        
        // Ensure we actually advance
        if (nextPosition <= startPosition) {
          startPosition = endPosition; // No overlap if it would cause issues
        } else {
          startPosition = nextPosition;
        }

        // Prevent infinite loop
        if (startPosition >= code.length) {
          console.log('Breaking: startPosition >= code.length', startPosition, code.length);
          break;
        }
      }

      console.log('Chunking completed, total chunks:', chunks.length);
      return chunks;
    } catch (error) {
      console.error('Error in chunkCode function:', error);
      // Fallback: return single chunk if chunking fails
      return [code];
    }
  };

  // Aggregate results from multiple chunks
  const aggregateChunkResults = (results: AnalyzeReviewResponse[]): AnalyzeReviewResponse => {
    if (results.length === 0) {
      throw new Error('No chunk results to aggregate');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Calculate average score
    const avgScore = Math.round(
      results.reduce((sum, r) => sum + r.overallScore, 0) / results.length
    );

    // Merge issues, removing duplicates based on line number and description
    const allIssues = results.flatMap(r => r.issues);
    const uniqueIssues = allIssues.filter((issue, index, self) => {
      return index === self.findIndex(
        i => i.line === issue.line && i.description === issue.description
      );
    });

    // Combine summaries
    const combinedSummary = results
      .map((r, i) => `Chunk ${i + 1}: ${r.summary}`)
      .join('\n\n');

    return {
      reviewId: '',
      overallScore: avgScore,
      summary: combinedSummary,
      issues: uniqueIssues,
    };
  };

  const handleSubmit = async () => {
    if (!user || !selectedTaskId) return;

    setError(null);
    setIsSubmitting(true);
    setChunkingProgress(null);
    setChunkResults([]);

    const CHUNK_SIZE = 3000;
    const OVERLAP_SIZE = 200;

    // Check if chunking is needed
    if (sourceCode.length <= CHUNK_SIZE) {
      // No chunking needed, single request
      const request: AnalyzeReviewRequest = {
        taskId: parseInt(selectedTaskId),
        requestedBy: parseInt(user.id),
        reviewSource,
        language,
        sourceCode,
      };

      analyzeMutation.mutate(request);
      return;
    }

    // Frontend-based chunking
    try {
      console.log('Starting chunking for code length:', sourceCode.length);
      const chunks = chunkCode(sourceCode, CHUNK_SIZE, OVERLAP_SIZE);
      console.log('Created chunks:', chunks.length);
      
      if (chunks.length === 0) {
        throw new Error('Failed to create chunks from source code');
      }

      setChunkingProgress(`Processing chunk 1 of ${chunks.length}...`);

      const results: AnalyzeReviewResponse[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setChunkingProgress(`Processing chunk ${i + 1} of ${chunks.length}...`);

        const request: AnalyzeReviewRequest = {
          taskId: parseInt(selectedTaskId),
          requestedBy: parseInt(user.id),
          reviewSource,
          language,
          sourceCode: chunks[i],
        };

        try {
          console.log(`Processing chunk ${i + 1}, length:`, chunks[i].length);
          const result = await codeReviewService.analyzeReview(request);
          console.log(`Chunk ${i + 1} result:`, result);
          
          // Validate result structure
          if (!result || typeof result !== 'object') {
            throw new Error(`Invalid result from chunk ${i + 1}`);
          }
          
          results.push(result);
        } catch (err: any) {
          console.error(`Error processing chunk ${i + 1}:`, err);
          setError(`Failed to process chunk ${i + 1}: ${err.response?.data?.message || err.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      setChunkingProgress('Aggregating review results...');

      // Aggregate results
      console.log('Aggregating results:', results.length);
      const aggregatedResult = aggregateChunkResults(results);
      setChunkingProgress('Saving review...');

      // Use the aggregated result directly
      setReviewResult(aggregatedResult);
      setChunkingProgress('Review completed');
      setTimeout(() => setChunkingProgress(null), 2000);
      refetchReviews();

    } catch (err: any) {
      console.error('Error in chunking process:', err);
      setError(err.message || 'Failed to process code chunks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => severityColors[severity as keyof typeof severityColors] || 'default';
  const getSeverityIcon = (severity: string) => severityIcons[severity as keyof typeof severityIcons] || Info;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Code Review</h1>
          <p className="text-muted-foreground">Submit code for AI-powered analysis and review</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Submit Code for Review</CardTitle>
            <CardDescription>Paste your code or select a commit for AI analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task">Select Task</Label>
              {tasksLoading ? (
                <div className="p-2 text-sm text-muted-foreground">Loading tasks...</div>
              ) : tasksError ? (
                <div className="p-2 text-sm text-red-500">Error loading tasks. Please try again.</div>
              ) : (
                <Select value={selectedTaskId} onValueChange={(value) => {
                  console.log('Task selected:', value);
                  setSelectedTaskId(value);
                }}>
                  <SelectTrigger id="task">
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                  <SelectContent>
                    {!tasks || tasks.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No tasks available for this project</div>
                    ) : (
                      Array.isArray(tasks) && tasks.map((task: any) => (
                        <SelectItem key={task.id} value={task.id?.toString()}>
                          {task.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {tasks && tasks.length === 0 && !tasksLoading && (
                <p className="text-sm text-muted-foreground">No tasks found. Please create tasks for this project first.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Review Source</Label>
              <Select value={reviewSource} onValueChange={(value: any) => setReviewSource(value)}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASTED_CODE">Pasted Code</SelectItem>
                  <SelectItem value="COMMIT">Commit</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Programming Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="rust">Rust</SelectItem>
                  <SelectItem value="csharp">C#</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Source Code</Label>
              <Textarea
                id="code"
                placeholder="Paste your code here..."
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {chunkingProgress && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <AlertDescription>{chunkingProgress}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!selectedTaskId || !sourceCode.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {chunkingProgress || 'Analyzing...'}
                </>
              ) : (
                'Submit for Review'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-4">
          {reviewResult && (
            <Card>
              <CardHeader>
                <CardTitle>Review Results</CardTitle>
                <CardDescription>AI-powered code analysis completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Quality Score</Label>
                    <div className="text-4xl font-bold">{reviewResult.overallScore}/10</div>
                  </div>
                  <Badge variant={reviewResult.overallScore >= 7 ? 'default' : 'destructive'}>
                    {reviewResult.overallScore >= 7 ? 'Good' : 'Needs Improvement'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Summary</Label>
                  <p className="text-sm text-muted-foreground">{reviewResult.summary}</p>
                </div>

                <div className="space-y-2">
                  <Label>Issues Found ({reviewResult.issues.length})</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {reviewResult.issues.map((issue, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <span className="text-sm font-medium">Line {issue.line}</span>
                          </div>
                          {React.createElement(getSeverityIcon(issue.severity), { className: "h-4 w-4" })}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Category:</span> {issue.category}
                          </div>
                          <div>
                            <span className="font-medium">Description:</span> {issue.description}
                          </div>
                          <div>
                            <span className="font-medium">Suggestion:</span> {issue.suggestion}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review History */}
          {existingReviews && existingReviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Review History</CardTitle>
                <CardDescription>Previous reviews for this task</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {existingReviews.map((review) => (
                    <div key={review.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={review.status === 'ACCEPTED' ? 'default' : review.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                            {review.status}
                          </Badge>
                          <span className="text-sm">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                        {review.overallScore && (
                          <span className="text-sm">Score: {review.overallScore}/10</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isProjectManager && review.status === 'COMPLETED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveMutation.mutate(review.id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => rejectMutation.mutate(review.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReview(review);
                            setShowReviewDetails(true);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Review Details Dialog */}
      <Dialog open={showReviewDetails} onOpenChange={setShowReviewDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Code Review Details</DialogTitle>
            <DialogDescription>
              Detailed information about this code review
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge variant={selectedReview.status === 'ACCEPTED' ? 'default' : selectedReview.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                    {selectedReview.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Review Source</Label>
                  <div className="text-sm">{selectedReview.reviewSource}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Overall Score</Label>
                  <div className="text-sm font-medium">{selectedReview.overallScore ? `${selectedReview.overallScore}/10` : 'N/A'}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created At</Label>
                  <div className="text-sm">{new Date(selectedReview.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Task ID</Label>
                  <div className="text-sm">{selectedReview.taskId}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested By</Label>
                  <div className="text-sm">User ID: {selectedReview.requestedBy}</div>
                </div>
                {selectedReview.approvedBy && (
                  <div>
                    <Label className="text-sm font-medium">Approved By</Label>
                    <div className="text-sm">User ID: {selectedReview.approvedBy}</div>
                  </div>
                )}
              </div>
              {selectedReview.summary && (
                <div>
                  <Label className="text-sm font-medium">Summary</Label>
                  <div className="text-sm mt-1 p-3 bg-muted rounded">{selectedReview.summary}</div>
                </div>
              )}
              {selectedReview.sourceReference && (
                <div>
                  <Label className="text-sm font-medium">Source Reference</Label>
                  <div className="text-sm">{selectedReview.sourceReference}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
