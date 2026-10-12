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
  // If user has specific assigned clinics and is not an ADMIN, only allow their assigned clinics.
  // Otherwise, allow all clinics.
  const allowedClinics = (userAssignedClinicIds.length > 0 && currentUser?.role !== 'ADMIN')
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
  const skippedTickets = todayTickets.filter(t => t.status === 'SKIPPED');
  const completedTickets = todayTickets.filter(t => t.status === 'COMPLETED');
  
  // Current active ticket being served at this clinic
  const servingTicket = todayTickets.find(t => (t.status === 'CALLED' || t.status === 'SERVING') && (t.clinicId === activeClinic?.id));

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
      counterId: activeCounter?.id || 'l1',
      counterName: activeCounter?.name || activeClinic?.name || 'Loket Petugas',
      officerName
    }, (res) => {
      if (res.success) showNotice(`Antrean ${res.ticket.ticketNumber} dipanggil ke ${activeClinic?.name || 'Poliklinik'}`);
      else showNotice(res.error, 'danger');
    });
  };

  const handleRecall = () => {
    if (!servingTicket) {
      showNotice('Belum ada antrean yang sedang dipanggil di loket ini.', 'warning');
      return;
    }
    onRecallTicket({ ticketId: servingTicket.id }, (res) => {
      if (res.success) showNotice(`Antrean ${servingTicket.ticketNumber} dipanggil ulang!`);
    });
  };

  const handleSkip = () => {
    if (!servingTicket) return;
    onSkipTicket({ ticketId: servingTicket.id }, (res) => {
      if (res.success) showNotice(`Antrean ${servingTicket.ticketNumber} dilewati.`);
    });
  };

  const handleComplete = () => {
    if (!servingTicket) return;
    onCompleteTicket({ ticketId: servingTicket.id }, (res) => {
      if (res.success) showNotice(`Antrean ${servingTicket.ticketNumber} telah selesai diperiksa.`);
    });
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

        <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>STATUS POLIKLINIK SAAT INI</span>
            <span style={{ fontSize: '0.7rem', color: '#047857', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Tersimpan Otomatis</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: '4px 0' }}>{activeClinic?.name} [{activeClinic?.prefix}]</div>
          <div style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: '700' }}>
            {activeCounter?.name ? `${activeCounter.name} • ` : ''}Kuota: {activeClinic?.quota || 50} Pasien
          </div>
        </div>

        {/* Counter Queue Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Menunggu:</span> <strong style={{ color: '#d97706' }}>{waitingTickets.length} Pasien</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Dilewati (Skip):</span> <strong style={{ color: '#b91c1c' }}>{skippedTickets.length} Pasien</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Selesai Dilayani:</span> <strong style={{ color: '#047857' }}>{completedTickets.length} Pasien</strong>
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
            {activeClinic?.name} [{activeClinic?.prefix}] • ANTRIAN AKTIF SAAT INI
          </div>

          <div className="active-ticket-display">
            {servingTicket ? servingTicket.ticketNumber : '---'}
          </div>

          {servingTicket && (
            <div className="officer-patient-badge" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>NAMA PASIEN</span>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>{servingTicket.patientName || 'Pasien Umum'}</div>
              </div>
              <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '0.75rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>NIK / RM / TELEPON</span>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#334155' }}>
                  {servingTicket.nik !== '-' ? servingTicket.nik : (servingTicket.norm !== '-' ? servingTicket.norm : '-')}
                  {servingTicket.phone && servingTicket.phone !== '-' ? ` (${servingTicket.phone})` : ''}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '0.75rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>PENJAMIN</span>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '900', background: servingTicket.patientType === 'BPJS' ? '#ecfdf5' : '#fef3c7', color: servingTicket.patientType === 'BPJS' ? '#166534' : '#b45309', padding: '3px 10px', borderRadius: '10px' }}>
                    {servingTicket.patientType || 'BPJS'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: '600' }}>
            {servingTicket ? (
              <span>Waktu dipanggil: {new Date(servingTicket.calledAt).toLocaleTimeString('id-ID')} WIB</span>
            ) : (
              <span>Tekan tombol "Panggil Selanjutnya" untuk memanggil pasien antrean berikutnya.</span>
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
        </div>

        {/* Queue List Table */}
        <div className="queue-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: '700' }}>Daftar Antrean Poli {activeClinic?.name} Hari Ini</h3>
            <span style={{ fontSize: '0.85rem', background: '#f1f5f9', padding: '4px 12px', borderRadius: '15px', fontWeight: '600' }}>
              Total: {todayTickets.length} Tiket
            </span>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table-custom" style={{ minWidth: '550px', width: '100%' }}>
              <thead>
                <tr>
                  <th>No. Antrean</th>
                  <th>Nama Pasien</th>
                  <th>NIK / RM</th>
                  <th>Penjamin</th>
                  <th>Waktu Ambil</th>
                  <th>Status</th>
                  <th>Loket Pemanggil</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {todayTickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Belum ada antrean yang diambil di poliklinik ini hari ini.
                    </td>
                  </tr>
                ) : (
                  todayTickets.map((t) => (
                    <tr key={t.id} style={{ background: t.id === servingTicket?.id ? '#ecfdf5' : 'transparent' }}>
                      <td style={{ fontWeight: '800', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: t.status === 'CALLED' ? '#15803d' : '#0f172a' }}>
                        {t.ticketNumber}
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>
                        {t.patientName || 'Pasien Umum'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {t.nik !== '-' ? t.nik : (t.norm !== '-' ? t.norm : '-')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', background: t.patientType === 'BPJS' ? '#ecfdf5' : '#fef3c7', color: t.patientType === 'BPJS' ? '#166534' : '#b45309', padding: '2px 8px', borderRadius: '8px' }}>
                          {t.patientType || 'BPJS'}
                        </span>
                      </td>
                      <td>{new Date(t.createdAt).toLocaleTimeString('id-ID')}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700',
                          background: t.status === 'WAITING' ? '#fef3c7' : t.status === 'CALLED' ? '#ecfdf5' : t.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
                          color: t.status === 'WAITING' ? '#d97706' : t.status === 'CALLED' ? '#15803d' : t.status === 'COMPLETED' ? '#047857' : '#b91c1c'
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td>{t.counterName || '-'}</td>
                      <td>
                        {t.status === 'SKIPPED' && (
                          <button
                            style={{ padding: '4px 10px', background: '#15803d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}
                            onClick={() => onCallTicket({ ticketId: t.id, counterId: activeCounter.id, counterName: activeCounter.name, officerName }, () => showNotice(`Memanggil kembali antrean ${t.ticketNumber}`))}
                          >
                            Panggil Kembali
                          </button>
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
