import React from 'react';
import { Link } from 'react-router-dom';
import '../components/ui/components.css';

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',
      background:'var(--bg-base)',gap:14,padding:24,textAlign:'center'
    }}>
      <div style={{
        width:60,height:60,borderRadius:12,background:'var(--bg-elevated)',
        border:'1.5px solid var(--border)',display:'flex',alignItems:'center',
        justifyContent:'center',fontSize:26,fontFamily:'Lora,serif',fontWeight:700,color:'var(--text-muted)'
      }}>T</div>
      <h1 style={{fontFamily:'Lora,serif',fontSize:32,fontWeight:700,color:'var(--text-primary)'}}>404</h1>
      <p style={{color:'var(--text-muted)',fontSize:15}}>This page doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary btn-md" style={{marginTop:8}}>Back to Dashboard</Link>
    </div>
  );
}
