// =====================
// RIKA — APP CORE SCRIPT
// =====================

let currentMonth = 2;
let allData = {}; // { month: { videos: {}, notes: '' } }
let editingDay = null;
let scoreChart = null;
let currentVideoPlayer = null; // Track currently playing video

const MONTH_LABELS = { 2:'Private Confidence', 3:'Expanding Space', 4:'Public Comfort', 5:'Creator Ready' };
const DAYS_PER_MONTH = 30;

// =====================
// ADMIN MODE
// =====================
const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

// =====================
// YOUTUBE UTILITIES
// =====================
function extractYouTubeID(url) {
  if (!url) return null;
  
  // Standard YouTube
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/);
  if (match) return match[1];
  
  // YouTube Shorts
  match = url.match(/youtube\.com\/shorts\/([^?&\s]+)/);
  if (match) return match[1];
  
  return null;
}

function getYouTubeEmbed(videoId) {
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0`;
}

// =====================
// PLAYER MODAL
// =====================
function openVideoPlayer(day, videoData) {
  if (!videoData.url) {
    alert('URL video belum diisi');
    return;
  }

  const videoId = extractYouTubeID(videoData.url);
  if (!videoId) {
    alert('URL YouTube tidak valid. Gunakan format: youtube.com/watch?v=... atau youtu.be/...');
    return;
  }

  const embedUrl = getYouTubeEmbed(videoId);
  
  const playerModal = document.getElementById('playerModal');
  const playerFrame = document.getElementById('playerFrame');
  const playerTitle = document.getElementById('playerTitle');
  const playerDay = document.getElementById('playerDay');
  const playerScore = document.getElementById('playerScore');
  const playerNotes = document.getElementById('playerNotes');

  playerFrame.src = embedUrl;
  playerTitle.textContent = videoData.title || `Video Hari ${day}`;
  playerDay.textContent = day;

  if (videoData.scores) {
    const scores = videoData.scores;
    const avg = (Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length).toFixed(1);
    playerScore.innerHTML = `
      <strong>Skor:</strong> ${avg}/10
      <div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">
        👁️ ${scores.eye || '—'} | 😊 ${scores.expr || '—'} | 🗣️ ${scores.fluency || '—'}
      </div>
    `;
  } else {
    playerScore.innerHTML = '<em>Belum diberi skor</em>';
  }

  playerNotes.textContent = videoData.notes || '';

  playerModal.classList.add('active');
  currentVideoPlayer = videoId;
}

function closeVideoPlayer() {
  const playerModal = document.getElementById('playerModal');
  const playerFrame = document.getElementById('playerFrame');
  playerFrame.src = '';
  playerModal.classList.remove('active');
  currentVideoPlayer = null;
}

// =====================
// INIT
// =====================
function applyAdminMode() {
  if (isAdmin) {
    document.body.classList.add('admin-mode');
    document.getElementById('adminBadge').classList.add('show');
  }
}

async function loadFromFirebase() {
  try {
    const db = window._db;
    const docRef = window._firestoreDoc(db, 'rika', 'progress');
    const snap = await window._firestoreGetDoc(docRef);
    if (snap.exists()) {
      const loaded = snap.data();
      [2,3,4,5].forEach(m => {
        const key = 'm' + m;
        if (loaded[key]) {
          try { allData[m] = JSON.parse(loaded[key]); } catch(e) {}
        }
      });
      console.log('✓ Firebase loaded');
    }
  } catch(e) {
    console.warn('Firebase load failed, using localStorage:', e);
    try {
      const saved = localStorage.getItem('rika_data');
      if (saved) allData = JSON.parse(saved);
    } catch(e2) {}
  }
}

function init() {
  [2,3,4,5].forEach(m => {
    if (!allData[m]) allData[m] = { videos: {}, notes: '' };
  });

  applyAdminMode();
  spawnPetals();

  const tryLoad = async () => {
    await loadFromFirebase();
    [2,3,4,5].forEach(m => {
      if (!allData[m]) allData[m] = { videos: {}, notes: '' };
    });
    renderAll();
    document.getElementById('loadingOverlay').classList.add('hidden');
  };

  window.addEventListener('firebaseReady', tryLoad);
  setTimeout(tryLoad, 1500);
}

// =====================
// RENDER
// =====================
function renderAll() {
  renderVideoGrid();
  renderStats();
  renderChart();
  renderRanking();
  renderProgress();
}

function renderVideoGrid() {
  const grid = document.getElementById('videoGrid');
  grid.innerHTML = '';

  const monthData = allData[currentMonth];
  if (!monthData || !monthData.videos) return;

  for (let day = 1; day <= DAYS_PER_MONTH; day++) {
    const vid = monthData.videos[day] || {};
    
    const card = document.createElement('div');
    card.className = 'video-card' + (vid.url ? ' has-video' : '') + (vid.scores ? ' has-score' : '');
    
    const hasScore = vid.scores && Object.keys(vid.scores).length > 0;
    const score = hasScore ? (Object.values(vid.scores).reduce((a, b) => a + b, 0) / Object.keys(vid.scores).length).toFixed(1) : null;

    card.innerHTML = `
      <div class="video-thumb-wrap">
        <div class="video-thumb-placeholder">📹</div>
        <div class="video-play-btn">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="19" fill="none" stroke="white" stroke-width="1.5"/>
            <polygon points="16,14 16,26 27,20" fill="white"/>
          </svg>
        </div>
        <div class="day-badge">DAY ${day}</div>
        ${score ? `<div class="score-overlay">${score}</div>` : ''}
      </div>
      <div class="video-info">
        <div class="video-title">${vid.title || `Video Hari ${day}`}</div>
        ${hasScore ? `
          <div class="score-row">
            <div class="score-dot"></div>
            <div class="score-val">Skor: ${score}/10</div>
          </div>
        ` : `<div class="score-empty">Belum diberi skor</div>`}
        <div class="edit-hint">KLIK UNTUK PUTAR</div>
      </div>
    `;

    // Click to play
    if (vid.url) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => openVideoPlayer(day, vid));
    }

    // Admin: double-click to edit
    if (isAdmin) {
      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openEditModal(day);
      });
    }

    grid.appendChild(card);
  }
}

function renderStats() {
  let total = 0, sumScore = 0, count = 0, best = 0, streak = 0;

  for (let m of [2,3,4,5]) {
    const monthData = allData[m];
    if (!monthData || !monthData.videos) continue;

    for (let day = 1; day <= DAYS_PER_MONTH; day++) {
      const vid = monthData.videos[day];
      if (vid && vid.url) {
        total++;
        if (vid.scores) {
          const scores = Object.values(vid.scores);
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          sumScore += avg;
          count++;
          best = Math.max(best, avg);
        }
      }
    }
  }

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAvg').textContent = count > 0 ? (sumScore / count).toFixed(1) : '—';
  document.getElementById('statBest').textContent = best > 0 ? best.toFixed(1) : '—';
  document.getElementById('statStreak').textContent = streak;
  document.getElementById('monthLabelTitle').textContent = MONTH_LABELS[currentMonth];
  document.getElementById('reportMonthTitle').textContent = MONTH_LABELS[currentMonth];
}

function renderChart() {
  const monthData = allData[currentMonth];
  if (!monthData || !monthData.videos) return;

  const ctx = document.getElementById('scoreChart');
  if (!ctx) return;

  const labels = [];
  const scores = [];
  const avgLine = [];
  let sum = 0, count = 0;

  for (let day = 1; day <= DAYS_PER_MONTH; day++) {
    const vid = monthData.videos[day];
    if (vid && vid.scores) {
      const scoreVals = Object.values(vid.scores);
      const dayAvg = scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length;
      labels.push(`H${day}`);
      scores.push(dayAvg);
      sum += dayAvg;
      count++;
    }
  }

  const overallAvg = count > 0 ? sum / count : 0;
  for (let i = 0; i < scores.length; i++) {
    avgLine.push(overallAvg);
  }

  if (scoreChart) scoreChart.destroy();

  scoreChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Skor Harian',
          data: scores,
          borderColor: 'var(--rose)',
          backgroundColor: 'rgba(196, 117, 133, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'var(--rose)',
        },
        {
          label: 'Rata-rata',
          data: avgLine,
          borderColor: 'var(--gold)',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { 
          min: 0, max: 10, 
          ticks: { color: 'var(--muted)', font: { size: 11 } },
          grid: { color: 'rgba(196, 117, 133, 0.1)' }
        },
        x: {
          ticks: { color: 'var(--muted)', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderRanking() {
  const list = document.getElementById('rankingList');
  list.innerHTML = '';

  const allVideos = [];
  for (let m of [2,3,4,5]) {
    const monthData = allData[m];
    if (!monthData || !monthData.videos) continue;
    for (let day = 1; day <= DAYS_PER_MONTH; day++) {
      const vid = monthData.videos[day];
      if (vid && vid.scores) {
        const scoreVals = Object.values(vid.scores);
        const avg = scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length;
        allVideos.push({ month: m, day, title: vid.title || `Day ${day}`, score: avg });
      }
    }
  }

  allVideos.sort((a, b) => b.score - a.score);

  if (allVideos.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada video yang diberi skor ✨</div>';
    return;
  }

  allVideos.slice(0, 10).forEach((v, i) => {
    const rank = i + 1;
    const item = document.createElement('div');
    item.className = 'rank-item';
    item.innerHTML = `
      <div class="rank-num ${rank <= 3 ? 'top' + rank : ''}">
        ${rank <= 3 ? ['🥇', '🥈', '🥉'][rank-1] : rank}
      </div>
      <div class="rank-info">
        <div class="rank-title">${v.title}</div>
        <div class="rank-day">${MONTH_LABELS[v.month]} · Hari ${v.day}</div>
      </div>
      <div class="rank-score">${v.score.toFixed(1)}</div>
    `;
    list.appendChild(item);
  });
}

function renderProgress() {
  const monthData = allData[currentMonth];
  if (!monthData || !monthData.videos) return;

  const criteria = ['eye', 'expr', 'posture', 'fluency', 'clarity', 'rhythm', 'creative', 'engage', 'persona'];
  const scores = { eye: [], expr: [], posture: [], fluency: [], clarity: [], rhythm: [], creative: [], engage: [], persona: [] };

  for (let day = 1; day <= DAYS_PER_MONTH; day++) {
    const vid = monthData.videos[day];
    if (vid && vid.scores) {
      Object.keys(scores).forEach(key => {
        if (vid.scores[key]) scores[key].push(vid.scores[key]);
      });
    }
  }

  criteria.forEach(key => {
    const vals = scores[key];
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const pct = (avg / 10) * 100;
    
    document.getElementById(`prog-${key}`).textContent = avg > 0 ? avg.toFixed(1) : '—';
    document.getElementById(`bar-${key}`).style.width = pct + '%';
  });

  document.getElementById('improvementNotes').value = monthData.notes || '';
}

// =====================
// EDIT MODAL (ADMIN)
// =====================
function openEditModal(day) {
  if (!isAdmin) return;

  editingDay = day;
  const vid = allData[currentMonth].videos[day] || {};

  document.getElementById('modalDayNum').textContent = day;
  document.getElementById('modalTitle').value = vid.title || '';
  document.getElementById('modalUrl').value = vid.url || '';
  document.getElementById('sc-eye').value = vid.scores?.eye || '';
  document.getElementById('sc-expr').value = vid.scores?.expr || '';
  document.getElementById('sc-fluency').value = vid.scores?.fluency || '';
  document.getElementById('sc-clarity').value = vid.scores?.clarity || '';
  document.getElementById('sc-creative').value = vid.scores?.creative || '';
  document.getElementById('sc-persona').value = vid.scores?.persona || '';
  document.getElementById('modalNotes').value = vid.notes || '';

  document.getElementById('editModal').classList.add('active');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('active');
  editingDay = null;
}

async function saveVideo() {
  if (!editingDay) return;

  const title = document.getElementById('modalTitle').value || `Video Hari ${editingDay}`;
  const url = document.getElementById('modalUrl').value;
  const scores = {
    eye: parseFloat(document.getElementById('sc-eye').value) || 0,
    expr: parseFloat(document.getElementById('sc-expr').value) || 0,
    fluency: parseFloat(document.getElementById('sc-fluency').value) || 0,
    clarity: parseFloat(document.getElementById('sc-clarity').value) || 0,
    creative: parseFloat(document.getElementById('sc-creative').value) || 0,
    persona: parseFloat(document.getElementById('sc-persona').value) || 0,
  };
  const notes = document.getElementById('modalNotes').value;

  allData[currentMonth].videos[editingDay] = { title, url, scores, notes };

  try {
    const db = window._db;
    const docRef = window._firestoreDoc(db, 'rika', 'progress');
    const updateObj = {};
    updateObj['m' + currentMonth] = JSON.stringify(allData[currentMonth]);
    await window._firestoreSetDoc(docRef, updateObj, { merge: true });
  } catch(e) {
    console.warn('Firebase save failed, using localStorage:', e);
    localStorage.setItem('rika_data', JSON.stringify(allData));
  }

  renderAll();
  closeModal();
  showSaveNotice();
}

async function saveNotes() {
  const notes = document.getElementById('improvementNotes').value;
  allData[currentMonth].notes = notes;

  try {
    const db = window._db;
    const docRef = window._firestoreDoc(db, 'rika', 'progress');
    const updateObj = {};
    updateObj['m' + currentMonth] = JSON.stringify(allData[currentMonth]);
    await window._firestoreSetDoc(docRef, updateObj, { merge: true });
  } catch(e) {
    localStorage.setItem('rika_data', JSON.stringify(allData));
  }

  showSaveNotice();
}

function showSaveNotice() {
  const notice = document.getElementById('saveNotice');
  notice.classList.add('show');
  setTimeout(() => notice.classList.remove('show'), 2000);
}

// =====================
// TABS & PHASES
// =====================
function switchTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  btn.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');

  if (tab === 'ranking') {
    setTimeout(() => {
      if (scoreChart) scoreChart.resize();
    }, 100);
  }
}

function switchMonth(month) {
  currentMonth = month;
  document.querySelectorAll('.phase-item').forEach(el => el.classList.remove('active-selected'));
  document.querySelector(`[data-month="${month}"]`).classList.add('active-selected');
  renderAll();
}

// =====================
// REPORT GENERATION
// =====================
function generateReport() {
  const monthData = allData[currentMonth];
  if (!monthData || !monthData.videos) {
    alert('Tidak ada data untuk bulan ini');
    return;
  }

  const videos = Object.values(monthData.videos).filter(v => v.url);
  const withScore = videos.filter(v => v.scores && Object.keys(v.scores).length > 0);

  let report = `
<h4>📊 Ringkasan Bulan ${MONTH_LABELS[currentMonth]}</h4>
<p><strong>Total Video:</strong> ${videos.length} dari ${DAYS_PER_MONTH} hari</p>
<p><strong>Video Diberi Skor:</strong> ${withScore.length}</p>
`;

  if (withScore.length > 0) {
    const scores = withScore.map(v => {
      const vals = Object.values(v.scores);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    
    report += `
<p><strong>Rata-rata Skor:</strong> ${avg.toFixed(1)} / 10</p>
<p><strong>Skor Tertinggi:</strong> ${max.toFixed(1)} / 10</p>
<p><strong>Skor Terendah:</strong> ${min.toFixed(1)} / 10</p>
`;
  }

  if (monthData.notes) {
    report += `<h4>📝 Catatan Perkembangan</h4><p>${monthData.notes.replace(/\n/g, '<br>')}</p>`;
  }

  document.getElementById('reportContent').innerHTML = report;
  document.getElementById('generatedReport').style.display = 'block';
}

// =====================
// DECORATIVE
// =====================
function spawnPetals() {
  const container = document.body;
  for (let i = 0; i < 8; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.animationDuration = (5 + Math.random() * 8) + 's';
    petal.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(petal);
  }
}

// =====================
// STARTUP
// =====================
window.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
