# 🏥 AntreanRS

Sistem antrean poliklinik dan rumah sakit cerdas berbasis web real-time dengan integrasi 4 layar (Kiosk, TV Display, Konsol Petugas, dan Admin Dashboard) serta dukungan pencetakan tiket thermal otomatis.

---

## 🖥️ 4 Layar Utama

* **Kiosk Mandiri (`/?view=kiosk`)**: Layar pasien mengambil tiket antrean dan input data identitas.
* **TV Display (`/?view=tv`)**: Layar monitor ruang tunggu pemanggilan nomor antrean, video edukasi, dan teks berjalan.
* **Layar Petugas (`/?view=officer`)**: Konsol pemanggilan, panggil ulang, lewati, dan selesaikan antrean pasien.
* **Dashboard Admin (`/?view=admin`)**: Pengaturan poliklinik, loket, profil RS, video, pengguna, dan laporan riwayat antrean.

---

## 🔑 Akun & Kredensial Awal

Kredensial pengguna awal dikonfigurasi melalui berkas `.env` (`INITIAL_ADMIN_PASSWORD`, dll). Jika tidak diatur, sistem akan men-generate password acak yang aman saat inisialisasi awal.

| Role | Username | Password Awal | Akses Layar |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | *Dikonfigurasi di `.env`* | Semua Layar & Dashboard Admin |
| **Pendaftaran** | `pendaftaran` | *Dikonfigurasi di `.env`* | Kiosk Mandiri Pasien |
| **Poliklinik** | `poliklinik` | *Dikonfigurasi di `.env`* | Konsol Petugas Poliklinik |
| **Farmasi** | `farmasi` | *Dikonfigurasi di `.env`* | Konsol Petugas Farmasi |

---

## 🚀 Cara Menjalankan

### 1. Pasang Dependensi
```bash
npm install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin berkas konfigurasi template:
```bash
cp .env.example .env
```
Sesuaikan password MySQL/MariaDB dan kunci rahasia pada file `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=PasswordDatabaseAnda
DB_NAME=antrean_rs
JWT_SECRET=KunciRahasiaJWT32KarakterAcak
PORT=3001
```

### 3. Jalankan Aplikasi
```bash
# Mode Development (Frontend :3000 & Backend :3001)
npm run dev
```

Buka di browser: **`http://localhost:3000`**

Untuk mode produksi:
```bash
npm run build
npm start
```

---

## 🖨️ Cetak Tiket Thermal (Silent Print)

Untuk mencetak tiket langsung ke printer thermal USB tanpa dialog konfirmasi browser:
1. Buka folder `windows-print-bridge/`.
2. Jalankan `jalankan-printer-bridge.bat` (atau `pasang-autostart-background.bat` sebagai Administrator).
3. Service akan aktif di `http://localhost:18080` dan langsung melayani perintah cetak dari Kiosk.

---

## 🧰 Tech Stack

* **Frontend**: React 19, Vite, Socket.IO Client, Lucide Icons.
* **Backend**: Node.js, Express 5, Socket.IO, Multer, Helmet, Rate-Limit, JWT.
* **Database**: MySQL / MariaDB (`mysql2`).
