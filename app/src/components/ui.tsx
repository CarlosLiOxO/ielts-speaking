import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

interface AppButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
}

export function AppButton({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, type = 'button', ariaLabel }: AppButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function IconButton({ icon, label, onClick, className = '', disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-35 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      {icon}
    </button>
  );
}

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-[#f7f8fb] text-slate-900 dark:bg-slate-950 dark:text-white ${className}`}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  actions?: ReactNode;
  subtitle?: string;
}

export function PageHeader({ title, onBack, backLabel = '返回', actions, subtitle }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <IconButton icon={<ArrowLeft size={22} aria-hidden="true" />} label={backLabel} onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

interface PageContentProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

const contentWidths = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
};

export function PageContent({ children, maxWidth = 'md', className = '' }: PageContentProps) {
  return <main className={`mx-auto w-full ${contentWidths[maxWidth]} p-4 sm:p-6 ${className}`}>{children}</main>;
}

interface SegmentedFilterProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedFilter<T extends string>({ value, options, onChange, label }: SegmentedFilterProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
            value === option.value
              ? 'bg-blue-500 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface PromptCardProps {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PromptCard({ eyebrow, title, children, action, className = '' }: PromptCardProps) {
  return (
    <section className={`rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">{eyebrow}</p>}
          {title && <h2 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>}
          <div className="text-base leading-relaxed text-slate-700 dark:text-slate-200">{children}</div>
        </div>
        {action}
      </div>
    </section>
  );
}

interface MetricCardProps {
  value: string | number;
  label: string;
  unit?: string;
  tone?: 'blue' | 'green' | 'purple' | 'orange';
}

const metricTone = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-200',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-200',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/25 dark:text-purple-200',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/25 dark:text-orange-200',
};

export function MetricCard({ value, label, unit, tone = 'blue' }: MetricCardProps) {
  return (
    <div className={`rounded-[20px] p-4 text-center ${metricTone[tone]}`}>
      <p className="text-2xl font-bold leading-none">{value}<span className="ml-0.5 text-xs font-semibold">{unit}</span></p>
      <p className="mt-2 text-xs font-medium opacity-75">{label}</p>
    </div>
  );
}
