import React, { useEffect, useState } from 'react';
import { Printer, X, QrCode } from 'lucide-react';

export default function ThermalTicketModal({ ticket, hospital, hospitalName, onClose }) {
  const [countdown, setCountdown] = useState(6);

  const activeHospital = hospital || { name: hospitalName };
  const printSettings = activeHospital.printSettings || {
    paperWidth: '58mm',
    fontSize: 'medium',
    showLogo: true,
    logoHeight: 60,
    headerSubtitle: 'Sistem Antrean Poliklinik Terpadu',
    hospitalAddress: activeHospital.address || '',
    hospitalPhone: activeHospital.phone || '',
    showAddress: true,
    showQrCode: true,
    qrCodeImage: null,
    qrCodeSize: 75,
    qrCodeLabel: '',
    footerText: '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *',
    showDateTime: true,
    autoPrint: true
  };

  const shouldAutoPrint = printSettings.autoPrint !== false;

  const executePrint = async () => {
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

      const payload = {
        ticketNumber: ticket.ticketNumber,
        sequence: ticket.sequence || 1,
        clinicName: ticket.clinicName,
        hospitalName: activeHospital.name || 'Rumah Sakit',
        hospitalSubtitle: printSettings.headerSubtitle !== undefined ? printSettings.headerSubtitle : 'Sistem Antrean Poliklinik Terpadu',
        hospitalAddress: printSettings.hospitalAddress || activeHospital.address || '',
        hospitalPhone: printSettings.hospitalPhone || activeHospital.phone || '',
        showAddress: printSettings.showAddress !== false,
        date: formattedDate,
        time: formattedTime,
        logoBase64: (printSettings.showLogo !== false && activeHospital.logo) ? activeHospital.logo : null,
        logoHeight: printSettings.logoHeight || 50,
        paperWidth: printSettings.paperWidth || '58mm',
        fontSize: printSettings.fontSize || 'medium',
        showDateTime: printSettings.showDateTime !== false,
        showQrCode: printSettings.showQrCode !== false,
        qrCodeImage: printSettings.qrCodeImage || null,
        qrCodeSize: printSettings.qrCodeSize || 75,
        qrCodeLabel: printSettings.qrCodeLabel || '',
        footerText: printSettings.footerText !== undefined ? printSettings.footerText : '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *'
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://localhost:18080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success) {
        setTimeout(onClose, 800);
        return;
      }
    } catch {
      // Bridge not reachable, fallback to browser print
    }
    try {
      window.print();
    } catch (e) {
      console.warn('Browser print notice:', e);
    }
  };

  useEffect(() => {
    // Immediately trigger silent print or browser print dialog
    if (shouldAutoPrint) {
      const printTimer = setTimeout(() => {
        executePrint();
      }, 250);
      return () => clearTimeout(printTimer);
    }
  }, [shouldAutoPrint]);

  useEffect(() => {
    // When print dialog closes or printing finishes, auto-close modal
    const handleAfterPrint = () => {
      setTimeout(() => {
        onClose();
      }, 700);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  if (!ticket) return null;

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

  const paperClass = printSettings.paperWidth === '80mm' ? 'thermal-80mm' : 'thermal-58mm';
  const fontClass = `font-${printSettings.fontSize || 'medium'}`;

  return (
    <div className="modal-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {/* Status Banner */}
        <div className="no-print" style={{
          background: 'linear-gradient(135deg, #15803d, #166534)',
          color: 'white',
          padding: '10px 22px',
          borderRadius: '30px',
          fontSize: '0.9rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(21, 128, 61, 0.35)'
        }}>
          <Printer size={20} />
          <span>Mengirim tiket ke printer thermal...</span>
        </div>

        {/* Printable Area */}
        <div className={`thermal-ticket thermal-ticket-print-area ${paperClass} ${fontClass}`}>
          {/* Hospital Logo */}
          {printSettings.showLogo && activeHospital.logo && (
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={activeHospital.logo}
                alt="Logo RS"
                style={{
                  maxHeight: `${printSettings.logoHeight || 60}px`,
                  maxWidth: '85%',
                  objectFit: 'contain',
                  filter: 'grayscale(100%) contrast(140%)'
                }}
              />
            </div>
          )}

          {/* Header Info */}
          <div className="thermal-header">
            <h4>{activeHospital.name || 'Rumah Sakit'}</h4>
            {printSettings.headerSubtitle && (
              <p style={{ fontSize: '0.75em', color: '#475569', margin: '3px 0 0 0' }}>
                {printSettings.headerSubtitle}
              </p>
            )}
            {printSettings.showAddress !== false && (printSettings.hospitalAddress || printSettings.hospitalPhone || activeHospital.address || activeHospital.phone) && (
              <div style={{ fontSize: '0.68em', color: '#334155', margin: '3px 0 0 0', lineHeight: 1.3 }}>
                {(printSettings.hospitalAddress || activeHospital.address) && (
                  <div>{printSettings.hospitalAddress || activeHospital.address}</div>
                )}
                {(printSettings.hospitalPhone || activeHospital.phone) && (
                  <div>Telp/WA: {printSettings.hospitalPhone || activeHospital.phone}</div>
                )}
              </div>
            )}
            <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>
          </div>

          {/* Ticket Body */}
          <div style={{ margin: '0.4rem 0' }}>
            <p style={{ fontSize: '0.9em', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>
              {ticket.clinicName}
            </p>
            <div className="thermal-num">{ticket.ticketNumber}</div>
            <p style={{ fontSize: '0.8em', color: '#334155', margin: 0 }}>
              Urutan Ke-<strong>{ticket.sequence}</strong>
            </p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>

            {printSettings.showDateTime && (
              <div style={{ fontSize: '0.78em', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>Tanggal : {formattedDate}</div>
                <div>Pukul   : {formattedTime} WIB</div>
              </div>
            )}

          {/* Footer & QR Code */}
          <div style={{ margin: '0.75rem 0 0.25rem 0' }}>
            {printSettings.showQrCode !== false && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto 8px auto' }}>
                {printSettings.qrCodeImage ? (
                  <img
                    src={printSettings.qrCodeImage}
                    alt="QR Code"
                    style={{
                      width: `${printSettings.qrCodeSize || 75}px`,
                      height: `${printSettings.qrCodeSize || 75}px`,
                      objectFit: 'contain',
                      filter: 'contrast(150%)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: `${printSettings.qrCodeSize || 75}px`,
                    height: `${printSettings.qrCodeSize || 75}px`,
                    border: '1px dashed #475569',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    color: '#64748b',
                    background: '#f8fafc'
                  }}>
                    <QrCode size={Math.min(32, Math.max(16, (printSettings.qrCodeSize || 75) * 0.45))} />
                    <span style={{ fontSize: '9px', fontWeight: 'bold' }}>QR Code</span>
                  </div>
                )}
                {printSettings.qrCodeLabel && (
                  <div style={{ fontSize: '0.68em', color: '#334155', fontWeight: '600', marginTop: '4px', textAlign: 'center' }}>
                    {printSettings.qrCodeLabel}
                  </div>
                )}
              </div>
            )}
            {printSettings.footerText && (
              <div style={{ fontSize: '0.7em', color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                {printSettings.footerText}
              </div>
            )}
          </div>
        </div>

        {/* Buttons (Hidden when printing via .no-print) */}
        <div className="no-print" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={executePrint} style={{ padding: '10px 20px', borderRadius: '10px' }}>
            <Printer size={18} /> Cetak Ulang Struk
          </button>
          <button className="btn-danger" onClick={onClose} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '10px' }}>
            <X size={18} /> Tutup ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
}
