import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { organizationService, Organization } from '@/services/organizationService';
import { useQuery } from '@tanstack/react-query';

const schema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  methodology: z.string().optional(),
  techStack: z.string().optional(),
  organizationId: z.number().optional(),
});

export type ProjectFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<ProjectFormValues>;
  onSubmit: (data: ProjectFormValues) => Promise<void>;
  isLoading?: boolean;
  isEdit?: boolean;
}

const STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'INACTIVE'];
const METHODOLOGIES = ['AGILE', 'WATERFALL', 'HYBRID'];

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Project name and description' },
  { id: 2, title: 'Organization', description: 'Select organization and status' },
  { id: 3, title: 'Methodology', description: 'Development approach and tech stack' },
  { id: 4, title: 'Timeline', description: 'Project dates' },
  { id: 5, title: 'Review', description: 'Confirm your details' },
];

export default function ProjectWizard({ defaultValues, onSubmit, isLoading = false, isEdit = false }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectName: '',
      description: '',
      status: 'ACTIVE',
      startDate: '',
      endDate: '',
      methodology: '',
      techStack: '',
      organizationId: undefined,
      ...defaultValues,
    },
  });

  const formData = watch();

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
  });
  const orgs: Organization[] = orgsData?.data || [];

  const inputClass = 'w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm';
  const labelClass = 'block text-sm font-medium text-white mb-1.5';
  const errorClass = 'text-xs text-red-400 mt-1';

  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.projectName?.trim().length > 0;
      case 2: return formData.organizationId && formData.organizationId > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const onFormSubmit = async (data: ProjectFormValues) => {
    // For intermediate steps, just proceed without full validation
    if (currentStep < STEPS.length) {
      nextStep();
    } else {
      // Final step - submit the form
      await onSubmit(data);
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Project Name *</label>
              <input className={inputClass} placeholder="e.g. Phoenix v2.0" {...register('projectName')} />
              {errors.projectName && <p className={errorClass}>{errors.projectName.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="Brief description of the project..."
                {...register('description')}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            {!isEdit && (
              <div>
                <label className={labelClass}>Organization *</label>
                <select
                  className={inputClass}
                  {...register('organizationId', { valueAsNumber: true })}
                >
                  <option value={0}>Select an organization...</option>
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {errors.organizationId && <p className={errorClass}>{errors.organizationId.message}</p>}
              </div>
            )}
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} {...register('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Methodology</label>
              <select className={inputClass} {...register('methodology')}>
                <option value="">Select methodology...</option>
                {METHODOLOGIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tech Stack</label>
              <input
                className={inputClass}
                placeholder="e.g. React, Node.js, PostgreSQL (comma-separated)"
                {...register('techStack')}
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" className={inputClass} {...register('startDate')} />
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <input type="date" className={inputClass} {...register('endDate')} />
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-background/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Project Name:</span>
                <span className="text-white text-sm font-medium">{formData.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Description:</span>
                <span className="text-white text-sm font-medium max-w-xs truncate">{formData.description || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Organization:</span>
                <span className="text-white text-sm font-medium">{orgs.find(o => o.id === formData.organizationId)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Status:</span>
                <span className="text-white text-sm font-medium">{formData.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Methodology:</span>
                <span className="text-white text-sm font-medium">{formData.methodology || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Tech Stack:</span>
                <span className="text-white text-sm font-medium max-w-xs truncate">{formData.techStack || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Start Date:</span>
                <span className="text-white text-sm font-medium">{formData.startDate || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">End Date:</span>
                <span className="text-white text-sm font-medium">{formData.endDate || '—'}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep > step.id
                  ? 'bg-emerald-500 text-white'
                  : currentStep === step.id
                  ? 'bg-primary text-white'
                  : 'bg-border text-muted-foreground'
              }`}>
                {currentStep > step.id ? <CheckCircle2 className="w-4 h-4" /> : step.id}
              </div>
              <p className={`text-xs mt-2 text-center ${
                currentStep >= step.id ? 'text-white' : 'text-muted-foreground'
              }`}>{step.title}</p>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                currentStep > step.id ? 'bg-emerald-500' : 'bg-border'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white">{STEPS[currentStep - 1].title}</h3>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
        </div>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          {getStepContent()}
          
          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            <button
              type="button"
              onClick={currentStep === STEPS.length ? handleSubmit(onSubmit) : nextStep}
              disabled={!canProceed() || isLoading}
              className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {currentStep === STEPS.length ? (isEdit ? 'Save Changes' : 'Create Project') : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
