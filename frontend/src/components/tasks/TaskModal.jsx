import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import '../../components/ui/components.css';
import styles from './TaskModal.module.css';

export default function TaskModal({ task, defaultStatus = 'todo', onClose, onSuccess }) {
  const isEdit = !!task;

  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    status:      task?.status      || defaultStatus,
    priority:    task?.priority    || 'medium',
    assignee_id: task?.assignee_id || '',
    due_date:    task?.due_date    ? task.due_date.slice(0, 10) : '',
  });
  const [errors, setErrors] = useState({});

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/admin/users/org').then(r => r.data),
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const mutation = useMutation({
    mutationFn: payload =>
      isEdit
        ? api.patch(`/tasks/${task.id}`, payload).then(r => r.data)
        : api.post('/tasks', payload).then(r => r.data),
    onSuccess: () => { toast.success(isEdit ? 'Task updated.' : 'Task created.'); onSuccess(); },
    onError: err => {
      const d = err.response?.data;
      if (d?.details) {
        const fe = {};
        d.details.forEach(({ field, message }) => { fe[field] = message; });
        setErrors(fe);
      } else toast.error(d?.error || 'Something went wrong.');
    },
  });

  const handleSubmit = ev => {
    ev.preventDefault();
    if (!validate()) return;
    mutation.mutate({ ...form, assignee_id: form.assignee_id || null, due_date: form.due_date || null });
  };

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={17}/></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.body} noValidate>
          <div className="field">
            <label className="field-label">Title <span style={{color:'var(--rose)'}}>*</span></label>
            <input
              className={`field-input ${errors.title ? 'field-input-error' : ''}`}
              type="text" placeholder="What needs to be done?"
              value={form.title} onChange={set('title')} autoFocus
            />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          <div className="field">
            <label className="field-label">Description</label>
            <textarea
              className="field-input" placeholder="Add more detail, context, or acceptance criteria…"
              value={form.description} onChange={set('description')} rows={3}
            />
          </div>

          <div className={styles.row}>
            <div className="field">
              <label className="field-label">Status</label>
              <select className="field-input" value={form.status} onChange={set('status')}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Priority</label>
              <select className="field-input" value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className="field">
              <label className="field-label">Assignee</label>
              <select className="field-input" value={form.assignee_id} onChange={set('assignee_id')}>
                <option value="">Unassigned</option>
                {orgUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Due Date</label>
              <input className="field-input" type="date" value={form.due_date} onChange={set('due_date')}/>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-md" disabled={mutation.isPending}>
              {mutation.isPending ? <span className="spinner"/> : null}
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
