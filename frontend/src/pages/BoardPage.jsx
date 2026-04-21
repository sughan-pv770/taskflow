import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, MoreHorizontal, Calendar, User } from 'lucide-react';
import api from '../utils/api';
import { PriorityBadge, Spinner, PageHeader } from '../components/ui';
import TaskModal from '../components/tasks/TaskModal';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';
import '../components/ui/components.css';
import styles from './BoardPage.module.css';

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: 'var(--s-todo)',     bg: 'var(--s-todo-bg)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--s-progress)', bg: 'var(--s-progress-bg)' },
  { id: 'in_review',   label: 'In Review',   color: 'var(--s-review)',   bg: 'var(--s-review-bg)' },
  { id: 'done',        label: 'Done',        color: 'var(--s-done)',     bg: 'var(--s-done-bg)' },
];

export default function BoardPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState('todo');
  const [dragging, setDragging] = useState(null);      // { taskId, fromStatus }
  const [dragOver, setDragOver] = useState(null);      // status column id
  const dragItem = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks-board'],
    queryFn: () => api.get('/tasks', { params: { limit: 200 } }).then(r => r.data),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      // Optimistic update
      await qc.cancelQueries(['tasks-board']);
      const prev = qc.getQueryData(['tasks-board']);
      qc.setQueryData(['tasks-board'], old => ({
        ...old,
        tasks: old.tasks.map(t => t.id === id ? { ...t, status } : t),
      }));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(['tasks-board'], ctx.prev);
      toast.error('Failed to move task.');
    },
    onSettled: () => {
      qc.invalidateQueries(['tasks-board']);
      qc.invalidateQueries(['task-stats']);
    },
  });

  const tasksByStatus = (status) =>
    (data?.tasks || []).filter(t => t.status === status);

  /* ─── Drag handlers ─── */
  const onDragStart = (e, task) => {
    dragItem.current = task;
    setDragging({ taskId: task.id, fromStatus: task.status });
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colId);
  };

  const onDrop = (e, colId) => {
    e.preventDefault();
    const task = dragItem.current;
    if (task && task.status !== colId) {
      moveMutation.mutate({ id: task.id, status: colId });
    }
    setDragging(null);
    setDragOver(null);
    dragItem.current = null;
  };

  const onDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  const openCreate = (status) => {
    setDefaultStatus(status);
    setShowModal(true);
  };

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <span className="spinner-dark" />
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Board"
        subtitle="Drag tasks between columns to update their status"
        action={
          <button className="btn btn-primary btn-md" onClick={() => openCreate('todo')}>
            <Plus size={15} /> New Task
          </button>
        }
      />

      <div className={styles.board}>
        {COLUMNS.map(col => {
          const tasks = tasksByStatus(col.id);
          const isOver = dragOver === col.id;

          return (
            <div
              key={col.id}
              className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
              onDragOver={e => onDragOver(e, col.id)}
              onDrop={e => onDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={styles.colHeader}>
                <div className={styles.colHeaderLeft}>
                  <div className={styles.colDot} style={{ background: col.color }} />
                  <span className={styles.colLabel}>{col.label}</span>
                  <span className={styles.colCount} style={{ background: col.bg, color: col.color }}>
                    {tasks.length}
                  </span>
                </div>
                <button
                  className={styles.addColBtn}
                  onClick={() => openCreate(col.id)}
                  title={`Add to ${col.label}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Task cards */}
              <div className={styles.cards}>
                {tasks.length === 0 && (
                  <div className={`${styles.emptyCol} ${isOver ? styles.emptyColOver : ''}`}>
                    <span>Drop tasks here</span>
                  </div>
                )}

                {tasks.map(task => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) &&
                    !['done', 'cancelled'].includes(task.status);
                  const isDraggingThis = dragging?.taskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`${styles.card} ${isDraggingThis ? styles.cardDragging : ''}`}
                      draggable
                      onDragStart={e => onDragStart(e, task)}
                      onDragEnd={onDragEnd}
                    >
                      <div className={styles.cardTop}>
                        <PriorityBadge priority={task.priority} />
                        <Link to={`/tasks/${task.id}`} className={styles.cardMenuBtn} title="Open task">
                          <MoreHorizontal size={14} />
                        </Link>
                      </div>

                      <Link to={`/tasks/${task.id}`} className={styles.cardTitle}>
                        {task.title}
                      </Link>

                      {task.description && (
                        <p className={styles.cardDesc}>
                          {task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}
                        </p>
                      )}

                      <div className={styles.cardMeta}>
                        {task.assignee_name && (
                          <span className={styles.cardAssignee}>
                            <span className={styles.miniAvatar}>
                              {task.assignee_name[0].toUpperCase()}
                            </span>
                            {task.assignee_name.split(' ')[0]}
                          </span>
                        )}
                        {task.due_date && (
                          <span className={`${styles.cardDue} ${overdue ? styles.cardDueOverdue : ''}`}>
                            <Calendar size={11} />
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <TaskModal
          task={null}
          defaultStatus={defaultStatus}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries(['tasks-board']);
            qc.invalidateQueries(['task-stats']);
          }}
        />
      )}
    </div>
  );
}
