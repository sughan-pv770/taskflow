import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import '../components/ui/components.css';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required.';
    if (!form.password) e.password = 'Password is required.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>T</div>
          <span className={styles.logoName}>Taskflow</span>
        </div>
        <h2 className={styles.heading}>Welcome back</h2>
        <p className={styles.sub}>Sign in to your workspace to continue</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="field">
            <label className="field-label">Email address</label>
            <input className={`field-input ${errors.email ? 'field-input-error':''}`} type="email"
              placeholder="you@company.com" value={form.email}
              onChange={e => setForm(f=>({...f,email:e.target.value}))} autoComplete="email" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <div className={styles.pwWrap}>
              <input className={`field-input ${errors.password?'field-input-error':''}`}
                type={showPw?'text':'password'} placeholder="••••••••" value={form.password}
                onChange={e=>setForm(f=>({...f,password:e.target.value}))} autoComplete="current-password"/>
              <button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>
                {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-md" style={{width:'100%',marginTop:4}} disabled={loading}>
            {loading?<span className="spinner"/>:<LogIn size={15}/>}
            {loading?'Signing in…':'Sign In'}
          </button>
        </form>

        <div className={styles.demos}>
          <p className={styles.demosLabel}>Try a demo account — password: Password123!</p>
          <div className={styles.demoBtns}>
            {[['alice@acme.com','Alice (Admin)'],['bob@acme.com','Bob (Member)'],['carol@globex.com','Carol (Admin)']].map(([email,label])=>(
              <button key={email} className="btn btn-secondary btn-sm"
                onClick={()=>setForm({email,password:'Password123!'})}>{label}</button>
            ))}
          </div>
        </div>
        <p className={styles.switchLink}>New here? <Link to="/register">Create an organization</Link></p>
      </div>
    </div>
  );
}
