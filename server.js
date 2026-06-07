// ==========================================
// server.js — Backend API (Node.js + Express + PostgreSQL)
// ==========================================
//
// ไฟล์นี้ทำงาน 2 อย่าง:
//   1. Serve static files (index.html, styles.css, app.js)
//   2. REST API endpoint สำหรับ Comments
//      POST /api/comments  → บันทึก comment ลง PostgreSQL
//      GET  /api/comments  → ดึง comments + pagination

const express = require('express');
const { Pool } = require('pg'); // pg = node-postgres library
const path = require('path');

const app = express();

// อ่านค่า config จาก Environment Variables
const PORT        = process.env.PORT        || 80;
const DB_HOST     = process.env.DB_HOST     || 'localhost';
const DB_PORT     = parseInt(process.env.DB_PORT) || 5432;
const DB_NAME     = process.env.DB_NAME     || 'commentsdb';
const DB_USER     = process.env.DB_USER     || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
// DB_SSL=true ต้องตั้งค่าเมื่อ connect กับ RDS (AWS บังคับใช้ SSL)
const DB_SSL      = process.env.DB_SSL === 'true';

// ==========================================
// ตั้งค่า PostgreSQL Connection Pool
// Pool = กลุ่ม connection ที่พร้อมใช้งาน
// ไม่ต้องสร้าง/ปิด connection ใหม่ทุกครั้งที่มี request
// ==========================================
const pool = new Pool({
  host:     DB_HOST,
  port:     DB_PORT,
  database: DB_NAME,
  user:     DB_USER,
  password: DB_PASSWORD,
  ssl:      DB_SSL ? { rejectUnauthorized: false } : false,
});

// ==========================================
// สร้าง Table ถ้ายังไม่มี (รันตอน server เริ่มต้น)
// CREATE TABLE IF NOT EXISTS = สร้างเฉพาะถ้ายังไม่มี (ไม่ error ถ้ามีแล้ว)
// ==========================================
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name       VARCHAR(100) NOT NULL,
        message    VARCHAR(500) NOT NULL,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    console.log('✅ Database ready — table "comments" exists');
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    // ไม่ crash server — จะ retry เมื่อมี request เข้ามา
  }
}

// ==========================================
// Middleware
// ==========================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// POST /api/comments — สร้าง Comment ใหม่
// ==========================================
app.post('/api/comments', async (req, res) => {
  const { name, message } = req.body;

  if (!name?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'กรุณาใส่ชื่อและข้อความ' });
  }

  try {
    // $1, $2 = parameterized query ป้องกัน SQL Injection
    // PostgreSQL จัดการ UUID และ timestamp ให้อัตโนมัติ
    const result = await pool.query(
      `INSERT INTO comments (name, message)
       VALUES ($1, $2)
       RETURNING id, name, message, created_at AS "createdAt"`,
      [name.trim().substring(0, 100), message.trim().substring(0, 500)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving comment:', err);
    res.status(500).json({ error: 'บันทึกไม่ได้ กรุณาลองใหม่' });
  }
});

// ==========================================
// GET /api/comments — ดึง Comments พร้อม Pagination
// ==========================================
app.get('/api/comments', async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 5;
  const offset = (page - 1) * limit;

  try {
    // รัน 2 queries พร้อมกัน (Promise.all = รอทั้งคู่เสร็จ)
    const [countResult, rowsResult] = await Promise.all([
      // Query 1: นับจำนวน comments ทั้งหมด
      pool.query('SELECT COUNT(*) FROM comments'),

      // Query 2: ดึง comments ของหน้านั้น
      // ORDER BY created_at DESC = เรียงใหม่ → เก่า
      // LIMIT = จำนวนสูงสุดต่อหน้า
      // OFFSET = ข้ามกี่แถว (หน้า 2 ข้าม 5, หน้า 3 ข้าม 10, ...)
      pool.query(
        `SELECT id, name, message, created_at AS "createdAt"
         FROM comments
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total      = parseInt(countResult.rows[0].count);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);

    res.json({
      comments:   rowsResult.rows,
      pagination: { page: safePage, totalPages, total },
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'ดึงข้อมูลไม่ได้' });
  }
});

// ==========================================
// GET /health — Health Check
// ==========================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1'); // ทดสอบว่าต่อ DB ได้
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ==========================================
// เริ่ม Server
// ==========================================
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`PostgreSQL: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  });
});
