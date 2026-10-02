import React, { useState, useEffect } from 'react';
import { Ticket, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import ThermalTicketModal from './ThermalTicketModal';

export default function KioskView({ hospital, clinics, tickets, onTakeTicket }) {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingClinicId, setLoadingClinicId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeClinicModal, setActiveClinicModal] = useState(null);

  // Patient details form state
  const [patientForm, setPatientForm] = useState({
    patientName: '',
    nik: '',
    norm: '',
    phone: '',
    patientType: 'BPJS'
  });

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

  const [bridgeStatus, setBridgeStatus] = useState(null); // { connected: bool, printer: string }
  const [directPrintToast, setDirectPrintToast] = useState(null);

  // Auto detect if local Windows print bridge is running on client machine
  useEffect(() => {
    let isMounted = true;
    const checkBridge = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://localhost:18080/status', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (isMounted) {
          if (data.status === 'ok') {
            setBridgeStatus({ connected: true, printer: data.printer });
          } else {
            setBridgeStatus({ connected: false });
          }
        }
      } catch {
        if (isMounted) setBridgeStatus({ connected: false });
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const printViaLocalBridge = async (ticket) => {
    try {
      const formattedDate = new Date(ticket.createdAt || Date.now()).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = new Date(ticket.createdAt || Date.now()).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const printSettings = hospital?.printSettings || {};

      const payload = {
        ticketNumber: ticket.ticketNumber,
        sequence: ticket.sequence || 1,
        clinicName: ticket.clinicName,
        hospitalName: hospital?.name || 'Rumah Sakit',
        hospitalSubtitle: printSettings.headerSubtitle !== undefined ? printSettings.headerSubtitle : 'Sistem Antrean Poliklinik Terpadu',
        date: formattedDate,
        time: formattedTime,
        status: 'MENUNGGU',
        logoBase64: (printSettings.showLogo !== false && hospital?.logo) ? hospital.logo : null,
        logoHeight: printSettings.logoHeight || 50,
        paperWidth: printSettings.paperWidth || '58mm',
        fontSize: printSettings.fontSize || 'medium',
        showBarcode: printSettings.showBarcode !== false,
        showDateTime: printSettings.showDateTime !== false,
        footerText: printSettings.footerText !== undefined ? printSettings.footerText : '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *'
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('http://localhost:18080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  };

  const handleOpenModal = (clinic) => {
    setActiveClinicModal(clinic);
    setPatientForm({
      patientName: '',
      nik: '',
      norm: '',
      phone: '',
      patientType: 'BPJS'
    });
  };

  const handleQuickTakeTicket = (clinic) => {
    if (loadingClinicId || !clinic) return;

    setLoadingClinicId(clinic.id);
    setErrorMsg(null);

    const payload = {
      clinicId: clinic.id,
      patientName: 'Pasien Umum',
      nik: '-',
      norm: '-',
      phone: '-',
      patientType: 'BPJS'
    };

    onTakeTicket(payload, (result) => {
      setLoadingClinicId(null);
      if (result.success) {
        // Attempt Direct Silent Print via Windows Bridge first (0-dialog, instant paper output)
        printViaLocalBridge(result.ticket).then((printedDirectly) => {
          if (printedDirectly) {
            setDirectPrintToast(result.ticket);
            setTimeout(() => setDirectPrintToast(null), 3500);
          } else {
            // Fallback to browser modal
            setSelectedTicket(result.ticket);
          }
        });
      } else {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  const handleConfirmTakeTicket = (isExpress = false) => {
    if (!activeClinicModal || loadingClinicId) return;

    setLoadingClinicId(activeClinicModal.id);
    setErrorMsg(null);

    const payload = isExpress ? {
      clinicId: activeClinicModal.id,
      patientName: 'Pasien Umum',
      nik: '-',
      norm: '-',
      phone: '-',
      patientType: 'BPJS'
    } : {
      clinicId: activeClinicModal.id,
      patientName: patientForm.patientName || 'Pasien Umum',
      nik: patientForm.nik || '-',
      norm: patientForm.norm || '-',
      phone: patientForm.phone || '-',
      patientType: patientForm.patientType || 'BPJS'
    };

    onTakeTicket(payload, (result) => {
      setLoadingClinicId(null);
      setActiveClinicModal(null);
      if (result.success) {
        printViaLocalBridge(result.ticket).then((printedDirectly) => {
          if (printedDirectly) {
            setDirectPrintToast(result.ticket);
            setTimeout(() => setDirectPrintToast(null), 3500);
          } else {
            setSelectedTicket(result.ticket);
          }
        });
      } else {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  return (
    <div className="kiosk-container">
      {/* Direct Silent Print Success Toast (Zero Dialog, Instant Paper) */}
      {directPrintToast && (
        <div style={{
          position: 'fixed',
          top: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: 'white',
          padding: '1.25rem 2.25rem',
          borderRadius: '24px',
          boxShadow: '0 20px 45px rgba(5, 150, 105, 0.4)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          border: '2px solid #34d399'
        }}>
          <span style={{ fontSize: '2.5rem' }}>🖨️</span>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px' }}>
              NOMOR ANTREAN: {directPrintToast.ticketNumber}
            </div>
            <div style={{ fontSize: '0.95rem', opacity: 0.95, fontWeight: '600', marginTop: '2px' }}>
              Struk berhasil dicetak! Silakan ambil kertas tiket Anda di printer.
            </div>
          </div>
        </div>
      )}

      <div className="kiosk-header">
        {hospital?.logo && (
          <div style={{ width: '80px', height: '80px', margin: '0 auto 1rem auto', borderRadius: '16px', overflow: 'hidden', padding: '6px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={hospital.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700' }}>
            <Ticket size={16} /> ANTREAN MANDIRI (KIOSK)
          </div>
          {bridgeStatus?.connected && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
              <span>⚡ Direct Silent Print Aktif ({bridgeStatus.printer || 'Printer Thermal'})</span>
            </div>
          )}
        </div>
        <h2 className="kiosk-title">{hospital?.name || 'Rumah Sakit'}</h2>
        <p className="kiosk-subtitle">Silakan sentuh poliklinik yang ingin Anda tuju untuk mengambil nomor antrean</p>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: '600' }}>
          <AlertCircle size={22} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="kiosk-grid">
        {clinics.map((clinic) => {
          const clinicTicketsToday = tickets.filter(
            (t) => t.clinicId === clinic.id && getNormalizedDate(t.date) === today
          );
          const currentCount = clinicTicketsToday.length;
          const isFull = currentCount >= clinic.quota;

          const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const todayDayName = DAYS_INDO[new Date().getDay()];
          const scheduleDaysStr = clinic.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu';
          const isScheduledToday = scheduleDaysStr.split(',').map(s => s.trim()).includes(todayDayName);

          const isDisabled = !clinic.active || isFull || !isScheduledToday;

          return (
            <div key={clinic.id} className={`clinic-card ${isDisabled ? 'disabled' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="clinic-badge">{clinic.prefix}</div>
                <div className={`quota-pill ${isFull || !isScheduledToday ? 'full' : ''}`}>
                  {!isScheduledToday ? 'Buka Sesuai Jadwal' : isFull ? 'Kuota Penuh' : `${currentCount} / ${clinic.quota} Pasien`}
                </div>
              </div>

              <div className="clinic-info">
                <h3>{clinic.name}</h3>
                <p>{clinic.description || 'Layanan pemeriksaan poliklinik terpadu'}</p>
              </div>

              <div className="clinic-meta">
                <span><Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> Jadwal: {scheduleDaysStr.length > 25 ? 'Senin - Minggu' : scheduleDaysStr}</span>
                <span style={{ color: (clinic.active && isScheduledToday) ? '#10b981' : '#ef4444' }}>
                  ● {(clinic.active && isScheduledToday) ? 'Buka Hari Ini' : 'Tutup Hari Ini'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="take-ticket-btn"
                  disabled={isDisabled || loadingClinicId === clinic.id}
                  onClick={() => {
                    const isQuick = hospital?.printSettings?.quickPrint !== false;
                    if (isQuick) {
                      handleQuickTakeTicket(clinic);
                    } else {
                      handleOpenModal(clinic);
                    }
                  }}
                  style={{
                    background: isDisabled ? undefined : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    boxShadow: isDisabled ? undefined : '0 6px 18px rgba(2, 132, 199, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loadingClinicId === clinic.id ? (
                    'Mencetak Tiket...'
                  ) : !isScheduledToday ? (
                    'Libur (Tidak Ada Jadwal)'
                  ) : isFull ? (
                    'Kuota Habis'
                  ) : !clinic.active ? (
                    'Poli Tutup'
                  ) : (
                    <>
                      <Ticket size={22} /> Cetak Cepat Nomor Antrean
                    </>
                  )}
                </button>

                {!isDisabled && (
                  <button
                    type="button"
                    onClick={() => handleOpenModal(clinic)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '4px',
                      textDecoration: 'underline'
                    }}
                  >
                    📝 Atau masukkan data diri pasien (Opsional)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Patient Identification Registration Modal */}
      {activeClinicModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '90%',
            maxWidth: '520px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: '10px' }}>
                  POLIKLINIK [{activeClinicModal.prefix}]
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {activeClinicModal.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveClinicModal(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontWeight: '800', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-4px' }}>
              Isi data diri pasien di bawah ini agar tersimpan resmi di database rumah sakit:
            </p>

            {/* Input Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nama Lengkap Pasien <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={patientForm.patientName}
                  onChange={(e) => setPatientForm({ ...patientForm, patientName: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: '600' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    NIK / No. RM
                  </label>
                  <input
                    type="text"
                    placeholder="3174... / RM-001"
                    value={patientForm.nik}
                    onChange={(e) => setPatientForm({ ...patientForm, nik: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    No. HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={patientForm.phone}
                    onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Jenis Penjamin / Pasien
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPatientForm({ ...patientForm, patientType: 'BPJS' })}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: patientForm.patientType === 'BPJS' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: patientForm.patientType === 'BPJS' ? '#e0f2fe' : '#f8fafc',
                      color: patientForm.patientType === 'BPJS' ? '#0284c7' : '#475569',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    💳 BPJS Kesehatan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPatientForm({ ...patientForm, patientType: 'UMUM' })}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: patientForm.patientType === 'UMUM' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                      background: patientForm.patientType === 'UMUM' ? '#ccfbf1' : '#f8fafc',
                      color: patientForm.patientType === 'UMUM' ? '#0d9488' : '#475569',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    💵 Pasien Umum / Mandiri
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: '800', borderRadius: '12px' }}
                onClick={() => handleConfirmTakeTicket(false)}
                disabled={loadingClinicId === activeClinicModal.id}
              >
                {loadingClinicId === activeClinicModal.id ? 'Mencetak Ticket...' : '🖨️ Cetak & Simpan Tiket Antrean'}
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleConfirmTakeTicket(true)}
                  style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  ⚡ Cetak Cepat (Tanpa Nama)
                </button>

                <button
                  onClick={() => setActiveClinicModal(null)}
                  style={{ padding: '0.65rem 1.25rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTicket && (
        <ThermalTicketModal
          ticket={selectedTicket}
          hospital={hospital}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
