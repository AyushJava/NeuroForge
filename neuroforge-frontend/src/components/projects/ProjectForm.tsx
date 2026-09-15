import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
  organizationId: z.number({ invalid_type_error: 'Organization is required' }).min(1, 'Organization is required'),
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

export default function ProjectForm({ defaultValues, onSubmit, isLoading = false, isEdit = false }: Props) {
  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectName: '',
      description: '',
      status: 'ACTIVE',
      startDate: '',
      endDate: '',
      methodology: '',
      techStack: '',
      organizationId: 0,
      ...defaultValues,
    },
  });

  // Reset when defaultValues change (edit mode)
  useEffect(() => {
    if (defaultValues) reset({ projectName: '', description: '', status: 'ACTIVE', startDate: '', endDate: '', methodology: '', techStack: '', organizationId: 0, ...defaultValues });
  }, [JSON.stringify(defaultValues)]);

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
  });
  const orgs: Organization[] = orgsData?.data || [];

  const inputClass = 'w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm';
  const labelClass = 'block text-sm font-medium text-white mb-1.5';
  const errorClass = 'text-xs text-red-400 mt-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Project Name */}
      <div>
        <label className={labelClass}>Project Name *</label>
        <input className={inputClass} placeholder="e.g. Phoenix v2.0" {...register('projectName')} />
        {errors.projectName && <p className={errorClass}>{errors.projectName.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="Brief description of the project..."
          {...register('description')}
        />
      </div>

      {/* Organization */}
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

      {/* Status */}
      <div>
        <label className={labelClass}>Status</label>
        <select className={inputClass} {...register('status')}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Methodology */}
      <div>
        <label className={labelClass}>Methodology</label>
        <select className={inputClass} {...register('methodology')}>
          <option value="">Select methodology...</option>
          {METHODOLOGIES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Tech Stack */}
      <div>
        <label className={labelClass}>Tech Stack</label>
        <input
          className={inputClass}
          placeholder="e.g. React, Node.js, PostgreSQL (comma-separated)"
          {...register('techStack')}
        />
      </div>

      {/* Dates */}
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

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-white font-medium rounded-lg py-3 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isEdit ? 'Save Changes' : 'Create Project'}
      </button>
    </form>
  );
}
