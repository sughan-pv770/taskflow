import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, ClipboardList, Mail, Plus, X, Copy, Check } from 'lucide-react';
import api from '../utils/api';
import { Spinner, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import '../components/ui/components.css';
import styles from './AdminPage.module.css';

const TABS = [
  { id:'users',  label:'Team',       icon:Users },
  { id:'invites',label:'Invites',    icon:Mail },
  { id:'audit',  label:'Audit Log',  icon:ClipboardList },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  return (
    <div className={styles.page}>
      <PageHeader title="Admin" subtitle="Manage your organization"/>
      <div className={styles.tabs}>
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} className={`${styles.tab} ${tab===id?styles.tabActive:''}`} onClick={()=>setTab(id)}>
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>
      {tab==='users'  && <UsersTab/>}
      {tab==='invites'&& <InvitesTab/>}
      {tab==='audit'  && <AuditTab/>}
    </div>
  );
}

function InviteLinkBox({ inviteResult, onClose }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/accept-invite?token=${inviteResult.token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      const el = document.getElementById('invite-url-input');
      if (el) { el.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    });
  };

  return (
    <div style={{ padding:'16px', background:'var(--c-surface3)', borderRadius:10, border:'1px solid var(--c-border)', marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--c-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Mail size={14} color="#fff"/>
          </div>
          <p style={{ fontWeight:600, color:'var(--c-text-primary)', margin:0, fontSize:'0.9rem' }}>✅ Invite Link Created</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding:4 }}><X size={13}/></button>
      </div>

      <div style={{ background:'var(--c-surface)', border:'1px solid var(--c-border)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:'0.82rem', color:'var(--c-text-secondary)', lineHeight:1.6 }}>
        <p style={{ margin:'0 0 4px 0', fontWeight:600, color:'var(--c-text-primary)' }}>
          How to add <strong>{inviteResult.email}</strong> as a member:
        </p>
        <ol style={{ margin:0, paddingLeft:18 }}>
          <li>Click <strong>"Copy Link"</strong> below to copy the invite URL.</li>
          <li>Send the link to <strong>{inviteResult.email}</strong> via email, chat, or any messenger.</li>
          <li>They open the link, set their name &amp; password, and join your workspace instantly.</li>
        </ol>
        <p style={{ margin:'6px 0 0 0', color:'var(--c-text-muted)', fontSize:'0.78rem' }}>
          🔒 This link expires in <strong>7 days</strong> and can only be used once.
        </p>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
        <div
          id="invite-url-display"
          style={{ flex:1, background:'var(--c-surface)', border:'1px solid var(--c-border)', borderRadius:7, padding:'8px 10px', fontFamily:'monospace', fontSize:'0.78rem', color:'var(--c-text-secondary)', wordBreak:'break-all', overflowWrap:'anywhere', lineHeight:1.5, userSelect:'all', cursor:'text' }}
          onClick={() => { const sel=window.getSelection(); const r=document.createRange(); r.selectNodeContents(document.getElementById('invite-url-display')); sel.removeAllRanges(); sel.addRange(r); }}
        >
          {inviteUrl}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`btn btn-sm ${copied?'btn-secondary':'btn-primary'}`}
          style={{ minWidth:100, display:'flex', alignItems:'center', gap:6, alignSelf:'stretch' }}
        >
          {copied ? <><Check size={13}/> Copied!</> : <><Copy size={13}/> Copy Link</>}
        </button>
      </div>

      <input id="invite-url-input" readOnly value={inviteUrl} style={{ position:'absolute', left:'-9999px' }}/>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({email:'',role:'member'});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const { data:users=[], isLoading } = useQuery({
    queryKey:['admin-users'],
    queryFn:()=>api.get('/admin/users').then(r=>r.data),
  });

  const roleMutation = useMutation({
    mutationFn:({id,role})=>api.patch(`/admin/users/${id}/role`,{role}),
    onSuccess:()=>{ toast.success('Role updated.'); qc.invalidateQueries(['admin-users']); },
    onError:err=>toast.error(err.response?.data?.error||'Failed.'),
  });

  const deactivateMutation = useMutation({
    mutationFn:id=>api.patch(`/admin/users/${id}/deactivate`),
    onSuccess:()=>{ toast.success('User deactivated.'); qc.invalidateQueries(['admin-users']); },
    onError:err=>toast.error(err.response?.data?.error||'Failed.'),
  });

  const activateMutation = useMutation({
    mutationFn:id=>api.patch(`/admin/users/${id}/activate`),
    onSuccess:()=>{ toast.success('User activated.'); qc.invalidateQueries(['admin-users']); },
    onError:err=>toast.error(err.response?.data?.error||'Failed.'),
  });

  const handleInvite = async e => {
    e.preventDefault();
    if (!inviteForm.email) return;
    setInviteLoading(true);
    try {
      const { data } = await api.post('/admin/invites', inviteForm);
      toast.success('Invite created successfully.');
      setInviteResult(data);
      qc.invalidateQueries(['admin-invites']);
    } catch(err) { toast.error(err.response?.data?.error||'Failed.'); }
    finally { setInviteLoading(false); }
  };

  const closeInvite = () => {
    setShowInvite(false);
    setInviteResult(null);
    setInviteForm({email:'',role:'member'});
  };

  if (isLoading) return <div className={styles.loadArea}><span className="spinner-dark"/></div>;

  return (
    <div>
      <div className={styles.sectionHead}>
        <span className={styles.sectionCount}>{users.length} member{users.length!==1?'s':''}</span>
        <button className="btn btn-primary btn-sm" onClick={()=>{setShowInvite(v=>!v); setInviteResult(null);}}>
          <Plus size={13}/> Invite
        </button>
      </div>

      {showInvite && (
        <div className={styles.inviteBox}>
          {!inviteResult ? (
            <form onSubmit={handleInvite} className={styles.inviteRow}>
              <input className="field-input" style={{flex:1}} type="email"
                placeholder="colleague@company.com" value={inviteForm.email}
                onChange={e=>setInviteForm(f=>({...f,email:e.target.value}))} required/>
              <select className="field-input" style={{width:'auto'}}
                value={inviteForm.role} onChange={e=>setInviteForm(f=>({...f,role:e.target.value}))}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={inviteLoading}>
                {inviteLoading?<span className="spinner"/>:'Send'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeInvite}><X size={13}/></button>
            </form>
          ) : (
            <InviteLinkBox inviteResult={inviteResult} onClose={closeInvite} />
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.userAvatar}>{u.name?.[0]?.toUpperCase()}</div>
                    <div>
                      <p className={styles.userName}>{u.name}</p>
                      <p className={styles.userEmail}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${u.role==='admin'?'badge-inreview':'badge-todo'}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`badge ${u.is_active?'badge-done':'badge-cancelled'}`}>
                    {u.is_active?'Active':'Inactive'}
                  </span>
                </td>
                <td className={styles.dateCell}>{formatDistanceToNow(new Date(u.created_at),{addSuffix:true})}</td>
                <td>
                  <div className={styles.rowActions}>
                    <select className={styles.roleSelect} value={u.role}
                      onChange={e=>{ if(window.confirm(`Change ${u.name} to ${e.target.value}?`)) roleMutation.mutate({id:u.id,role:e.target.value}); }}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    {u.is_active ? (
                      <button className="btn btn-danger btn-sm"
                        onClick={()=>{ if(window.confirm(`Deactivate ${u.name}?`)) deactivateMutation.mutate(u.id); }}>
                        Deactivate
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm"
                        onClick={()=>{ if(window.confirm(`Activate ${u.name}?`)) activateMutation.mutate(u.id); }}>
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvitesTab() {
  const { data:invites=[], isLoading } = useQuery({
    queryKey:['admin-invites'],
    queryFn:()=>api.get('/admin/invites').then(r=>r.data),
  });
  if (isLoading) return <div className={styles.loadArea}><span className="spinner-dark"/></div>;
  return (
    <div>
      <div className={styles.sectionHead}>
        <span className={styles.sectionCount}>{invites.length} invite{invites.length!==1?'s':''}</span>
      </div>
      {invites.length===0
        ? <p style={{color:'var(--text-muted)',fontSize:13,padding:'16px 0',fontStyle:'italic'}}>No invites sent yet.</p>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Email</th><th>Role</th><th>Invited By</th><th>Status</th><th>Expires</th></tr></thead>
              <tbody>
                {invites.map(inv=>(
                  <tr key={inv.id}>
                    <td style={{fontWeight:500}}>{inv.email}</td>
                    <td><span className={`badge ${inv.role==='admin'?'badge-inreview':'badge-todo'}`}>{inv.role}</span></td>
                    <td className={styles.dateCell}>{inv.invited_by_name||'—'}</td>
                    <td>
                      <span className={`badge ${inv.used_at?'badge-done':new Date(inv.expires_at)<new Date()?'badge-cancelled':'badge-inprogress'}`}>
                        {inv.used_at?'Accepted':new Date(inv.expires_at)<new Date()?'Expired':'Pending'}
                      </span>
                    </td>
                    <td className={styles.dateCell}>{format(new Date(inv.expires_at),'MMM d, yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

function AuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey:['audit-logs',page],
    queryFn:()=>api.get('/admin/audit-logs',{params:{page,limit:25}}).then(r=>r.data),
    keepPreviousData:true,
  });

  const actionColor = a => {
    if (a.includes('CREATED')||a.includes('JOINED')) return 'badge-done';
    if (a.includes('DELETED')||a.includes('DEACTIVATED')) return 'badge-cancelled';
    if (a.includes('UPDATED')||a.includes('CHANGED')) return 'badge-inprogress';
    if (a.includes('INVITED')) return 'badge-inreview';
    return 'badge-todo';
  };

  if (isLoading) return <div className={styles.loadArea}><span className="spinner-dark"/></div>;

  return (
    <div>
      <div className={styles.sectionHead}>
        <span className={styles.sectionCount}>{data?.pagination?.total||0} entries</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Actor</th><th>Action</th><th>Details</th><th>When</th></tr></thead>
          <tbody>
            {data?.logs?.map(log=>(
              <tr key={log.id}>
                <td>
                  <p style={{fontSize:13,fontWeight:500}}>{log.actor_name}</p>
                  <p style={{fontSize:11.5,color:'var(--text-muted)'}}>{log.actor_email}</p>
                </td>
                <td>
                  <span className={`badge ${actionColor(log.action)}`} style={{fontSize:11}}>
                    {log.action.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
                  </span>
                </td>
                <td>
                  {log.new_values && (
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>
                      {Object.entries(log.new_values).slice(0,2).map(([k,v])=>(
                        <span key={k} style={{marginRight:8}}>
                          <b style={{color:'var(--text-secondary)'}}>{k.replace(/_/g,' ')}:</b> {String(v??'—').slice(0,40)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={styles.dateCell} title={format(new Date(log.created_at),'PPpp')}>
                  {formatDistanceToNow(new Date(log.created_at),{addSuffix:true})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.pagination?.totalPages>1 && (
        <div className={styles.pagination}>
          <button className="btn btn-secondary btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{fontSize:13,color:'var(--text-muted)'}}>Page {page} of {data.pagination.totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page>=data.pagination.totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
