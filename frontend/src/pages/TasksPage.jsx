import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, SlidersHorizontal, Kanban } from 'lucide-react';
import api from '../utils/api';
import { StatusBadge, PriorityBadge, EmptyState, Spinner, PageHeader } from '../components/ui';
import TaskModal from '../components/tasks/TaskModal';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import '../components/ui/components.css';
import styles from './TasksPage.module.css';

const STATUSES   = ['todo','in_progress','in_review','done','cancelled'];
const PRIORITIES = ['low','medium','high','critical'];

export default function TasksPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);

  const filters = {
    status:   searchParams.get('status')   || '',
    priority: searchParams.get('priority') || '',
    search:   searchParams.get('search')   || '',
    page:     parseInt(searchParams.get('page') || '1'),
    sort_by:  searchParams.get('sort_by')  || 'created_at',
    sort_dir: searchParams.get('sort_dir') || 'desc',
  };

  const setFilter = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.get('/tasks', { params: { ...filters, limit: 15 } }).then(r => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/tasks/${id}`),
    onSuccess: () => { toast.success('Task deleted.'); qc.invalidateQueries(['tasks']); qc.invalidateQueries(['task-stats']); },
    onError:   err => toast.error(err.response?.data?.error || 'Delete failed.'),
  });

  const handleDelete = task => {
    if (window.confirm(`Delete "${task.title}"?`)) deleteMutation.mutate(task.id);
  };

  const openEdit  = task  => { setEditTask(task); setShowModal(true); };
  const closeModal = ()   => { setShowModal(false); setEditTask(null); };
  const hasFilters = filters.status || filters.priority || filters.search;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Tasks"
        subtitle={data ? `${data.pagination.total} task${data.pagination.total !== 1 ? 's' : ''}` : ''}
        action={
          <div style={{display:'flex',gap:8}}>
            <Link to="/board" className="btn btn-secondary btn-md"><Kanban size={15}/> Board</Link>
            <button className="btn btn-primary btn-md" onClick={() => setShowModal(true)}>
              <Plus size={15}/> New Task
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon}/>
          <input
            className={styles.searchInput} type="text"
            placeholder="Search by title or description…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
          {filters.search && (
            <button className={styles.clearBtn} onClick={() => setFilter('search', '')}>
              <X size={13}/>
            </button>
          )}
        </div>

        <div className={styles.filterRow}>
          <select className={styles.filterSelect} value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>

          <select className={styles.filterSelect} value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>

          <select
            className={styles.filterSelect}
            value={`${filters.sort_by}:${filters.sort_dir}`}
            onChange={e => {
              const [by, dir] = e.target.value.split(':');
              const n = new URLSearchParams(searchParams);
              n.set('sort_by', by); n.set('sort_dir', dir);
              setSearchParams(n);
            }}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="due_date:asc">Due date ↑</option>
            <option value="due_date:desc">Due date ↓</option>
            <option value="priority:desc">Priority ↓</option>
            <option value="updated_at:desc">Recently updated</option>
          </select>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearchParams({})}>
              <X size={13}/> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.loadingArea}><span className="spinner-dark"/></div>
        ) : data?.tasks?.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal size={22}/>}
            title="No tasks found"
            description={hasFilters ? 'Try adjusting your filters.' : 'Create your first task to get started.'}
            action={<button className="btn btn-primary btn-md" onClick={() => setShowModal(true)}><Plus size={15}/> New Task</button>}
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody className={isFetching ? styles.dimmed : ''}>
              {data?.tasks?.map(task => {
                const overdue = task.due_date && isPast(new Date(task.due_date)) && !['done','cancelled'].includes(task.status);
                return (
                  <tr key={task.id}>
                    <td>
                      <Link to={`/tasks/${task.id}`} className={styles.taskLink}>{task.title}</Link>
                      {task.description && (
                        <p className={styles.taskDesc}>{task.description.slice(0,70)}{task.description.length>70?'…':''}</p>
                      )}
                    </td>
                    <td><StatusBadge status={task.status}/></td>
                    <td><PriorityBadge priority={task.priority}/></td>
                    <td><span className={styles.assignee}>{task.assignee_name || <em className={styles.unassigned}>—</em>}</span></td>
                    <td>
                      <span className={overdue ? styles.overdue : styles.dueDate}>
                        {task.due_date ? format(new Date(task.due_date), 'MMM d') : '—'}
                        {overdue && ' ⚠'}
                      </span>
                    </td>
                    <td className={styles.updated}>{formatDistanceToNow(new Date(task.updated_at),{addSuffix:true})}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(task)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task)} disabled={deleteMutation.isPending}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button className="btn btn-secondary btn-sm" disabled={filters.page<=1} onClick={() => setFilter('page', filters.page-1)}>← Prev</button>
          <span className={styles.pageInfo}>Page {filters.page} of {data.pagination.totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={filters.page>=data.pagination.totalPages} onClick={() => setFilter('page', filters.page+1)}>Next →</button>
        </div>
      )}

      {showModal && (
        <TaskModal task={editTask} onClose={closeModal} onSuccess={() => {
          closeModal();
          qc.invalidateQueries(['tasks']);
          qc.invalidateQueries(['task-stats']);
        }}/>
      )}
    </div>
  );
}
