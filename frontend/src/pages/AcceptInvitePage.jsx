import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import '../components/ui/components.css';
import styles from './AuthPage.module.css';

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [form, setForm] = useState({ name: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (!token) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-base)'}}>
      <p style={{color:'var(--rose)'}}>Invalid invite link. <Link to="/login">Go to login</Link></p>
    </div>
  );

  const handleSubmit = async ev => {
    ev.preventDefault();
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Include at least one uppercase letter.';
    else if (!/[0-9]/.test(form.password)) e.password = 'Include at least one number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/accept-invite', { token, ...form });
      localStorage.setItem('tf_token', data.token);
      localStorage.setItem('tf_user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept invite.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>T</div>
          <span className={styles.logoName}>Taskflow</span>
        </div>
        <h2 className={styles.heading}>You've been invited</h2>
        <p className={styles.sub}>Set your name and password to join the workspace</p>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="field">
            <label className="field-label">Your full name</label>
            <input className={`field-input ${errors.name?'field-input-error':''}`} type="text"
              placeholder="Jane Smith" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus/>
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label className="field-label">Choose a password</label>
            <div className={styles.pwWrap}>
              <input className={`field-input ${errors.password?'field-input-error':''}`}
                type={showPw?'text':'password'} placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/>
              <button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>
                {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-md" style={{width:'100%'}} disabled={loading}>
            {loading?<span className="spinner"/>:null}{loading?'Joining…':'Join Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
