import React from 'react';

export const Button = ({ children, variant='primary', size='md', loading=false, disabled=false, className='', ...props }) => (
  <button className={`btn btn-${variant} btn-${size} ${className}`} disabled={disabled||loading} {...props}>
    {loading && <span className="spinner"/>}{children}
  </button>
);

export const StatusBadge = ({ status }) => {
  const map = {
    todo:        { label:'To Do',       cls:'badge-todo' },
    in_progress: { label:'In Progress', cls:'badge-inprogress' },
    in_review:   { label:'In Review',   cls:'badge-inreview' },
    done:        { label:'Done',        cls:'badge-done' },
    cancelled:   { label:'Cancelled',   cls:'badge-cancelled' },
  };
  const { label, cls } = map[status] || { label: status, cls: '' };
  return <span className={`badge ${cls}`}>{label}</span>;
};

export const PriorityBadge = ({ priority }) => {
  const map = {
    low:      { label:'Low',      cls:'badge-low' },
    medium:   { label:'Medium',   cls:'badge-medium' },
    high:     { label:'High',     cls:'badge-high' },
    critical: { label:'Critical', cls:'badge-critical' },
  };
  const { label, cls } = map[priority] || { label: priority, cls: '' };
  return <span className={`badge ${cls}`}>{label}</span>;
};

export const Input = React.forwardRef(({ label, error, ...props }, ref) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    <input ref={ref} className={`field-input ${error ? 'field-input-error' : ''}`} {...props}/>
    {error && <span className="field-error">{error}</span>}
  </div>
));

export const Select = React.forwardRef(({ label, error, children, ...props }, ref) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    <select ref={ref} className={`field-input ${error ? 'field-input-error' : ''}`} {...props}>{children}</select>
    {error && <span className="field-error">{error}</span>}
  </div>
));

export const Textarea = React.forwardRef(({ label, error, ...props }, ref) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    <textarea ref={ref} className={`field-input ${error ? 'field-input-error' : ''}`} {...props}/>
    {error && <span className="field-error">{error}</span>}
  </div>
));

export const Card = ({ children, className='', ...props }) => (
  <div className={`card ${className}`} {...props}>{children}</div>
);

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-icon">{icon}</div>}
    <h3 className="empty-title">{title}</h3>
    {description && <p className="empty-desc">{description}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

export const Spinner = ({ size=24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{animation:'spin .8s linear infinite',flexShrink:0}}>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="3"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {action && <div className="page-action">{action}</div>}
  </div>
);
