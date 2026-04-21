import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Zap, CircleDot, TrendingUp, Plus, AlertTriangle, BarChart2 } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, Spinner, PageHeader } from '../components/ui';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import '../components/ui/components.css';
import styles from './DashboardPage.module.css';

const STATUS_META = {
  todo:        { label:'To Do',       icon:CircleDot,    color:'var(--s-todo)',     bg:'var(--s-todo-bg)' },
  in_progress: { label:'In Progress', icon:TrendingUp,   color:'var(--s-progress)', bg:'var(--s-progress-bg)' },
  in_review:   { label:'In Review',   icon:Zap,          color:'var(--s-review)',   bg:'var(--s-review-bg)' },
  done:        { label:'Done',        icon:CheckCircle2, color:'var(--s-done)',      bg:'var(--s-done-bg)' },
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data:stats, isLoading } = useQuery({
    queryKey:['task-stats'],
    queryFn:()=>api.get('/tasks/stats').then(r=>r.data),
  });

  if (isLoading) return <div className={styles.center}><span className="spinner-dark"/></div>;

  const total = Object.values(stats?.statusCounts||{}).reduce((a,b)=>a+b,0);

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0]}`}
        subtitle={`${user?.orgName} · ${user?.role === 'admin' ? 'Administrator' : 'Team Member'}`}
        action={
          <Link to="/tasks" className="btn btn-primary btn-md">
            <Plus size={15}/> New Task
          </Link>
        }
      />

      {/* KPI cards */}
      <div className={styles.kpiGrid}>
        {Object.entries(STATUS_META).map(([key, m]) => {
          const Icon = m.icon;
          const count = stats?.statusCounts?.[key] || 0;
          return (
            <Link to={`/tasks?status=${key}`} key={key} className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{background:m.bg,color:m.color}}>
                <Icon size={18}/>
              </div>
              <div className={styles.kpiBody}>
                <span className={styles.kpiCount}>{count}</span>
                <span className={styles.kpiLabel}>{m.label}</span>
              </div>
              {key==='in_progress' && count>0 && <div className={styles.kpiPulse}/>}
            </Link>
          );
        })}

        <div className={styles.kpiCard} style={{cursor:'default'}}>
          <div className={styles.kpiIconWrap} style={{background:'var(--rose-light)',color:'var(--rose)'}}>
            <AlertTriangle size={18}/>
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiCount} style={stats?.overdueCount>0?{color:'var(--rose)'}:{}}>
              {stats?.overdueCount||0}
            </span>
            <span className={styles.kpiLabel}>Overdue</span>
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        {/* Recent activity */}
        <div className="card">
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Recent Activity</h3>
            <Link to="/tasks" className="btn btn-ghost btn-sm">View all →</Link>
          </div>

          {stats?.recentTasks?.length > 0 ? (
            <div className={styles.activityList}>
              {stats.recentTasks.map(task => (
                <Link key={task.id} to={`/tasks/${task.id}`} className={styles.activityRow}>
                  <div className={styles.activityLeft}>
                    <StatusBadge status={task.status}/>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityTitle}>{task.title}</span>
                      {task.assignee_name && <span className={styles.activityMeta}>→ {task.assignee_name}</span>}
                    </div>
                  </div>
                  <span className={styles.activityTime}>
                    {formatDistanceToNow(new Date(task.updated_at),{addSuffix:true})}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>No tasks yet. <Link to="/tasks">Create your first task →</Link></p>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="card">
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Priority Breakdown</h3>
            <span className={styles.totalPill}>{total} total</span>
          </div>

          <div className={styles.priorityChart}>
            {[
              {key:'critical',label:'Critical',color:'var(--p-critical)'},
              {key:'high',    label:'High',    color:'var(--p-high)'},
              {key:'medium',  label:'Medium',  color:'var(--p-medium)'},
              {key:'low',     label:'Low',     color:'var(--p-low)'},
            ].map(({key,label,color})=>{
              const count = stats?.priorityCounts?.[key]||0;
              const pct = total>0?(count/total)*100:0;
              return (
                <div key={key} className={styles.pRow}>
                  <span className={styles.pLabel}>{label}</span>
                  <div className={styles.pTrack}>
                    <div className={styles.pFill} style={{width:`${pct}%`,background:color}}/>
                  </div>
                  <span className={styles.pCount}>{count}</span>
                </div>
              );
            })}
          </div>

          <Link to="/board" className={styles.boardLink}>
            <BarChart2 size={14}/> View Kanban Board →
          </Link>
        </div>
      </div>
    </div>
  );
}
