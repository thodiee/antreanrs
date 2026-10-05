import React, { useState } from 'react';
import { Lock, User, ShieldCheck, KeyRound, AlertCircle, Ticket, UserCheck } from 'lucide-react';

export default function LoginForm({ targetRole, hospital, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        const role = data.user.role;
        const isAdmin = role === 'ADMIN';

        if (targetRole === 'KIOSK') {
          if (!isAdmin && role !== 'PENDAFTARAN') {
            setErrorMsg(`Akun (${role}) tidak memiliki izin membuka Kiosk Pasien. Hanya Petugas Pendaftaran atau Admin.`);
            return;
          }
        } else if (targetRole === 'OFFICER') {
          if (!isAdmin && role !== 'POLIKLINIK' && role !== 'FARMASI' && role !== 'OFFICER') {
            setErrorMsg(`Akun (${role}) tidak memiliki izin Layar Petugas. Hanya Petugas Poliklinik, Farmasi, atau Admin.`);
            return;
          }
        } else if (targetRole === 'ADMIN') {
          if (!isAdmin) {
            setErrorMsg(`Akun (${role}) bukan Administrator. Akses ditolak.`);
            return;
          }
        }

        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || 'Username atau password salah.');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Gagal terhubung ke server login.');
    }
  };

  const getRoleBadge = () => {
    if (targetRole === 'KIOSK') {
      return {
        icon: <Ticket size={28} />,
        title: 'Login Petugas Pendaftaran',
        subtitle: 'Hak akses membuka Layar Kiosk Pasien (Ambil Tiket)',
        bg: 'linear-gradient(135deg, #15803d, #166534)'
      };
    }
    if (targetRole === 'OFFICER') {
      return {
        icon: <UserCheck size={28} />,
        title: 'Login Petugas (Poli & Farmasi)',
        subtitle: 'Hak akses membuka Layar Pemanggilan Pasien & Loket',
        bg: 'linear-gradient(135deg, #059669, #15803d)'
      };
    }
    return {
      icon: <ShieldCheck size={28} />,
      title: 'Login Administrator Sistem',
      subtitle: 'Akses penuh untuk mengubah dan mengelola seluruh sistem',
      bg: 'linear-gradient(135deg, #166534, #047857)'
    };
  };

  const roleInfo = getRoleBadge();

  return (
    <div style={{
      maxWidth: '440px',
      margin: '3.5rem auto',
      background: 'white',
      padding: '2.25rem',
      borderRadius: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 12px 35px rgba(0,0,0,0.08)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        {hospital?.logo ? (
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 0.75rem auto',
            borderRadius: '16px',
            overflow: 'hidden',
            padding: '4px',
            background: 'white',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img src={hospital.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{
            width: '60px',
            height: '60px',
            background: roleInfo.bg,
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            margin: '0 auto 0.75rem auto',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
          }}>
            {roleInfo.icon}
          </div>
        )}
        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          {hospital?.name || 'Sistem Antrean RS'}
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
          {roleInfo.title}
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
          {roleInfo.subtitle}
        </p>
      </div>

      {errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#b91c1c',
          padding: '0.85rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '600',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
            Username
          </label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username akun"
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: '48px',
            borderRadius: '12px',
            border: 'none',
            background: roleInfo.bg,
            color: 'white',
            fontWeight: '800',
            fontSize: '1rem',
            cursor: 'pointer',
            marginTop: '0.5rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
          }}
        >
          {loading ? 'Memverifikasi...' : 'Masuk (Login)'}
        </button>
      </form>
    </div>
  );
}
