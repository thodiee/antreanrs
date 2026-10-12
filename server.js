import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'antreanrs-secure-jwt-secret-key-2026';

// Helper to sign JWT
export function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      assignedClinicId: user.assignedClinicId || user.assigned_clinic_id || null
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Helper to verify JWT
export function verifyUserToken(token) {
  try {
    if (!token) return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    return jwt.verify(cleanToken, JWT_SECRET);
  } catch {
    return null;
  }
}

// Middleware to enforce authentication & role-based access control
export function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Akses ditolak. Token autentikasi diperlukan.' });
    }
    const user = verifyUserToken(authHeader);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Token autentikasi tidak valid atau telah kadaluarsa.' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' });
    }
    req.user = user;
    next();
  };
}

// SSRF prevention: validate that URL is http/https and not pointing to localhost / private network
export function isSafePublicUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host === '169.254.169.254' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Rate limiting for login (prevent brute-force attacks)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15, // max 15 percobaaan per IP
  message: { success: false, error: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API rate limiting (protection against DoS / resource exhaustion)
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 2e7, // Limit socket buffer to 20 MB (safe from memory exhaustion)
});

// HTTP Security Headers via Helmet (with permissive CSP for local thermal print & external videos)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use('/api', generalApiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

// Serve downloaded media & promotional videos directly
const mediaDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}
app.use('/videos', express.static(mediaDir));

// Multer storage for local video uploads with sanitized filenames & format whitelisting
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, mediaDir),
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase() || '.mp4';
    const allowedExts = ['.mp4', '.webm', '.mkv', '.mov', '.avi'];
    const ext = allowedExts.includes(rawExt) ? rawExt : '.mp4';
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    const id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    cb(null, `${id}_${cleanBase}${ext}`);
  }
});

const uploadVideoMiddleware = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // Max 500 MB per video upload
  fileFilter: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp4', '.webm', '.mkv', '.mov', '.avi'];
    if (!allowedExts.includes(rawExt)) {
      return cb(new Error('Format file tidak didukung. Hanya file video yang diizinkan (.mp4, .webm, .mov, dll).'));
    }
    cb(null, true);
  }
});

// Dedicated endpoint for uploading local video files (.mp4, .webm, etc.) with Admin Authorization
app.post('/api/upload-video', requireAuth(['ADMIN']), (req, res, next) => {
  uploadVideoMiddleware.single('video')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Ukuran file video melebihi batas maksimal (500 MB).' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memproses file video.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File video tidak ditemukan.' });
    }
    const relativeUrl = `/videos/${req.file.filename}`;
    const rawTitle = req.body?.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const videoId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    let nextOrder = 1;
    try {
      const [orderRows] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM videos');
      nextOrder = (orderRows[0]?.max_order ?? 0) + 1;
      await pool.query(
        'INSERT INTO videos (id, title, url, duration, sort_order) VALUES (?, ?, ?, ?, ?)',
        [videoId, rawTitle, relativeUrl, 0, nextOrder]
      );
      console.log(`[Video-Upload] Video saved to database: ${videoId} (${rawTitle}) with sort_order=${nextOrder}`);
      
      // Broadcast state update immediately
      const updatedState = await getFullState();
      io.emit('state_update', updatedState);
    } catch (dbErr) {
      console.error('Error inserting uploaded video into DB:', dbErr);
    }

    const videoObj = {
      id: videoId,
      title: rawTitle,
      url: relativeUrl,
      duration: 0,
      sortOrder: nextOrder
    };
    console.log(`[Video-Upload] File video uploaded successfully: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ success: true, video: videoObj });
  } catch (err) {
    console.error('Error uploading video file:', err);
    res.status(500).json({ success: false, error: 'Gagal mengunggah file video.' });
  }
});

const activeVideoDownloads = new Set();

async function downloadSocialVideo(video) {
  if (!video || !video.id || !video.url) return null;
  const videoId = video.id;
  const url = video.url;
  const fileName = `${videoId}.mp4`;
  const filePath = path.join(mediaDir, fileName);

  // If already exists and valid size (> 50KB), return immediately
  if (fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 50000) {
        return `/videos/${fileName}`;
      }
    } catch (e) {}
  }

  // Check if URL is a social video that benefits from local caching (Instagram, TikTok, YouTube)
  const isSocial = /tiktok\.com|instagram\.com|youtube\.com|youtu\.be/i.test(url);
  if (!isSocial) return null;

  if (activeVideoDownloads.has(videoId)) return null;
  activeVideoDownloads.add(videoId);

  console.log(`[Video-Sync] Mengunduh video latar belakang untuk TV: "${video.title || videoId}" (${videoId})`);

  const ytdlpPath = path.join(__dirname, 'yt-dlp');
  const bin = fs.existsSync(ytdlpPath) ? ytdlpPath : 'yt-dlp';

  return new Promise((resolve) => {
    const child = spawn(bin, [
      '-f', 'b/best',
      '-o', filePath,
      '--no-playlist',
      '--',
      url
    ], { stdio: 'pipe' });

    child.on('close', async (code) => {
      activeVideoDownloads.delete(videoId);
      if (code === 0 && fs.existsSync(filePath)) {
        console.log(`[Video-Sync] SUKSES mengunduh video "${video.title}" -> /videos/${fileName}`);
        io.emit('video_ready', { id: videoId, localUrl: `/videos/${fileName}` });
        resolve(`/videos/${fileName}`);
      } else {
        console.warn(`[Video-Sync] Gagal mengunduh video "${video.title}", code: ${code}`);
        resolve(null);
      }
    });

    child.on('error', (err) => {
      activeVideoDownloads.delete(videoId);
      console.warn(`[Video-Sync] Error spawn yt-dlp:`, err.message);
      resolve(null);
    });
  });
}

function syncAllVideos(videos) {
  if (!Array.isArray(videos)) return;
  for (const v of videos) {
    downloadSocialVideo(v).catch((err) => console.error('[Video-Sync] Error:', err));
  }
}

app.get('/api/download-print-bridge', (req, res) => {
  res.download(path.join(__dirname, 'windows-print-bridge.zip'), 'windows-print-bridge.zip');
});

let pool;

// Local date helpers to avoid UTC timezone day-slipping in GMT+7
function getLocalDateStr() {
  return new Date().toLocaleDateString('en-CA');
}

function formatTicketDate(d) {
  if (!d) return getLocalDateStr();
  if (typeof d === 'string') return d.split('T')[0];
  try {
    return new Date(d).toLocaleDateString('en-CA');
  } catch {
    return getLocalDateStr();
  }
}

// Debounce tracking map: IP/Clinic -> timestamp
const lastTicketTime = new Map();

async function resolveVideoRedirect(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!isSafePublicUrl(trimmed)) return trimmed;
  if (trimmed.includes('vt.tiktok.com') || trimmed.includes('vm.tiktok.com') || trimmed.includes('tiktok.com/t/')) {
    try {
      const resp = await fetch(trimmed, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow'
      });
      return resp.url || trimmed;
    } catch (e) {
      return trimmed;
    }
  }
  return trimmed;
}

// PII masking for public screens (TV and unauthenticated Kiosk)
function maskPatientData(t) {
  const nik = t.nik && t.nik !== '-' && t.nik.length > 6
    ? t.nik.slice(0, 4) + '******' + t.nik.slice(-4)
    : t.nik;
  const phone = t.phone && t.phone !== '-' && t.phone.length > 6
    ? t.phone.slice(0, 4) + '****' + t.phone.slice(-3)
    : t.phone;
  return {
    ...t,
    nik,
    phone
  };
}

// Helper to load current database state with PII masking for non-staff
async function getFullState(user = null) {
  const [hospitals] = await pool.query('SELECT name, tagline, running_text AS runningText, logo, print_settings AS printSettings, display_settings AS displaySettings FROM hospitals LIMIT 1');
  const [videos] = await pool.query('SELECT id, title, url, COALESCE(duration, 0) AS duration, COALESCE(sort_order, 0) AS sortOrder FROM videos ORDER BY sort_order ASC, id ASC');
  
  // Auto-resolve any short TikTok links in database
  for (const v of videos) {
    if (v.url && (v.url.includes('vt.tiktok.com') || v.url.includes('vm.tiktok.com') || v.url.includes('tiktok.com/t/'))) {
      try {
        const resolved = await resolveVideoRedirect(v.url);
        if (resolved && resolved !== v.url) {
          v.url = resolved;
          await pool.query('UPDATE videos SET url = ? WHERE id = ?', [resolved, v.id]).catch(() => {});
        }
      } catch (e) {}
    }
  }
  const [infoSlides] = await pool.query('SELECT id, tag, icon, title, subtitle, description, sort_order AS sortOrder FROM info_slides ORDER BY sort_order ASC');
  const [clinics] = await pool.query('SELECT id, name, prefix, quota, active, description, sort_order AS sortOrder, schedule_days AS scheduleDays FROM clinics ORDER BY sort_order ASC, name ASC');
  const [counters] = await pool.query('SELECT id, name, clinic_id AS clinicId FROM counters');

  const today = getLocalDateStr();
  const [tickets] = await pool.query(
    `SELECT id, ticket_number AS ticketNumber, sequence, clinic_id AS clinicId, 
            clinic_name AS clinicName, prefix, 
            patient_name AS patientName, nik, norm, phone, patient_type AS patientType,
            date, status, 
            created_at AS createdAt, called_at AS calledAt, completed_at AS completedAt,
            counter_id AS counterId, counter_name AS counterName, officer_name AS officerName
     FROM tickets 
     WHERE date = ? AND archived = 0 
     ORDER BY created_at ASC`,
    [today]
  );

  const [history] = await pool.query(
    `SELECT id, ticket_number AS ticketNumber, sequence, clinic_id AS clinicId, 
            clinic_name AS clinicName, prefix, 
            patient_name AS patientName, nik, norm, phone, patient_type AS patientType,
            date, status, 
            created_at AS createdAt, called_at AS calledAt, completed_at AS completedAt,
            counter_id AS counterId, counter_name AS counterName, officer_name AS officerName,
            archived_at AS archivedAt
     FROM tickets 
     WHERE archived = 1 
     ORDER BY archived_at DESC LIMIT 100`
  );

  const defaultPrintSettings = {
    paperWidth: '58mm',
    fontSize: 'medium',
    showLogo: true,
    logoHeight: 60,
    headerSubtitle: 'Sistem Antrean Poliklinik Terpadu',
    footerText: '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *',
    showBarcode: true,
    showDateTime: true,
    autoPrint: true,
    quickPrint: true
  };

  const hospitalObj = hospitals[0] || {
    name: 'RSUD Harapan Sehat',
    tagline: 'Layanan Kesehatan Cerdas, Cepat, dan Empati',
    runningText: 'Selamat datang di RSUD Harapan Sehat.'
  };

  let parsedPrintSettings = defaultPrintSettings;
  if (hospitalObj.printSettings) {
    try {
      const parsed = typeof hospitalObj.printSettings === 'string'
        ? JSON.parse(hospitalObj.printSettings)
        : hospitalObj.printSettings;
      parsedPrintSettings = { ...defaultPrintSettings, ...parsed };
    } catch {
      parsedPrintSettings = defaultPrintSettings;
    }
  }
  hospitalObj.printSettings = parsedPrintSettings;

  const defaultDisplaySettings = {
    layoutRatio: '50-50',
    aspectRatio: '16-9',
    objectFit: 'contain',
    position: 'right'
  };

  let parsedDisplaySettings = defaultDisplaySettings;
  if (hospitalObj.displaySettings) {
    try {
      const parsed = typeof hospitalObj.displaySettings === 'string'
        ? JSON.parse(hospitalObj.displaySettings)
        : hospitalObj.displaySettings;
      parsedDisplaySettings = { ...defaultDisplaySettings, ...parsed };
    } catch {
      parsedDisplaySettings = defaultDisplaySettings;
    }
  }
  hospitalObj.displaySettings = parsedDisplaySettings;

  const formattedVideos = (videos || []).map(v => {
    const videoFile = `${v.id}.mp4`;
    const localPath = path.join(mediaDir, videoFile);
    let hasLocal = false;
    try {
      hasLocal = fs.existsSync(localPath) && fs.statSync(localPath).size > 50000;
    } catch (e) {}
    return {
      ...v,
      localUrl: hasLocal ? `/videos/${videoFile}` : null
    };
  });
  hospitalObj.videoList = formattedVideos;
  hospitalObj.infoSlides = infoSlides;

  // Background sync any uncached social videos
  syncAllVideos(videos);

  // Ensure active boolean formatting & scheduleDays default string
  const formattedClinics = clinics.map(c => ({
    ...c,
    active: Boolean(c.active),
    sortOrder: c.sortOrder || 0,
    scheduleDays: c.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu'
  }));

  const isStaff = user && ['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER', 'PENDAFTARAN'].includes(user.role);

  const formattedTickets = tickets.map(t => {
    const formatted = {
      ...t,
      date: formatTicketDate(t.date),
      createdAt: t.createdAt ? (typeof t.createdAt === 'string' ? t.createdAt : new Date(t.createdAt).toISOString()) : null,
      calledAt: t.calledAt ? (typeof t.calledAt === 'string' ? t.calledAt : new Date(t.calledAt).toISOString()) : null,
      completedAt: t.completedAt ? (typeof t.completedAt === 'string' ? t.completedAt : new Date(t.completedAt).toISOString()) : null
    };
    return isStaff ? formatted : maskPatientData(formatted);
  });

  const formattedHistory = history.map(t => {
    const formatted = {
      ...t,
      date: formatTicketDate(t.date),
      createdAt: t.createdAt ? (typeof t.createdAt === 'string' ? t.createdAt : new Date(t.createdAt).toISOString()) : null,
      calledAt: t.calledAt ? (typeof t.calledAt === 'string' ? t.calledAt : new Date(t.calledAt).toISOString()) : null,
      completedAt: t.completedAt ? (typeof t.completedAt === 'string' ? t.completedAt : new Date(t.completedAt).toISOString()) : null,
      archivedAt: t.archivedAt ? (typeof t.archivedAt === 'string' ? t.archivedAt : new Date(t.archivedAt).toISOString()) : null
    };
    return isStaff ? formatted : maskPatientData(formatted);
  });

  return {
    hospital: hospitalObj,
    clinics: formattedClinics,
    counters,
    tickets: formattedTickets,
    history: formattedHistory,
    lastResetDate: today
  };
}

// Authentication API with rate limiter & JWT token issuance
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan password wajib diisi.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, error: 'Username tidak ditemukan.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Password yang Anda masukkan salah.' });
    }

    const assignedClinicId = user.assigned_clinic_id || '';
    const assignedClinicIds = assignedClinicId ? assignedClinicId.split(',').map(s => s.trim()).filter(Boolean) : [];

    const token = signUserToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      assignedClinicId
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        assignedClinicId,
        assignedClinicIds,
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem login.' });
  }
});

// User Management APIs - Strictly Admin Only
app.get('/api/users', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, name, role, assigned_clinic_id AS assignedClinicId, created_at AS createdAt FROM users ORDER BY created_at ASC'
    );
    const users = rows.map(u => ({
      ...u,
      assignedClinicIds: u.assignedClinicId ? u.assignedClinicId.split(',').map(s => s.trim()).filter(Boolean) : []
    }));
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data pengguna.' });
  }
});

app.post('/api/users', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { username, password, name, role, assignedClinicId, assignedClinicIds } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ success: false, error: 'Username, password, nama, dan role wajib diisi.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Username sudah digunakan.' });
    }

    let finalClinicId = null;
    if (Array.isArray(assignedClinicIds) && assignedClinicIds.length > 0) {
      finalClinicId = assignedClinicIds.join(',');
    } else if (typeof assignedClinicId === 'string' && assignedClinicId.trim()) {
      finalClinicId = assignedClinicId.trim();
    }

    const passHash = await bcrypt.hash(password, 10);
    const userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    await pool.query(
      'INSERT INTO users (id, username, password, name, role, assigned_clinic_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username.trim(), passHash, name.trim(), role, finalClinicId]
    );

    res.json({ success: true, message: 'Pengguna baru berhasil ditambahkan.' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, error: 'Gagal menambahkan pengguna.' });
  }
});

app.put('/api/users/:id', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, assignedClinicId, assignedClinicIds, password } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, error: 'Nama dan role wajib diisi.' });
    }

    let finalClinicId = null;
    if (Array.isArray(assignedClinicIds)) {
      finalClinicId = assignedClinicIds.length > 0 ? assignedClinicIds.join(',') : null;
    } else if (typeof assignedClinicId === 'string' && assignedClinicId.trim()) {
      finalClinicId = assignedClinicId.trim();
    }

    if (password && password.trim()) {
      const passHash = await bcrypt.hash(password.trim(), 10);
      await pool.query(
        'UPDATE users SET name = ?, role = ?, assigned_clinic_id = ?, password = ? WHERE id = ?',
        [name.trim(), role, finalClinicId, passHash, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, role = ?, assigned_clinic_id = ? WHERE id = ?',
        [name.trim(), role, finalClinicId, id]
      );
    }

    res.json({ success: true, message: 'Data pengguna berhasil diperbarui.' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, error: 'Gagal memperbarui pengguna.' });
  }
});

app.delete('/api/users/:id', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const [userRows] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
    }

    // Check if this is the only admin
    if (userRows[0].role === 'ADMIN') {
      const [adminCount] = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE role = "ADMIN"');
      if (adminCount[0].cnt <= 1) {
        return res.status(400).json({ success: false, error: 'Tidak dapat menghapus satu-satunya akun Administrator.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus pengguna.' });
  }
});

// REST APIs
app.get('/api/resolve-video-url', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }
  const url = rawUrl.trim();
  if (!isSafePublicUrl(url)) {
    return res.status(400).json({ error: 'URL tidak valid atau mengarah ke alamat internal/lokal yang dilarang.' });
  }

  try {
    let resolvedUrl = url;
    let title = '';
    let author = '';
    let thumbnailUrl = null;
    let type = 'direct';

    if (url.includes('tiktok.com')) {
      type = 'tiktok';
      resolvedUrl = await resolveVideoRedirect(url);
      try {
        const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || '';
          author = oembedData.author_name || '';
          thumbnailUrl = oembedData.thumbnail_url || null;
        }
      } catch (e) {}
    } else if (url.includes('instagram.com') || url.includes('instagr.am')) {
      type = 'instagram';
      resolvedUrl = url;
      title = 'Instagram Video';
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
      resolvedUrl = url;
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || '';
          thumbnailUrl = oembedData.thumbnail_url || null;
        }
      } catch (e) {}
    }

    res.json({
      originalUrl: url,
      resolvedUrl,
      type,
      title,
      author,
      thumbnailUrl
    });
  } catch (err) {
    console.error('Resolve video URL error:', err);
    res.json({ originalUrl: url, resolvedUrl: url, type: 'direct' });
  }
});

app.get('/api/initial-state', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const user = authHeader ? verifyUserToken(authHeader) : null;
    const state = await getFullState(user);
    res.json(state);
  } catch (err) {
    console.error('Error fetching initial state:', err);
    res.status(500).json({ error: 'Database query error' });
  }
});

app.get('/api/reports/daily', requireAuth(['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER', 'PENDAFTARAN']), async (req, res) => {
  try {
    const today = getLocalDateStr();
    const [tickets] = await pool.query(
      `SELECT * FROM tickets WHERE date = ? AND archived = 0`,
      [today]
    );
    const [clinics] = await pool.query(`SELECT id, name, prefix FROM clinics`);

    const clinicStats = clinics.map(clinic => {
      const list = tickets.filter(t => t.clinic_id === clinic.id);
      const total = list.length;
      const completed = list.filter(t => t.status === 'COMPLETED').length;
      const skipped = list.filter(t => t.status === 'SKIPPED').length;
      const waiting = list.filter(t => t.status === 'WAITING').length;
      const called = list.filter(t => t.status === 'CALLED' || t.status === 'SERVING').length;

      const completedItems = list.filter(t => t.status === 'COMPLETED' && t.called_at && t.created_at);
      let avgWaitSec = 0;
      if (completedItems.length > 0) {
        const sum = completedItems.reduce((acc, t) => acc + (new Date(t.called_at) - new Date(t.created_at)) / 1000, 0);
        avgWaitSec = Math.round(sum / completedItems.length);
      }

      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        prefix: clinic.prefix,
        total,
        completed,
        skipped,
        waiting,
        called,
        avgWaitSec
      };
    });

    res.json({
      date: today,
      totalTickets: tickets.length,
      totalCompleted: tickets.filter(t => t.status === 'COMPLETED').length,
      totalSkipped: tickets.filter(t => t.status === 'SKIPPED').length,
      clinicStats
    });
  } catch (err) {
    console.error('Error daily report API:', err);
    res.status(500).json({ error: 'Database report error' });
  }
});

// Helper to escape and sanitize CSV fields against Formula Injection (=, +, -, @)
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str}"`;
}

app.get('/api/reports/export-csv', requireAuth(['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER', 'PENDAFTARAN']), async (req, res) => {
  try {
    const today = getLocalDateStr();
    const [tickets] = await pool.query(`SELECT * FROM tickets ORDER BY created_at DESC LIMIT 500`);
    const [clinics] = await pool.query(`SELECT id, name FROM clinics`);

    let csvContent = 'ID,Nomor Antrean,Poliklinik,Nama Pasien,NIK/RM,No HP,Jenis Pasien,Tanggal,Jam Diambil,Jam Dipanggil,Jam Selesai,Status,Loket,Petugas\n';
    tickets.forEach(t => {
      const clinic = clinics.find(c => c.id === t.clinic_id)?.name || t.clinic_id;
      const timeCreated = t.created_at ? new Date(t.created_at).toLocaleTimeString('id-ID') : '-';
      const timeCalled = t.called_at ? new Date(t.called_at).toLocaleTimeString('id-ID') : '-';
      const timeCompleted = t.completed_at ? new Date(t.completed_at).toLocaleTimeString('id-ID') : '-';
      const ticketDate = formatTicketDate(t.date);
      const patientName = t.patient_name || 'Pasien Umum';
      const nikRm = t.nik !== '-' ? t.nik : (t.norm !== '-' ? t.norm : '-');
      const phone = t.phone || '-';
      const patientType = t.patient_type || 'BPJS';

      csvContent += `${sanitizeCsvCell(t.id)},${sanitizeCsvCell(t.ticket_number)},${sanitizeCsvCell(clinic)},${sanitizeCsvCell(patientName)},${sanitizeCsvCell(nikRm)},${sanitizeCsvCell(phone)},${sanitizeCsvCell(patientType)},${sanitizeCsvCell(ticketDate)},${sanitizeCsvCell(timeCreated)},${sanitizeCsvCell(timeCalled)},${sanitizeCsvCell(timeCompleted)},${sanitizeCsvCell(t.status)},${sanitizeCsvCell(t.counter_name || '-')},${sanitizeCsvCell(t.officer_name || '-')}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-antrean-${today}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error export CSV:', err);
    res.status(500).send('Error generating CSV export');
  }
});

// Helper for saving hospital, videos, and clinic settings
async function processSaveSettings(payload) {
  if (payload.hospital) {
    const { 
      name = 'RSUD Harapan Sehat', 
      tagline = '', 
      runningText = '', 
      logo = null, 
      printSettings = null,
      displaySettings = null 
    } = payload.hospital;
    const printSettingsStr = printSettings ? JSON.stringify(printSettings) : null;
    const displaySettingsStr = displaySettings ? JSON.stringify(displaySettings) : null;

    const [rows] = await pool.query('SELECT id FROM hospitals LIMIT 1');
    if (rows.length > 0) {
      await pool.query(
        `UPDATE hospitals SET name = ?, tagline = ?, running_text = ?, logo = ?, print_settings = ?, display_settings = ? WHERE id = ?`,
        [name, tagline, runningText, logo, printSettingsStr, displaySettingsStr, rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO hospitals (name, tagline, running_text, logo, print_settings, display_settings) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, tagline, runningText, logo, printSettingsStr, displaySettingsStr]
      );
    }
  }

  if (payload.videos && Array.isArray(payload.videos)) {
    await pool.query('DELETE FROM videos');
    for (let i = 0; i < payload.videos.length; i++) {
      const v = payload.videos[i];
      if (v.title && v.url) {
        let saveUrl = v.url;

        // Auto-save base64 video to file if any were sent directly (with path traversal protection)
        if (typeof saveUrl === 'string' && saveUrl.startsWith('data:video/')) {
          try {
            const matches = saveUrl.match(/^data:video\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (matches) {
              const ext = matches[1] === 'webm' ? '.webm' : '.mp4';
              const cleanId = String(v.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
              const fileId = cleanId || `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
              const filename = `${fileId}${ext}`;
              const filePath = path.join(mediaDir, path.basename(filename));
              const buffer = Buffer.from(matches[2], 'base64');
              fs.writeFileSync(filePath, buffer);
              saveUrl = `/videos/${filename}`;
              console.log(`[Video-Save] Base64 video written to disk: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
            }
          } catch (e) {
            console.warn('[Video-Save] Failed to save base64 video to disk:', e);
          }
        } else {
          saveUrl = await resolveVideoRedirect(saveUrl);
        }

        const durationVal = (v.duration !== undefined && v.duration !== null && !isNaN(parseInt(v.duration))) ? parseInt(v.duration) : 0;
        const sortOrder = i + 1;

        await pool.query(
          `INSERT INTO videos (id, title, url, duration, sort_order) VALUES (?, ?, ?, ?, ?)`,
          [v.id || `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, v.title, saveUrl, durationVal, sortOrder]
        );
      }
    }
    syncAllVideos(payload.videos);
  }

  if (payload.infoSlides && Array.isArray(payload.infoSlides)) {
    await pool.query('DELETE FROM info_slides');
    let idx = 1;
    for (const s of payload.infoSlides) {
      if (s.title) {
        await pool.query(
          `INSERT INTO info_slides (id, tag, icon, title, subtitle, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id || `s_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            s.tag || 'INFORMASI LAYANAN',
            s.icon || '🏥',
            s.title,
            s.subtitle || '',
            s.description || '',
            s.sortOrder || idx++
          ]
        );
      }
    }
  }

  if (payload.clinics && Array.isArray(payload.clinics)) {
    for (let i = 0; i < payload.clinics.length; i++) {
      const c = payload.clinics[i];
      const sortOrder = c.sortOrder !== undefined ? c.sortOrder : i + 1;
      const scheduleDays = Array.isArray(c.scheduleDays) ? c.scheduleDays.join(',') : (c.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu');

      await pool.query(
        `INSERT INTO clinics (id, name, prefix, quota, active, description, sort_order, schedule_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), 
           prefix = VALUES(prefix), 
           quota = VALUES(quota), 
           active = VALUES(active), 
           description = VALUES(description),
           sort_order = VALUES(sort_order),
           schedule_days = VALUES(schedule_days)`,
        [c.id, c.name, c.prefix, c.quota, c.active ? 1 : 0, c.description || '', sortOrder, scheduleDays]
      );
    }
  }

  if (payload.counters && Array.isArray(payload.counters)) {
    await pool.query('DELETE FROM counters');
    for (const cnt of payload.counters) {
      if (cnt.name) {
        await pool.query(
          `INSERT INTO counters (id, name, clinic_id) VALUES (?, ?, ?)`,
          [cnt.id || `l_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, cnt.name, cnt.clinicId || null]
        );
      }
    }
  }

  const updatedState = await getFullState();
  io.emit('settings_updated', { hospital: updatedState.hospital, clinics: updatedState.clinics, counters: updatedState.counters });
  return updatedState;
}

app.post('/api/settings', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const updatedState = await processSaveSettings(req.body);
    res.json({ success: true, hospital: updatedState.hospital, clinics: updatedState.clinics, counters: updatedState.counters });
  } catch (err) {
    console.error('REST API /api/settings error:', err);
    res.status(500).json({ success: false, error: 'Gagal merubah pengaturan.' });
  }
});

// REST API endpoint for Manual Shift Reset with Admin / Pendaftaran Authorization
app.post('/api/reset-shift', requireAuth(['ADMIN', 'PENDAFTARAN']), async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE tickets SET archived = 1, archived_at = NOW() WHERE archived = 0`
    );

    lastTicketTime.clear();
    const newState = await getFullState(req.user);
    io.emit('shift_reset', newState);
    console.log(`[Shift-Reset] Manual reset shift executed via REST by ${req.user.username}. ${result.affectedRows} tiket diarsipkan.`);

    res.json({
      success: true,
      message: 'Shift antrean berhasil di-reset menjadi 001.',
      affectedTickets: result.affectedRows,
      state: newState
    });
  } catch (err) {
    console.error('REST API /api/reset-shift error:', err);
    res.status(500).json({ success: false, error: 'Gagal me-reset shift antrean di database.' });
  }
});

// Fallback to index.html for SPA routing (Express v5 compatible)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
  next();
});

// Helper to resolve socket authenticated user
function getSocketUser(socket, payload) {
  if (socket.data.user) return socket.data.user;
  if (payload && payload.token) {
    const verified = verifyUserToken(payload.token);
    if (verified) {
      socket.data.user = verified;
      return verified;
    }
  }
  return null;
}

// Real-Time Socket Events with Authentication & Role Verification
io.on('connection', async (socket) => {
  console.log('[Socket] Client connected:', socket.id);

  // Authenticate from handshake auth token
  const initialToken = socket.handshake.auth?.token;
  socket.data.user = initialToken ? verifyUserToken(initialToken) : null;

  socket.on('authenticate', ({ token }) => {
    socket.data.user = token ? verifyUserToken(token) : null;
    console.log(`[Socket] Client ${socket.id} authenticated as:`, socket.data.user ? `${socket.data.user.username} (${socket.data.user.role})` : 'Guest');
  });

  try {
    const currentState = await getFullState(socket.data.user);
    socket.emit('state_sync', currentState);
  } catch (err) {
    console.error('Socket state_sync error:', err);
  }

  // 1. Create Ticket (Kiosk) - With genuine IP debouncing
  socket.on('create_ticket', async (payload, callback) => {
    try {
      const { 
        clinicId, 
        patientName = 'Pasien Umum',
        nik = '-',
        norm = '-',
        phone = '-',
        patientType = 'BPJS'
      } = payload || {};
      
      const forwarded = socket.handshake.headers['x-forwarded-for'];
      const realIp = (forwarded ? forwarded.split(',')[0].trim() : null) || socket.handshake.address || socket.conn.remoteAddress || 'local';
      
      const now = Date.now();
      const key = `${realIp}_${clinicId}`;

      if (lastTicketTime.has(key) && (now - lastTicketTime.get(key) < 2000)) {
        if (callback) callback({ success: false, error: 'Silakan tunggu 2 detik sebelum mengambil tiket lagi (Debounce Protection).' });
        return;
      }
      lastTicketTime.set(key, now);

      const [clinics] = await pool.query('SELECT * FROM clinics WHERE id = ?', [clinicId]);
      const clinic = clinics[0];

      if (!clinic) {
        if (callback) callback({ success: false, error: 'Poliklinik tidak ditemukan.' });
        return;
      }

      if (!clinic.active) {
        if (callback) callback({ success: false, error: 'Poliklinik sedang tidak aktif.' });
        return;
      }

      const today = getLocalDateStr();
      const [todayTickets] = await pool.query(
        'SELECT COUNT(*) as cnt FROM tickets WHERE clinic_id = ? AND date = ? AND archived = 0',
        [clinicId, today]
      );

      const countToday = todayTickets[0].cnt;
      if (countToday >= clinic.quota) {
        if (callback) callback({ success: false, error: `Kuota pendaftaran ${clinic.name} hari ini (${clinic.quota} pasien) telah penuh.` });
        return;
      }

      const nextSeq = countToday + 1;
      const seqPadded = String(nextSeq).padStart(3, '0');
      const ticketNumber = `${clinic.prefix}-${seqPadded}`;
      const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const createdAtStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const safePatientName = (patientName && String(patientName).trim()) ? String(patientName).trim() : 'Pasien Umum';
      const safeNik = (nik && String(nik).trim()) ? String(nik).trim() : '-';
      const safeNorm = (norm && String(norm).trim()) ? String(norm).trim() : '-';
      const safePhone = (phone && String(phone).trim()) ? String(phone).trim() : '-';
      const safePatientType = (patientType && String(patientType).trim()) ? String(patientType).trim() : 'BPJS';

      await pool.query(
        `INSERT INTO tickets (id, ticket_number, sequence, clinic_id, clinic_name, prefix, patient_name, nik, norm, phone, patient_type, date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?)`,
        [ticketId, ticketNumber, nextSeq, clinic.id, clinic.name, clinic.prefix, safePatientName, safeNik, safeNorm, safePhone, safePatientType, today, createdAtStr]
      );

      const newTicket = {
        id: ticketId,
        ticketNumber,
        sequence: nextSeq,
        clinicId: clinic.id,
        clinicName: clinic.name,
        prefix: clinic.prefix,
        patientName: safePatientName,
        nik: safeNik,
        norm: safeNorm,
        phone: safePhone,
        patientType: safePatientType,
        date: today,
        status: 'WAITING',
        createdAt: new Date().toISOString()
      };

      io.emit('ticket_created', { ticket: newTicket });
      if (callback) callback({ success: true, ticket: newTicket });
    } catch (err) {
      console.error('create_ticket error:', err);
      if (callback) callback({ success: false, error: 'Gagal membuat tiket antrean di database.' });
    }
  });

  // 2. Call Ticket (Officer) - Requires Staff/Admin Role
  socket.on('call_ticket', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || !['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER'].includes(user.role)) {
        if (callback) callback({ success: false, error: 'Akses ditolak. Pemanggilan tiket memerlukan login Petugas atau Admin.' });
        return;
      }

      const { ticketId, counterId, counterName, officerName, clinicId } = payload || {};
      let targetTicketId = ticketId;

      if (!targetTicketId && clinicId) {
        const today = getLocalDateStr();
        const [waiting] = await pool.query(
          `SELECT id FROM tickets WHERE clinic_id = ? AND date = ? AND status = 'WAITING' AND archived = 0 ORDER BY created_at ASC LIMIT 1`,
          [clinicId, today]
        );
        if (waiting.length > 0) targetTicketId = waiting[0].id;
      }

      if (!targetTicketId) {
        if (callback) callback({ success: false, error: 'Tidak ada antrean menunggu untuk dipanggil.' });
        return;
      }

      const calledAtStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(
        `UPDATE tickets SET status = 'CALLED', called_at = ?, counter_id = ?, counter_name = ?, officer_name = ? WHERE id = ?`,
        [calledAtStr, counterId, counterName, officerName || user.name || 'Petugas', targetTicketId]
      );

      const [updatedRows] = await pool.query(`SELECT * FROM tickets WHERE id = ?`, [targetTicketId]);
      const raw = updatedRows[0];

      const ticket = {
        id: raw.id,
        ticketNumber: raw.ticket_number,
        sequence: raw.sequence,
        clinicId: raw.clinic_id,
        clinicName: raw.clinic_name,
        prefix: raw.prefix,
        date: formatTicketDate(raw.date),
        status: raw.status,
        createdAt: raw.created_at ? (typeof raw.created_at === 'string' ? raw.created_at : new Date(raw.created_at).toISOString()) : null,
        calledAt: raw.called_at ? (typeof raw.called_at === 'string' ? raw.called_at : new Date(raw.called_at).toISOString()) : null,
        counterId: raw.counter_id,
        counterName: raw.counter_name,
        officerName: raw.officer_name
      };

      io.emit('ticket_called', { ticket, timestamp: Date.now() });
      if (callback) callback({ success: true, ticket });
    } catch (err) {
      console.error('call_ticket error:', err);
      if (callback) callback({ success: false, error: 'Gagal memanggil antrean.' });
    }
  });

  // 3. Recall Ticket
  socket.on('recall_ticket', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || !['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER'].includes(user.role)) {
        if (callback) callback({ success: false, error: 'Akses ditolak. Memerlukan hak akses Petugas.' });
        return;
      }

      const { ticketId } = payload || {};
      const calledAtStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await pool.query(`UPDATE tickets SET called_at = ? WHERE id = ?`, [calledAtStr, ticketId]);

      const [rows] = await pool.query(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);
      const raw = rows[0];

      if (!raw) {
        if (callback) callback({ success: false, error: 'Antrean tidak ditemukan.' });
        return;
      }

      const ticket = {
        id: raw.id,
        ticketNumber: raw.ticket_number,
        sequence: raw.sequence,
        clinicId: raw.clinic_id,
        clinicName: raw.clinic_name,
        prefix: raw.prefix,
        date: formatTicketDate(raw.date),
        status: raw.status,
        createdAt: raw.created_at ? (typeof raw.created_at === 'string' ? raw.created_at : new Date(raw.created_at).toISOString()) : null,
        calledAt: raw.called_at ? (typeof raw.called_at === 'string' ? raw.called_at : new Date(raw.called_at).toISOString()) : null,
        counterId: raw.counter_id,
        counterName: raw.counter_name,
        officerName: raw.officer_name
      };

      io.emit('ticket_recalled', { ticket, timestamp: Date.now() });
      if (callback) callback({ success: true, ticket });
    } catch (err) {
      console.error('recall_ticket error:', err);
      if (callback) callback({ success: false, error: 'Gagal memanggil ulang antrean.' });
    }
  });

  // 4. Skip Ticket
  socket.on('skip_ticket', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || !['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER'].includes(user.role)) {
        if (callback) callback({ success: false, error: 'Akses ditolak. Memerlukan hak akses Petugas.' });
        return;
      }

      const { ticketId } = payload || {};
      await pool.query(`UPDATE tickets SET status = 'SKIPPED' WHERE id = ?`, [ticketId]);
      const [rows] = await pool.query(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);
      const raw = rows[0];

      const ticket = {
        id: raw.id,
        ticketNumber: raw.ticket_number,
        sequence: raw.sequence,
        clinicId: raw.clinic_id,
        clinicName: raw.clinic_name,
        prefix: raw.prefix,
        date: formatTicketDate(raw.date),
        status: raw.status,
        counterId: raw.counter_id,
        counterName: raw.counter_name,
        officerName: raw.officer_name
      };
      io.emit('ticket_skipped', { ticket });
      if (callback) callback({ success: true, ticket });
    } catch (err) {
      console.error('skip_ticket error:', err);
      if (callback) callback({ success: false, error: 'Gagal melewati antrean.' });
    }
  });

  // 5. Complete Ticket
  socket.on('complete_ticket', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || !['ADMIN', 'POLIKLINIK', 'FARMASI', 'OFFICER'].includes(user.role)) {
        if (callback) callback({ success: false, error: 'Akses ditolak. Memerlukan hak akses Petugas.' });
        return;
      }

      const { ticketId } = payload || {};
      const completedAtStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await pool.query(`UPDATE tickets SET status = 'COMPLETED', completed_at = ? WHERE id = ?`, [completedAtStr, ticketId]);

      const [rows] = await pool.query(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);
      const raw = rows[0];

      const ticket = {
        id: raw.id,
        ticketNumber: raw.ticket_number,
        sequence: raw.sequence,
        clinicId: raw.clinic_id,
        clinicName: raw.clinic_name,
        prefix: raw.prefix,
        date: formatTicketDate(raw.date),
        status: raw.status,
        completedAt: raw.completed_at,
        counterId: raw.counter_id,
        counterName: raw.counter_name,
        officerName: raw.officer_name
      };
      io.emit('ticket_completed', { ticket });
      if (callback) callback({ success: true, ticket });
    } catch (err) {
      console.error('complete_ticket error:', err);
      if (callback) callback({ success: false, error: 'Gagal menyelesaikan antrean.' });
    }
  });

  // 6. Update Hospital / Clinics / Videos Settings - Strictly Admin Only
  socket.on('update_settings', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || user.role !== 'ADMIN') {
        if (callback) callback({ success: false, error: 'Akses ditolak. Pengaturan hanya boleh diubah oleh Administrator.' });
        return;
      }

      const updatedState = await processSaveSettings(payload);
      if (callback) callback({ success: true, hospital: updatedState.hospital, clinics: updatedState.clinics });
    } catch (err) {
      console.error('update_settings error:', err);
      if (callback) callback({ success: false, error: 'Gagal merubah pengaturan.' });
    }
  });

  // 7. Reset Shift (Archive current active tickets to history) - Admin / Pendaftaran Only
  socket.on('reset_shift', async (payload, callback) => {
    try {
      const user = getSocketUser(socket, payload);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'PENDAFTARAN')) {
        if (callback) callback({ success: false, error: 'Akses ditolak. Memerlukan izin Admin atau Petugas Pendaftaran.' });
        return;
      }

      const [result] = await pool.query(
        `UPDATE tickets SET archived = 1, archived_at = NOW() WHERE archived = 0`
      );

      lastTicketTime.clear();
      const newState = await getFullState(user);
      io.emit('shift_reset', newState);
      console.log(`[Shift-Reset] Manual reset shift executed via Socket by ${user.username}. ${result.affectedRows} tiket diarsipkan.`);
      if (callback) callback({ success: true, affectedTickets: result.affectedRows });
    } catch (err) {
      console.error('reset_shift error:', err);
      if (callback) callback({ success: false, error: 'Gagal me-reset shift antrean.' });
    }
  });
});

let lastRecordedDate = getLocalDateStr();

// Auto-archive any leftover tickets from previous days (if server was off overnight)
async function autoArchiveStaleTickets() {
  try {
    const today = getLocalDateStr();
    const [stale] = await pool.query(
      `UPDATE tickets SET archived = 1, archived_at = NOW() WHERE archived = 0 AND date < ?`,
      [today]
    );
    if (stale.affectedRows > 0) {
      console.log(`[Auto-Reset] Berhasil mengarsipkan ${stale.affectedRows} tiket kadaluarsa dari hari kemarin ke tabel riwayat.`);
    }
  } catch (err) {
    console.error('[Auto-Reset] Gagal mengarsipkan tiket lama:', err);
  }
}

// Background scheduler for automatic midnight day-change reset
function startMidnightWatcher() {
  setInterval(async () => {
    try {
      const currentDate = getLocalDateStr();
      if (currentDate !== lastRecordedDate) {
        console.log(`[Auto-Reset] Pergantian hari terdeteksi (${lastRecordedDate} -> ${currentDate}). Menjalankan auto-reset harian...`);
        lastRecordedDate = currentDate;

        // 1. Archive previous day's unserved/active tickets
        await pool.query(
          `UPDATE tickets SET archived = 1, archived_at = NOW() WHERE archived = 0 AND date < ?`,
          [currentDate]
        );

        // 2. Clear ticket debounce map
        lastTicketTime.clear();

        // 3. Broadcast clean reset state to all displays (TV, Officer, Kiosk, Admin)
        const newState = await getFullState();
        io.emit('shift_reset', newState);
        io.emit('day_changed', { date: currentDate });
        console.log(`[Auto-Reset] Auto-reset pergantian hari sukses disinkronkan ke seluruh klien.`);
      }
    } catch (err) {
      console.error('[Auto-Reset] Error saat monitoring pergantian hari:', err);
    }
  }, 15000); // Check every 15 seconds
}

const PORT = process.env.PORT || 3001;

// Start Server after MySQL connection is ready
initDatabase().then(async (dbPool) => {
  pool = dbPool;

  // Auto-archive any stale unarchived tickets from previous days on startup
  await autoArchiveStaleTickets();

  // Start automatic midnight day-change watcher
  startMidnightWatcher();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AntreanRS] Server running with MySQL database on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server due to MySQL error:', err);
});

// Graceful shutdown on nodemon restart or process termination
const gracefulShutdown = () => {
  if (server) {
    server.close(() => {
      if (pool) pool.end();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.once('SIGUSR2', () => {
  if (server) {
    server.close(() => {
      if (pool) pool.end();
      process.kill(process.pid, 'SIGUSR2');
    });
  } else {
    process.kill(process.pid, 'SIGUSR2');
  }
});

