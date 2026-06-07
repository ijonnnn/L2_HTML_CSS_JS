// ==========================================
// app.js — JavaScript ฝั่ง Browser (Frontend)
// ==========================================
//
// ไฟล์นี้ทำงาน 3 อย่าง:
//   1. เมื่อหน้าเว็บเปิด → โหลด comments จาก API
//   2. เมื่อกดปุ่ม "ส่ง Comment" → ส่งข้อมูลไป API
//   3. แสดง comments + ปุ่ม pagination บนหน้าเว็บ

// ==========================================
// เริ่มต้น: รอให้ HTML โหลดครบก่อน แล้วค่อยรัน
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // โหลด comments หน้าแรกทันทีเมื่อเปิดเว็บ
  loadComments(1);

  // ผูก event กับ form: เมื่อ submit จะเรียก submitComment()
  const form = document.getElementById('commentForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // ← สำคัญมาก: หยุดไม่ให้ browser reload หน้า (default behavior ของ form)
    await submitComment();
  });
});

// ==========================================
// ฟังก์ชัน: ส่ง Comment ใหม่ไปที่ Backend API
// ==========================================
async function submitComment() {
  const name    = document.getElementById('name').value;
  const message = document.getElementById('message').value;
  const btn     = document.getElementById('submitBtn');
  const msgEl   = document.getElementById('formMessage');

  // แสดง loading state ขณะส่ง
  btn.disabled       = true;
  btn.textContent    = 'กำลังส่ง...';
  msgEl.textContent  = '';
  msgEl.className    = 'form-message';

  try {
    // fetch() = ส่ง HTTP Request ไปที่ server
    // method: 'POST' = สร้างข้อมูลใหม่
    // body: JSON.stringify() = แปลง object → string เพื่อส่งผ่าน network
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    });

    if (response.ok) {
      // ส่งสำเร็จ (HTTP 201 Created)
      document.getElementById('commentForm').reset(); // ล้างช่อง input
      msgEl.textContent = '✓ ส่ง comment สำเร็จแล้ว!';
      msgEl.className   = 'form-message success';
      await loadComments(1); // โหลด comments ใหม่ กลับไปหน้า 1
    } else {
      // Server ตอบกลับ error (เช่น 400, 500)
      const data = await response.json();
      msgEl.textContent = '⚠️ ' + (data.error || 'เกิดข้อผิดพลาด');
      msgEl.className   = 'form-message error';
    }
  } catch (err) {
    // Network error (เช่น server ดับ, ไม่มี internet)
    msgEl.textContent = '⚠️ เชื่อมต่อ server ไม่ได้';
    msgEl.className   = 'form-message error';
  } finally {
    // finally รันเสมอ ไม่ว่าจะ success หรือ error
    btn.disabled    = false;
    btn.textContent = 'ส่ง Comment';
  }
}

// ==========================================
// ฟังก์ชัน: โหลด Comments จาก Backend API
// ==========================================
async function loadComments(page) {
  const container    = document.getElementById('comments');
  const paginationEl = document.getElementById('pagination');

  // แสดง loading ขณะรอข้อมูล
  container.innerHTML    = '<p class="loading">⏳ กำลังโหลด...</p>';
  paginationEl.innerHTML = '';

  try {
    // fetch() แบบ GET (default) — ดึงข้อมูลจาก API
    // template literal (`...`) ใช้ ${} ใส่ตัวแปรใน string ได้เลย
    const response = await fetch(`/api/comments?page=${page}`);
    const data     = await response.json(); // แปลง JSON string → JavaScript object

    // data มี structure:
    // {
    //   comments: [ { id, name, message, createdAt }, ... ],
    //   pagination: { page, totalPages, total }
    // }

    renderComments(data.comments, container);
    renderPagination(data.pagination, paginationEl);

  } catch (err) {
    container.innerHTML = '<p class="error-msg">⚠️ โหลดไม่ได้ กรุณาลองใหม่</p>';
  }
}

// ==========================================
// ฟังก์ชัน: วาด Comment Cards บนหน้าเว็บ
// ==========================================
function renderComments(comments, container) {
  if (comments.length === 0) {
    container.innerHTML = '<p class="empty">ยังไม่มี comment เลย เป็นคนแรกสิ! 🎉</p>';
    return;
  }

  // .map() = แปลง array หนึ่งไปเป็น array ใหม่
  // ที่นี่แปลง array ของ comment objects → array ของ HTML strings
  const cards = comments.map(comment => `
    <div class="comment-card">
      <div class="comment-header">
        <span class="comment-name">${escapeHtml(comment.name)}</span>
        <span class="comment-date">${formatDate(comment.createdAt)}</span>
      </div>
      <p class="comment-message">${escapeHtml(comment.message)}</p>
    </div>
  `);

  // .join('') = รวม array ของ strings กลายเป็น string เดียว
  container.innerHTML = cards.join('');
}

// ==========================================
// ฟังก์ชัน: วาดปุ่ม Pagination
// ==========================================
function renderPagination(pagination, container) {
  const { page, totalPages, total } = pagination;

  // ถ้ามีหน้าเดียว ไม่ต้องแสดงปุ่ม
  if (totalPages <= 1) {
    if (total > 0) {
      container.innerHTML = `<p class="pagination-info">${total} comment${total !== 1 ? 's' : ''} ทั้งหมด</p>`;
    }
    return;
  }

  // สร้าง HTML ของ pagination ทีละชิ้น แล้วรวมกัน
  let html = `<p class="pagination-info">รวม ${total} comments — หน้า ${page} / ${totalPages}</p>`;
  html += '<div class="pagination">';

  // ปุ่ม "ก่อนหน้า" (ซ่อนถ้าอยู่หน้าแรกแล้ว)
  if (page > 1) {
    html += `<button onclick="loadComments(${page - 1})">← ก่อนหน้า</button>`;
  }

  // ปุ่มตัวเลขแต่ละหน้า
  // for loop วน i จาก 1 ถึง totalPages
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === page ? 'active' : '';
    html += `<button class="${isActive}" onclick="loadComments(${i})">${i}</button>`;
  }

  // ปุ่ม "ถัดไป" (ซ่อนถ้าอยู่หน้าสุดท้ายแล้ว)
  if (page < totalPages) {
    html += `<button onclick="loadComments(${page + 1})">ถัดไป →</button>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ==========================================
// Helper Functions (ฟังก์ชันช่วยเหลือ)
// ==========================================

// escapeHtml: ป้องกัน XSS Attack
// ถ้าใครส่ง <script>alert('hack')</script> มา
// จะแสดงเป็นข้อความธรรมดา ไม่ใช่ code ที่ run ได้
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text; // browser จะ escape HTML ให้อัตโนมัติ
  return div.innerHTML;
}

// formatDate: แปลงวันที่จาก ISO format เป็นภาษาไทย
// input:  "2024-01-15T10:30:00.000Z"
// output: "15 ม.ค. 2567 17:30"
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('th-TH', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}
