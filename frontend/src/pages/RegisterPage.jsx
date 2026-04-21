import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import '../components/ui/components.css';
import styles from './AuthPage.module.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ orgName:'', name:'', email:'', password:'' });
  const [mode, setMode] = useState('create'); // 'create' or 'join'
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const validate = () => {
    const e = {};
    if (!form.orgName.trim()||form.orgName.trim().length<2) e.orgName='Organization name required (min 2 chars).';
    if (!form.name.trim()||form.name.trim().length<2) e.name='Your name is required.';
    if (!form.email) e.email='Email is required.';
    if (form.password.length<8) e.password='Min 8 characters.';
    else if (!/[A-Z]/.test(form.password)) e.password='Include at least one uppercase letter.';
    else if (!/[0-9]/.test(form.password)) e.password='Include at least one number.';
    setErrors(e); return !Object.keys(e).length;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault(); if (!validate()) return; setLoading(true);
    try { 
      const res = await register({ ...form, mode }); 
      if (res?.pending) {
        toast.success('Registration request sent! Please wait for admin approval.');
        navigate('/login');
      } else {
        toast.success('Workspace created — welcome!'); 
        navigate('/dashboard'); 
      }
    }
    catch (err) { toast.error(err.response?.data?.error||'Registration failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>T</div>
          <span className={styles.logoName}>Taskflow</span>
        </div>
        
        <div style={{display:'flex', gap:8, marginBottom: 20, background: 'var(--c-surface3)', padding: 4, borderRadius: 8}}>
          <button 
            type="button"
            className={`btn btn-sm ${mode==='create'?'btn-primary':'btn-ghost'}`} 
            style={{flex:1}}
            onClick={() => setMode('create')}>
            Create Workspace
          </button>
          <button 
            type="button" 
            className={`btn btn-sm ${mode==='join'?'btn-primary':'btn-ghost'}`} 
            style={{flex:1}}
            onClick={() => setMode('join')}>
            Join Workspace
          </button>
        </div>

        <h2 className={styles.heading}>{mode === 'create' ? 'Create your workspace' : 'Join a workspace'}</h2>
        <p className={styles.sub}>{mode === 'create' ? 'Set up your organization and start managing work' : 'Enter the organization name to request access'}</p>
        
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="field">
            <label className="field-label">Organization name</label>
            <input className={`field-input ${errors.orgName?'field-input-error':''}`} type="text"
              placeholder="Acme Inc." value={form.orgName} onChange={set('orgName')}/>
            {errors.orgName&&<span className="field-error">{errors.orgName}</span>}
          </div>
          <div className={styles.row}>
            <div className="field">
              <label className="field-label">Your full name</label>
              <input className={`field-input ${errors.name?'field-input-error':''}`} type="text"
                placeholder="Jane Smith" value={form.name} onChange={set('name')}/>
              {errors.name&&<span className="field-error">{errors.name}</span>}
            </div>
            <div className="field">
              <label className="field-label">Work email</label>
              <input className={`field-input ${errors.email?'field-input-error':''}`} type="email"
                placeholder="jane@acme.com" value={form.email} onChange={set('email')} autoComplete="email"/>
              {errors.email&&<span className="field-error">{errors.email}</span>}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <div className={styles.pwWrap}>
              <input className={`field-input ${errors.password?'field-input-error':''}`}
                type={showPw?'text':'password'} placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={form.password} onChange={set('password')} autoComplete="new-password"/>
              <button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>
                {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
            {errors.password&&<span className="field-error">{errors.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-md" style={{width:'100%',marginTop:4}} disabled={loading}>
            {loading?<span className="spinner"/>: (mode === 'create' ? <Building2 size={15}/> : <UserPlus size={15}/>)}
            {loading? (mode === 'create' ? 'Creating…' : 'Joining...') : (mode === 'create' ? 'Create Workspace' : 'Request to Join')}
          </button>
        </form>
        <p className={styles.switchLink}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
