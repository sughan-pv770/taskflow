import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit2, Trash2, Clock, User, Calendar, Send, Trash } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, Spinner } from '../components/ui';
import TaskModal from '../components/tasks/TaskModal';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import '../components/ui/components.css';
import styles from './TaskDetailPage.module.css';

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef(null);

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get(`/tasks/${id}`).then(r => r.data),
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['task-comments', id],
    queryFn: () => api.get(`/tasks/${id}/comments`).then(r => r.data),
    enabled: !!task,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['task-audit', id],
    queryFn: () => api.get('/admin/audit-logs', { params: { task_id: id, limit: 20 } })
      .then(r => r.data.logs).catch(() => []),
    enabled: isAdmin && !!task,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success('Task deleted.');
      qc.invalidateQueries(['tasks']); qc.invalidateQueries(['task-stats']);
      navigate('/tasks');
    },
    onError: err => toast.error(err.response?.data?.error || 'Delete failed.'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: cid => api.delete(`/tasks/${id}/comments/${cid}`),
    onSuccess: () => { toast.success('Comment removed.'); refetchComments(); },
    onError: err => toast.error(err.response?.data?.error || 'Delete failed.'),
  });

  const canEdit   = isAdmin || task?.creator_id === user?.id || task?.assignee_id === user?.id;
  const canDelete = isAdmin || task?.creator_id === user?.id;

  const handleDelete = () => {
    if (window.confirm(`Delete "${task?.title}"? This cannot be undone.`)) deleteMutation.mutate();
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/tasks/${id}/comments`, { body: comment.trim() });
      setComment('');
      refetchComments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post comment.');
    } finally { setSubmitting(false); }
  };

  if (isLoading) return <div className={styles.center}><span className="spinner-dark"/></div>;
  if (error) return (
    <div className={styles.center}>
      <p style={{color:'var(--rose)'}}>
        {error.response?.status===403?'You do not have permission to view this task.':'Task not found.'}
      </p>
      <Link to="/tasks" className="btn btn-secondary btn-md" style={{marginTop:16}}>← Back</Link>
    </div>
  );

  const formatAction = a => ({
    TASK_CREATED:'Created task', TASK_UPDATED:'Updated task',
    TASK_DELETED:'Deleted task', COMMENT_ADDED:'Added a comment',
  }[a] || a.replace(/_/g,' ').toLowerCase());

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/tasks" className={styles.backLink}><ArrowLeft size={15}/> Tasks</Link>
        {canEdit && (
          <div className={styles.actions}>
            <button className="btn btn-secondary btn-sm" onClick={()=>setShowEdit(true)}><Edit2 size={13}/> Edit</button>
            {canDelete && (
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 size={13}/> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* Main content */}
        <div className={styles.main}>
          <div className="card">
            <div className={styles.taskHeader}>
              <h1 className={styles.taskTitle}>{task.title}</h1>
              <div className={styles.badges}>
                <StatusBadge status={task.status}/>
                <PriorityBadge priority={task.priority}/>
              </div>
            </div>
            {task.description
              ? <p className={styles.desc}>{task.description}</p>
              : <p className={styles.noDesc}>No description provided.</p>
            }
          </div>

          {/* Comments */}
          <div className="card" style={{marginTop:16}}>
            <h3 className={styles.sectionLabel}>
              Discussion <span className={styles.commentCount}>{comments.length}</span>
            </h3>

            {comments.length === 0 && (
              <p className={styles.noComments}>No comments yet. Be the first to add context.</p>
            )}

            <div className={styles.commentList}>
              {comments.map(c => (
                <div key={c.id} className={styles.comment}>
                  <div className={styles.commentAvatar}>{c.author_name?.[0]?.toUpperCase()}</div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>{c.author_name}</span>
                      <span className={styles.commentTime}>
                        {formatDistanceToNow(new Date(c.created_at),{addSuffix:true})}
                      </span>
                    </div>
                    <p className={styles.commentText}>{c.body}</p>
                  </div>
                  {(isAdmin || c.author_id === user?.id) && (
                    <button className={styles.commentDelete}
                      onClick={()=>deleteCommentMutation.mutate(c.id)}
                      title="Delete comment"><Trash size={12}/></button>
                  )}
                </div>
              ))}
            </div>

            {/* Comment form */}
            <form onSubmit={submitComment} className={styles.commentForm}>
              <div className={styles.commentAvatar} style={{flexShrink:0}}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className={styles.commentInputWrap}>
                <textarea
                  ref={textRef}
                  className={`field-input ${styles.commentInput}`}
                  placeholder="Leave a comment or note…"
                  value={comment}
                  onChange={e=>setComment(e.target.value)}
                  rows={2}
                  onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey)submitComment(e);}}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting||!comment.trim()}>
                  {submitting?<span className="spinner"/>:<Send size={13}/>}
                  Post
                </button>
              </div>
            </form>
          </div>

          {/* Audit trail (admins only) */}
          {isAdmin && auditLogs.length > 0 && (
            <div className="card" style={{marginTop:16}}>
              <h3 className={styles.sectionLabel}>Activity Log</h3>
              <div className={styles.timeline}>
                {auditLogs.map(log => (
                  <div key={log.id} className={styles.tlItem}>
                    <div className={styles.tlDot}/>
                    <div className={styles.tlContent}>
                      <div className={styles.tlHeader}>
                        <span className={styles.tlActor}>{log.actor_name}</span>
                        <span className={styles.tlAction}>{formatAction(log.action)}</span>
                      </div>
                      {log.old_values && log.new_values && (
                        <div className={styles.changes}>
                          {Object.keys(log.new_values).map(k=>{
                            const ov=log.old_values?.[k], nv=log.new_values?.[k];
                            if(ov===nv||nv===undefined) return null;
                            return(
                              <span key={k} className={styles.change}>
                                <b>{k.replace(/_/g,' ')}</b>:
                                <s>{String(ov??'—')}</s> → <strong>{String(nv??'—')}</strong>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <span className={styles.tlTime}>{formatDistanceToNow(new Date(log.created_at),{addSuffix:true})}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className="card">
            <h3 className={styles.sectionLabel} style={{marginBottom:14}}>Details</h3>
            {[
              {icon:User,    label:'Assignee', value:task.assignee_name||'Unassigned'},
              {icon:User,    label:'Created by',value:task.creator_name||'—'},
              {icon:Calendar,label:'Due Date',  value:task.due_date?format(new Date(task.due_date),'MMM d, yyyy'):'No due date'},
              {icon:Clock,   label:'Created',   value:formatDistanceToNow(new Date(task.created_at),{addSuffix:true})},
              {icon:Clock,   label:'Updated',   value:formatDistanceToNow(new Date(task.updated_at),{addSuffix:true})},
            ].map(({icon:Icon,label,value})=>(
              <div key={label} className={styles.detail}>
                <div className={styles.detailIcon}><Icon size={13}/></div>
                <div><p className={styles.detailLabel}>{label}</p><p className={styles.detailValue}>{value}</p></div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showEdit && (
        <TaskModal task={task} onClose={()=>setShowEdit(false)} onSuccess={()=>{
          setShowEdit(false);
          qc.invalidateQueries(['task',id]);
          qc.invalidateQueries(['task-audit',id]);
        }}/>
      )}
    </div>
  );
}
