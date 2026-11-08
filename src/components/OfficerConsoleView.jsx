import React, { useState, useEffect } from 'react';
import { Volume2, RotateCcw, FastForward, CheckCircle2, UserCheck, Clock, ListFilter } from 'lucide-react';

export default function OfficerConsoleView({ clinics = [], counters = [], tickets = [], onCallTicket, onRecallTicket, onSkipTicket, onCompleteTicket, currentUser }) {
  // Storage keys for persisting user choices across reloads and tab navigation
  const CLINIC_KEY = 'antrean_officer_selected_clinic';
  const NAME_KEY = 'antrean_officer_name';

  // Parse assigned clinic IDs from currentUser (supporting multiple clinics per account)
  const userAssignedClinicIds = Array.isArray(currentUser?.assignedClinicIds) && currentUser.assignedClinicIds.length > 0
    ? currentUser.assignedClinicIds
    : (currentUser?.assignedClinicId ? currentUser.assignedClinicId.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Filter available clinics for this officer:
  // If user has specific assigned clinics, strictly restrict to those clinics.
  // Otherwise, allow all clinics.
  const allowedClinics = (userAssignedClinicIds.length > 0)
    ? clinics.filter(c => userAssignedClinicIds.includes(c.id))
    : clinics;

  const selectableClinics = allowedClinics.length > 0 ? allowedClinics : clinics;

  // Read saved selections or derive defaults from selectable clinics list
  const getInitialClinicId = () => {
    try {
      const saved = localStorage.getItem(CLINIC_KEY);
      if (saved && selectableClinics.some(c => c.id === saved)) return saved;
    } catch (e) {
      console.warn('Could not read clinic from localStorage', e);
    }
    if (userAssignedClinicIds.length > 0) {
      const match = selectableClinics.find(c => userAssignedClinicIds.includes(c.id));
      if (match) return match.id;
    }
    if (currentUser?.role === 'FARMASI') {
      const pharmacyClinic = selectableClinics.find(c => c.name.toLowerCase().includes('farmasi') || c.name.toLowerCase().includes('apotek'));
      if (pharmacyClinic) return pharmacyClinic.id;
    }
    return selectableClinics[0]?.id || clinics[0]?.id || '';
  };

  const [selectedClinicId, setSelectedClinicId] = useState(getInitialClinicId);
  const [officerName, setOfficerName] = useState(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) return saved;
    } catch (e) {
      console.warn('Could not read name from localStorage', e);
    }
    return currentUser?.name || (currentUser?.role === 'FARMASI' ? 'Petugas Farmasi' : 'Petugas Poliklinik');
  });
  const [feedback, setFeedback] = useState(null);

  // Sync state once clinics list arrives from server
  useEffect(() => {
    if (selectableClinics.length === 0) return;
    const saved = localStorage.getItem(CLINIC_KEY);
    if (saved && selectableClinics.some(c => c.id === saved)) {
      if (selectedClinicId !== saved) setSelectedClinicId(saved);
    } else if (!selectedClinicId || !selectableClinics.some(c => c.id === selectedClinicId)) {
      const initId = selectableClinics[0]?.id;
      if (initId) {
        setSelectedClinicId(initId);
        localStorage.setItem(CLINIC_KEY, initId);
      }
    }
  }, [selectableClinics, currentUser]);

  // Active clinic directly from admin's clinics list
  const activeClinic = selectableClinics.find(c => c.id === selectedClinicId) || clinics.find(c => c.id === selectedClinicId) || selectableClinics[0] || clinics[0];

  // Associated counter if configured by admin for this clinic
  const activeCounter = counters.find(c => c.clinicId === activeClinic?.id) || counters[0];

  const COUNTER_KEY_PREFIX = 'antrean_officer_counter_';
  const getCounterNumber = (counterName, defaultNum = 1) => {
    if (!counterName) return defaultNum;
    const match = String(counterName).match(/\d+/);
    return match ? parseInt(match[0], 10) : defaultNum;
  };

  const getDefaultCounterNumber = (clinic) => {
    if (!clinic) return 1;
    try {
      const saved = localStorage.getItem(COUNTER_KEY_PREFIX + clinic.id);
      if (saved) return parseInt(saved, 10) || 1;
    } catch (e) {}
    return getCounterNumber(clinic.counterName || counters.find(c => c.clinicId === clinic.id)?.name, 1);
  };

  const [counterNum, setCounterNum] = useState(() => getDefaultCounterNumber(activeClinic));

  useEffect(() => {
    if (activeClinic) {
      setCounterNum(getDefaultCounterNumber(activeClinic));
    }
  }, [activeClinic?.id]);

  const handleCounterNumChange = (val) => {
    const parsed = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1);
    setCounterNum(parsed);
    if (activeClinic?.id && parsed !== '') {
      try {
        localStorage.setItem(COUNTER_KEY_PREFIX + activeClinic.id, String(parsed));
      } catch (e) {}
    }
  };

  const effectiveCounterNumber = counterNum === '' ? 1 : counterNum;
  const effectiveCounterName = `Loket ${effectiveCounterNumber}`;

  const handleClinicChange = (clinicId) => {
    setSelectedClinicId(clinicId);
    try {
      localStorage.setItem(CLINIC_KEY, clinicId);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleOfficerNameChange = (name) => {
    setOfficerName(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (e) {
      console.warn(e);
    }
  };

  const today = new Date().toLocaleDateString('en-CA');
  const getNormalizedDate = (d) => {
    if (!d) return today;
    if (typeof d === 'string') return d.split('T')[0];
    try {
      return new Date(d).toLocaleDateString('en-CA');
    } catch {
      return today;
    }
  };
  const todayTickets = tickets.filter(t => t.clinicId === activeClinic?.id && getNormalizedDate(t.date) === today);

  const waitingTickets = todayTickets.filter(t => t.status === 'WAITING');
  const calledTickets = todayTickets.filter(t => t.status === 'CALLED' || t.status === 'SERVING');
  const skippedTickets = todayTickets.filter(t => t.status === 'SKIPPED');
  const completedTickets = todayTickets.filter(t => t.status === 'COMPLETED');
  
  // Current active ticket being served at this clinic:
  // Sort by calledAt (or createdAt) DESC so the most recently called ticket is active
  const activeCalledTickets = todayTickets
    .filter(t => (t.status === 'CALLED' || t.status === 'SERVING'))
    .sort((a, b) => new Date(b.calledAt || b.createdAt || 0) - new Date(a.calledAt || a.createdAt || 0));

  const servingTicket = activeCalledTickets[0] || null;

  // Filter state for queue table
  const [tableFilter, setTableFilter] = useState('ALL'); // 'ALL' | 'WAITING' | 'CALLED' | 'SKIPPED' | 'COMPLETED'

  const displayTickets = todayTickets.filter(t => {
    if (tableFilter === 'WAITING') return t.status === 'WAITING';
    if (tableFilter === 'CALLED') return t.status === 'CALLED' || t.status === 'SERVING';
    if (tableFilter === 'SKIPPED') return t.status === 'SKIPPED';
    if (tableFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const showNotice = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCallNext = () => {
    if (waitingTickets.length === 0) {
      showNotice(`Tidak ada antrean menunggu di Poliklinik ${activeClinic?.name || ''}.`, 'warning');
      return;
    }
    const nextTicket = waitingTickets[0];
    onCallTicket({
      ticketId: nextTicket.id,
      clinicId: activeClinic?.id,
      counterId: activeCounter?.id || `cnt_${activeClinic?.id || '1'}`,
      counterName: effectiveCounterName,
      officerName
    }, (res) => {
      if (res.success) showNotice(`Antrean ${res.ticket?.ticketNumber || nextTicket.ticketNumber} dipanggil ke ${effectiveCounterName}`);
      else showNotice(res.error || 'Gagal memanggil antrean.', 'danger');
    });
  };

  const handleCallSpecific = (targetTicket) => {
    if (!targetTicket) return;
    onCallTicket({
      ticketId: targetTicket.id,
      clinicId: activeClinic?.id,
      counterId: activeCounter?.id || `cnt_${activeClinic?.id || '1'}`,
      counterName: effectiveCounterName,
      officerName
    }, (res) => {
      if (res.success) showNotice(`Antrean ${targetTicket.ticketNumber} dipanggil ke ${effectiveCounterName}`);
      else showNotice(res.error || 'Gagal memanggil antrean.', 'danger');
    });
  };

  // Re-call any ticket (active, passed, or skipped/kelewat) to current counter with sound & TTS
  const handleRecallSpecific = (targetTicket) => {
    if (!targetTicket) return;
    onRecallTicket({
      ticketId: targetTicket.id,
      clinicId: activeClinic?.id,
      counterId: activeCounter?.id || `cnt_${activeClinic?.id || '1'}`,
      counterName: effectiveCounterName,
      officerName
    }, (res) => {
      if (res.success) showNotice(`Antrean ${targetTicket.ticketNumber} dipanggil ulang ke ${effectiveCounterName}!`);
      else showNotice(res.error || 'Gagal memanggil ulang antrean.', 'danger');
    });
  };

  const handleRecall = () => {
    if (!servingTicket) {
      showNotice('Belum ada antrean yang sedang dipanggil di loket ini.', 'warning');
      return;
    }
    handleRecallSpecific(servingTicket);
  };

  const handleSkipSpecific = (targetTicket) => {
    if (!targetTicket) return;
    onSkipTicket({ ticketId: targetTicket.id }, (res) => {
      if (res.success) showNotice(`Antrean ${targetTicket.ticketNumber} dilewati (Kelewat).`, 'warning');
      else showNotice(res.error || 'Gagal melewati antrean.', 'danger');
    });
  };

  const handleSkip = () => {
    if (!servingTicket) {
      showNotice('Tidak ada antrean aktif yang dapat dilewati.', 'warning');
      return;
    }
    handleSkipSpecific(servingTicket);
  };

  const handleCompleteSpecific = (targetTicket) => {
    if (!targetTicket) return;
    onCompleteTicket({ ticketId: targetTicket.id }, (res) => {
      if (res.success) showNotice(`Antrean ${targetTicket.ticketNumber} telah selesai diperiksa.`);
      else showNotice(res.error || 'Gagal menyelesaikan antrean.', 'danger');
    });
  };

  const handleComplete = () => {
    if (!servingTicket) {
      showNotice('Tidak ada antrean aktif untuk diselesaikan.', 'warning');
      return;
    }
    handleCompleteSpecific(servingTicket);
  };

  return (
    <div className="officer-container">
      {/* Sidebar Setup */}
      <div className="officer-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '800' }}>
          <UserCheck size={20} />
          <span>KONSOL PETUGAS</span>
        </div>

        <div className="counter-selector">
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>1. Pilih Poliklinik</label>
          <select value={selectedClinicId || activeClinic?.id || ''} onChange={(e) => handleClinicChange(e.target.value)}>
            {selectableClinics.map((cli) => (
              <option key={cli.id} value={cli.id}>
                [{cli.prefix}] {cli.name} {cli.active ? '' : '(Tutup)'}
              </option>
            ))}
          </select>
        </div>

        <div className="counter-selector">
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>2. Nama Petugas Pemanggil</label>
          <input
            type="text"
            value={officerName}
            onChange={(e) => handleOfficerNameChange(e.target.value)}
            placeholder="Masukkan nama Anda"
          />
        </div>

        <div className="counter-selector">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>3. Nomor Loket Pemanggil</label>
            <span style={{ fontSize: '0.7rem', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Hanya Angka</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#ffffff',
            marginTop: '4px'
          }}>
            <span style={{
              padding: '7px 12px',
              background: '#f8fafc',
              color: '#475569',
              fontWeight: '800',
              fontSize: '0.88rem',
              borderRight: '1px solid #cbd5e1',
              userSelect: 'none'
            }}>
              Loket
            </span>
            <input
              type="number"
              min="1"
              max="999"
              value={counterNum}
              onChange={(e) => handleCounterNumChange(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                border: 'none',
                outline: 'none',
                fontWeight: '800',
                color: '#15803d',
                fontSize: '1rem',
                textAlign: 'center'
              }}
              placeholder="1"
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
            Panggilan suara TV: <strong style={{ color: '#15803d' }}>"{effectiveCounterName}"</strong>
          </div>
        </div>

        <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>STATUS POLIKLINIK SAAT INI</span>
            <span style={{ fontSize: '0.7rem', color: '#047857', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Tersimpan Otomatis</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: '4px 0' }}>{activeClinic?.name} [{activeClinic?.prefix}]</div>
          <div style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '6px' }}>{effectiveCounterName}</span>
            <span>• Kuota: {activeClinic?.quota || 50} Pasien</span>
          </div>
        </div>

        {/* Counter Queue Summary (Clickable to Filter) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
          <div
            onClick={() => setTableFilter('WAITING')}
            style={{
              display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px',
              background: tableFilter === 'WAITING' ? '#fef3c7' : '#f8fafc', border: tableFilter === 'WAITING' ? '1px solid #fde68a' : '1px solid transparent'
            }}
            title="Klik untuk melihat antrean Menunggu"
          >
            <span style={{ fontWeight: '600' }}>Menunggu:</span> <strong style={{ color: '#d97706' }}>{waitingTickets.length} Pasien</strong>
          </div>
          <div
            onClick={() => setTableFilter('SKIPPED')}
            style={{
              display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px',
              background: tableFilter === 'SKIPPED' ? '#fee2e2' : (skippedTickets.length > 0 ? '#fff1f2' : '#f8fafc'),
              border: tableFilter === 'SKIPPED' ? '1px solid #fca5a5' : '1px solid transparent'
            }}
            title="Klik untuk melihat antrean yang Dilewati / Kelewat"
          >
            <span style={{ color: skippedTickets.length > 0 ? '#b91c1c' : 'inherit', fontWeight: skippedTickets.length > 0 ? '700' : '600' }}>
              {skippedTickets.length > 0 ? '⚠️ ' : ''}Dilewati (Kelewat):
            </span>
            <strong style={{ color: '#b91c1c' }}>{skippedTickets.length} Pasien</strong>
          </div>
          <div
            onClick={() => setTableFilter('COMPLETED')}
            style={{
              display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px',
              background: tableFilter === 'COMPLETED' ? '#d1fae5' : '#f8fafc', border: tableFilter === 'COMPLETED' ? '1px solid #86efac' : '1px solid transparent'
            }}
            title="Klik untuk melihat antrean Selesai"
          >
            <span style={{ fontWeight: '600' }}>Selesai Dilayani:</span> <strong style={{ color: '#047857' }}>{completedTickets.length} Pasien</strong>
          </div>
        </div>
      </div>

      {/* Main Console Pad */}
      <div className="officer-main">
        {feedback && (
          <div style={{
            background: feedback.type === 'danger' ? '#fef2f2' : feedback.type === 'warning' ? '#fffbeb' : '#ecfdf5',
            color: feedback.type === 'danger' ? '#b91c1c' : feedback.type === 'warning' ? '#b45309' : '#047857',
            padding: '0.85rem 1.25rem', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem'
          }}>
            {feedback.msg}
          </div>
        )}

        <div className="console-hero">
          <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {activeClinic?.name} [{activeClinic?.prefix}] • {effectiveCounterName} • ANTRIAN AKTIF
          </div>

          <div className="active-ticket-display">
            {servingTicket ? servingTicket.ticketNumber : '---'}
          </div>

          {servingTicket && (
            <div className="officer-patient-badge" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem 1.5rem', borderRadius: '12px', marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>NAMA PASIEN</span>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{servingTicket.patientName || 'Pasien Umum'}</div>
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: '600' }}>
            {servingTicket ? (
              <span>Waktu dipanggil: {new Date(servingTicket.calledAt).toLocaleTimeString('id-ID')} WIB di <strong>{servingTicket.counterName || effectiveCounterName}</strong></span>
            ) : (
              <span>Tekan tombol "Panggil (Next)" atau pilih nomor antrean di bawah untuk memanggil pasien ke <strong>{effectiveCounterName}</strong>.</span>
            )}
          </div>

          {/* Action Button Pad */}
          <div className="action-button-group">
            <button className="btn-action btn-next" onClick={handleCallNext}>
              <Volume2 size={24} />
              <span>Panggil (Next)</span>
            </button>

            <button className="btn-action btn-recall" onClick={handleRecall} disabled={!servingTicket}>
              <RotateCcw size={24} />
              <span>Panggil Ulang</span>
            </button>

            <button className="btn-action btn-skip" onClick={handleSkip} disabled={!servingTicket}>
              <FastForward size={24} />
              <span>Lewati (Skip)</span>
            </button>

            <button className="btn-action btn-complete" onClick={handleComplete} disabled={!servingTicket}>
              <CheckCircle2 size={24} />
              <span>Selesai</span>
            </button>
          </div>

          {/* Quick Dropdown: Panggil Ulang Pasien Kelewat (Skipped) */}
          {skippedTickets.length > 0 && (
            <div style={{
              marginTop: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              padding: '8px 16px',
              borderRadius: '10px'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={15} /> Panggil Ulang Pasien Kelewat:
              </span>
              <select
                id="recall-skipped-select"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #f59e0b',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  color: '#92400e',
                  cursor: 'pointer'
                }}
                onChange={(e) => {
                  const target = skippedTickets.find(t => t.id === e.target.value);
                  if (target) {
                    handleRecallSpecific(target);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>-- Pilih Pasien Kelewat ({skippedTickets.length} Pasien) --</option>
                {skippedTickets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.ticketNumber} - {t.patientName || 'Pasien Umum'} (Dilewati)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Manual Queue Selector */}
          {waitingTickets.length > 0 && (
            <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', background: '#f8fafc', padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Panggil Khusus No. Urut Tertentu:</span>
              <select
                id="manual-queue-select"
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '0.85rem', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                onChange={(e) => {
                  const target = waitingTickets.find(t => t.id === e.target.value);
                  if (target) {
                    handleCallSpecific(target);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>-- Pilih Nomor Antrean Menunggu --</option>
                {waitingTickets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.ticketNumber} - {t.patientName || 'Pasien Umum'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Queue List Table */}
        <div className="queue-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>
              Daftar Antrean Poli {activeClinic?.name} Hari Ini
            </h3>
            <span style={{ fontSize: '0.85rem', background: '#f1f5f9', padding: '4px 12px', borderRadius: '15px', fontWeight: '600' }}>
              Total: {todayTickets.length} Tiket
            </span>
          </div>

          {/* Table Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setTableFilter('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: tableFilter === 'ALL' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                background: tableFilter === 'ALL' ? '#e0f2fe' : '#ffffff',
                color: tableFilter === 'ALL' ? '#0369a1' : '#475569'
              }}
            >
              Semua ({todayTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('WAITING')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: tableFilter === 'WAITING' ? '2px solid #d97706' : '1px solid #cbd5e1',
                background: tableFilter === 'WAITING' ? '#fef3c7' : '#ffffff',
                color: tableFilter === 'WAITING' ? '#b45309' : '#475569'
              }}
            >
              Menunggu ({waitingTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('CALLED')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: tableFilter === 'CALLED' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: tableFilter === 'CALLED' ? '#dcfce7' : '#ffffff',
                color: tableFilter === 'CALLED' ? '#15803d' : '#475569'
              }}
            >
              Dipanggil ({calledTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('SKIPPED')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '800',
                cursor: 'pointer',
                border: tableFilter === 'SKIPPED' ? '2px solid #dc2626' : (skippedTickets.length > 0 ? '1px solid #fca5a5' : '1px solid #cbd5e1'),
                background: tableFilter === 'SKIPPED' ? '#fee2e2' : (skippedTickets.length > 0 ? '#fff1f2' : '#ffffff'),
                color: skippedTickets.length > 0 ? '#b91c1c' : '#475569'
              }}
            >
              ⚠️ Dilewati / Kelewat ({skippedTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('COMPLETED')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: tableFilter === 'COMPLETED' ? '2px solid #059669' : '1px solid #cbd5e1',
                background: tableFilter === 'COMPLETED' ? '#d1fae5' : '#ffffff',
                color: tableFilter === 'COMPLETED' ? '#047857' : '#475569'
              }}
            >
              Selesai ({completedTickets.length})
            </button>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table-custom" style={{ minWidth: '650px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>No. Antrean</th>
                  <th style={{ width: '25%' }}>Nama Pasien</th>
                  <th style={{ width: '15%' }}>Waktu Ambil</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '15%' }}>Loket Pemanggil</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>Aksi Panggil</th>
                </tr>
              </thead>
              <tbody>
                {displayTickets.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      {tableFilter === 'SKIPPED'
                        ? 'Tidak ada antrean yang dilewati / kelewat.'
                        : tableFilter === 'WAITING'
                        ? 'Tidak ada antrean menunggu saat ini.'
                        : tableFilter === 'CALLED'
                        ? 'Tidak ada antrean yang sedang dipanggil saat ini.'
                        : tableFilter === 'COMPLETED'
                        ? 'Belum ada antrean yang selesai hari ini.'
                        : 'Belum ada antrean yang diambil di poliklinik ini hari ini.'}
                    </td>
                  </tr>
                ) : (
                  displayTickets.map((t) => (
                    <tr
                      key={t.id}
                      style={{
                        background: t.id === servingTicket?.id ? '#ecfdf5' : (t.status === 'SKIPPED' ? '#fffbeb' : 'transparent'),
                        borderLeft: t.id === servingTicket?.id ? '4px solid #16a34a' : (t.status === 'SKIPPED' ? '4px solid #f59e0b' : 'none')
                      }}
                    >
                      <td style={{ fontWeight: '800', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: (t.status === 'CALLED' || t.status === 'SERVING') ? '#15803d' : (t.status === 'SKIPPED' ? '#b45309' : '#0f172a') }}>
                        {t.ticketNumber}
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>
                        {t.patientName || 'Pasien Umum'}
                      </td>
                      <td>{new Date(t.createdAt).toLocaleTimeString('id-ID')}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800',
                          background: t.status === 'WAITING' ? '#fef3c7' : (t.status === 'CALLED' || t.status === 'SERVING') ? '#ecfdf5' : t.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
                          color: t.status === 'WAITING' ? '#d97706' : (t.status === 'CALLED' || t.status === 'SERVING') ? '#15803d' : t.status === 'COMPLETED' ? '#047857' : '#b91c1c',
                          border: t.status === 'SKIPPED' ? '1px solid #fca5a5' : 'none',
                          display: 'inline-flex', alignItems: 'center', gap: '3px'
                        }}>
                          {t.status === 'SKIPPED' ? '⚠️ KELEWAT' : t.status}
                        </span>
                      </td>
                      <td>{t.counterName || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {/* 1. Status WAITING: Panggil & Lewati */}
                        {t.status === 'WAITING' && (
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              style={{ padding: '5px 12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleCallSpecific(t)}
                              title={`Panggil nomor antrean ${t.ticketNumber} ke ${effectiveCounterName}`}
                            >
                              <Volume2 size={13} /> Panggil
                            </button>
                            <button
                              type="button"
                              style={{ padding: '5px 10px', background: '#f8fafc', color: '#b45309', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleSkipSpecific(t)}
                              title={`Lewati antrean ${t.ticketNumber}`}
                            >
                              <FastForward size={13} /> Lewati
                            </button>
                          </div>
                        )}

                        {/* 2. Status SKIPPED: Panggil Ulang (Kelewat) & Selesai */}
                        {t.status === 'SKIPPED' && (
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={{
                                padding: '6px 14px',
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: '800',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)'
                              }}
                              onClick={() => handleRecallSpecific(t)}
                              title={`Panggil ulang antrean kelewat ${t.ticketNumber} ke ${effectiveCounterName}`}
                            >
                              <RotateCcw size={14} /> Panggil Ulang (Kelewat)
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '5px 9px',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                              }}
                              onClick={() => handleCompleteSpecific(t)}
                              title="Tandai Selesai"
                            >
                              ✓ Selesai
                            </button>
                          </div>
                        )}

                        {/* 3. Status CALLED / SERVING: Panggil Ulang, Lewati, Selesai */}
                        {(t.status === 'CALLED' || t.status === 'SERVING') && (
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={{ padding: '5px 10px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleRecallSpecific(t)}
                              title={`Panggil ulang ${t.ticketNumber} ke ${effectiveCounterName}`}
                            >
                              <RotateCcw size={13} /> Panggil Ulang
                            </button>
                            <button
                              type="button"
                              style={{ padding: '5px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleSkipSpecific(t)}
                              title={`Lewati antrean ${t.ticketNumber} (Kelewat)`}
                            >
                              <FastForward size={13} /> Lewati
                            </button>
                            <button
                              type="button"
                              style={{ padding: '5px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleCompleteSpecific(t)}
                              title={`Selesaikan antrean ${t.ticketNumber}`}
                            >
                              <CheckCircle2 size={13} /> Selesai
                            </button>
                          </div>
                        )}

                        {/* 4. Status COMPLETED: Status Selesai + Tombol Panggil Lagi jika diperlukan */}
                        {t.status === 'COMPLETED' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={13} /> Selesai
                            </span>
                            <button
                              type="button"
                              style={{
                                padding: '3px 8px',
                                background: '#f8fafc',
                                color: '#64748b',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              onClick={() => handleRecallSpecific(t)}
                              title={`Panggil lagi antrean ${t.ticketNumber} ke ${effectiveCounterName}`}
                            >
                              <RotateCcw size={11} /> Panggil Lagi
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
