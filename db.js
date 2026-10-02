import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin123',
  multipleStatements: true,
};

const DB_NAME = process.env.DB_NAME || 'antrean_rs';

export async function initDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log(`[MySQL] Connected to server. Ensuring database '${DB_NAME}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();

    const pool = mysql.createPool({
      ...dbConfig,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      timezone: '+07:00'
    });

    const schemaSql = `
      CREATE TABLE IF NOT EXISTS hospitals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tagline VARCHAR(255),
        running_text TEXT,
        logo LONGTEXT,
        print_settings TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS videos (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        url LONGTEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS info_slides (
        id VARCHAR(50) PRIMARY KEY,
        tag VARCHAR(100),
        icon VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        description TEXT,
        sort_order INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS clinics (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        prefix VARCHAR(10) NOT NULL,
        quota INT DEFAULT 50,
        active TINYINT(1) DEFAULT 1,
        description TEXT,
        sort_order INT DEFAULT 0,
        schedule_days VARCHAR(255) DEFAULT 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu'
      );

      CREATE TABLE IF NOT EXISTS counters (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        clinic_id VARCHAR(50),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        assigned_clinic_id VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(100) PRIMARY KEY,
        ticket_number VARCHAR(50) NOT NULL,
        sequence INT NOT NULL,
        clinic_id VARCHAR(50) NOT NULL,
        clinic_name VARCHAR(255),
        prefix VARCHAR(10),
        patient_name VARCHAR(255) DEFAULT 'Pasien Umum',
        nik VARCHAR(50) DEFAULT '-',
        norm VARCHAR(50) DEFAULT '-',
        phone VARCHAR(50) DEFAULT '-',
        patient_type VARCHAR(50) DEFAULT 'BPJS',
        date DATE NOT NULL,
        status ENUM('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED') DEFAULT 'WAITING',
        created_at DATETIME NOT NULL,
        called_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        counter_id VARCHAR(50) DEFAULT NULL,
        counter_name VARCHAR(255) DEFAULT NULL,
        officer_name VARCHAR(255) DEFAULT NULL,
        archived TINYINT(1) DEFAULT 0,
        archived_at DATETIME DEFAULT NULL,
        INDEX idx_date_clinic (date, clinic_id)
      );
    `;

    await pool.query(schemaSql);

    // Auto-migrate missing columns if table already existed
    try {
      await pool.query('ALTER TABLE hospitals ADD COLUMN logo LONGTEXT DEFAULT NULL');
    } catch {
      // Column already exists
    }
    try {
      await pool.query('ALTER TABLE hospitals ADD COLUMN print_settings TEXT DEFAULT NULL');
    } catch {
      // Column already exists
    }
    try {
      await pool.query('ALTER TABLE videos MODIFY COLUMN url LONGTEXT NOT NULL');
    } catch {
      // Column modification ignored if already LONGTEXT
    }

    // Auto-migrate clinics new columns (sort_order, schedule_days)
    try {
      await pool.query('ALTER TABLE clinics ADD COLUMN sort_order INT DEFAULT 0');
    } catch {}
    try {
      await pool.query("ALTER TABLE clinics ADD COLUMN schedule_days VARCHAR(255) DEFAULT 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu'");
    } catch {}

    // Auto-migrate users role & assigned_clinic_id column
    try {
      await pool.query('ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL');
    } catch {}
    try {
      await pool.query('ALTER TABLE users MODIFY COLUMN assigned_clinic_id TEXT DEFAULT NULL');
    } catch {}

    // Auto-migrate hospitals display_settings column
    try {
      await pool.query('ALTER TABLE hospitals ADD COLUMN display_settings TEXT');
    } catch {}

    // Auto-migrate videos duration column
    try {
      await pool.query('ALTER TABLE videos ADD COLUMN duration INT DEFAULT 30');
    } catch {}

    // Migration for Patient details in tickets table
    const patientCols = [
      "ALTER TABLE tickets ADD COLUMN patient_name VARCHAR(255) DEFAULT 'Pasien Umum'",
      "ALTER TABLE tickets ADD COLUMN nik VARCHAR(50) DEFAULT '-'",
      "ALTER TABLE tickets ADD COLUMN norm VARCHAR(50) DEFAULT '-'",
      "ALTER TABLE tickets ADD COLUMN phone VARCHAR(50) DEFAULT '-'",
      "ALTER TABLE tickets ADD COLUMN patient_type VARCHAR(50) DEFAULT 'BPJS'"
    ];
    for (const sql of patientCols) {
      try {
        await pool.query(sql);
      } catch {
        // Column already exists
      }
    }

    // Seed default info_slides if table is empty
    const [slidesCount] = await pool.query('SELECT COUNT(*) as cnt FROM info_slides');
    if (slidesCount[0].cnt === 0) {
      await pool.query(
        `INSERT INTO info_slides (id, tag, icon, title, subtitle, description, sort_order) VALUES
        ('s1', 'INFORMASI LAYANAN', '🏥', 'RSUD HARAPAN SEHAT', 'Melayani Sepenuh Hati Dengan Sentuhan Kasih', 'Kami berkomitmen memberikan pelayanan kesehatan berkualitas tinggi dengan fasilitas modern dan tenaga medis profesional.', 1),
        ('s2', 'ALUR ANTREAN', '🎫', 'AMBIL TIKET ANTREAN', 'Gunakan Kiosk Mandiri di Pintu Masuk', 'Silakan ambil nomor antrean sesuai Poliklinik tujuan Anda dan perhatikan nomor panggil pada Layar Monitor ini.', 2),
        ('s3', 'EDUKASI KESEHATAN', '💡', 'JAGA POLA HIDUP SEHAT', 'Cuci Tangan & Pakai Masker', 'Selalu terapkan protokol kesehatan, cuci tangan 6 langkah, serta jaga kebersihan di area rumah sakit.', 3)`
      );
    }

    console.log('[MySQL] Schema verification completed.');

    // Seed default hospitals
    const [hospitals] = await pool.query('SELECT COUNT(*) as cnt FROM hospitals');
    if (hospitals[0].cnt === 0) {
      await pool.query(
        `INSERT INTO hospitals (name, tagline, running_text) VALUES (?, ?, ?)`,
        [
          'RSUD Harapan Sehat',
          'Layanan Kesehatan Cerdas, Cepat, dan Empati',
          'Selamat datang di RSUD Harapan Sehat. Mohon siapkan kartu identitas / BPJS Anda. Jaga ketertiban dan prokes di ruang tunggu. Informasi pendaftaran hotline: (021) 555-0199.'
        ]
      );
    }

    // Seed default videos
    const [videos] = await pool.query('SELECT COUNT(*) as cnt FROM videos');
    if (videos[0].cnt === 0) {
      await pool.query(
        `INSERT INTO videos (id, title, url) VALUES 
        ('v1', 'Profil RSUD Harapan Sehat', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'),
        ('v2', 'Edukasi Kesehatan Pasien', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4')`
      );
    }

    // Seed default clinics
    const [clinics] = await pool.query('SELECT COUNT(*) as cnt FROM clinics');
    if (clinics[0].cnt === 0) {
      await pool.query(
        `INSERT INTO clinics (id, name, prefix, quota, active, description) VALUES
        ('c1', 'Poliklinik Umum', 'A', 50, 1, 'Pemeriksaan kesehatan umum & rujukan'),
        ('c2', 'Poliklinik Gigi & Mulut', 'B', 30, 1, 'Perawatan & konsultasi kesehatan gigi'),
        ('c3', 'Poliklinik KIA / Kebidanan', 'C', 40, 1, 'Kesehatan ibu, anak, dan imunisasi'),
        ('c4', 'Poliklinik Spesialis Anak', 'D', 25, 1, 'Dokter spesialis kesehatan anak'),
        ('c5', 'Poliklinik Penyakit Dalam', 'E', 35, 1, 'Konsultasi organ dalam & spesialis'),
        ('c6', 'Apotek & Depo Farmasi', 'F', 100, 1, 'Pengambilan resep obat & konsultasi obat')`
      );
    }

    // Seed default counters
    const [counters] = await pool.query('SELECT COUNT(*) as cnt FROM counters');
    if (counters[0].cnt === 0) {
      await pool.query(
        `INSERT INTO counters (id, name, clinic_id) VALUES
        ('l1', 'Loket 1', 'c1'),
        ('l2', 'Loket 2', 'c2'),
        ('l3', 'Loket 3', 'c3'),
        ('l4', 'Loket 4', 'c4'),
        ('l5', 'Loket 5', 'c5'),
        ('l6', 'Loket Farmasi 1', 'c6')`
      );
    }

    // Seed default Users: Admin, Pendaftaran, Poliklinik, Farmasi
    const defaultUsers = [
      {
        id: 'u_admin',
        username: 'admin',
        pass: 'admin123',
        name: 'Super Administrator',
        role: 'ADMIN',
        clinicId: null
      },
      {
        id: 'u_pendaftaran',
        username: 'pendaftaran',
        pass: 'pendaftaran123',
        name: 'Petugas Pendaftaran & Kiosk',
        role: 'PENDAFTARAN',
        clinicId: null
      },
      {
        id: 'u_poliklinik',
        username: 'poliklinik',
        pass: 'poli123',
        name: 'Petugas Poliklinik',
        role: 'POLIKLINIK',
        clinicId: 'c1'
      },
      {
        id: 'u_farmasi',
        username: 'farmasi',
        pass: 'farmasi123',
        name: 'Petugas Farmasi & Apotek',
        role: 'FARMASI',
        clinicId: 'c6'
      }
    ];

    for (const u of defaultUsers) {
      const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [u.username]);
      if (existing.length === 0) {
        const passHash = await bcrypt.hash(u.pass, 10);
        await pool.query(
          `INSERT INTO users (id, username, password, name, role, assigned_clinic_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [u.id, u.username, passHash, u.name, u.role, u.clinicId]
        );
      }
    }

    return pool;
  } catch (err) {
    console.error('[MySQL Error] Failed to initialize MySQL database:', err);
    throw err;
  }
}
