const KEY = 'cinema_app_v1';
const SESSION_KEY = 'cinema_session_v1';

const byId = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n).toLocaleString('vi-VN')} VNĐ`;
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

const seed = {
  config: { pointRate: 10000, starValue: 1000 },
  rooms: ['P1', 'P2', 'P3'],
  movies: [
    { id: 'm1', title: 'Hành Tinh Bóng Đêm', rating: 'T13', description: 'Khoa học viễn tưởng, hành động.', basePrice: 90000 },
    { id: 'm2', title: 'Mật Mã Cuối Cùng', rating: 'T16', description: 'Trinh thám nghẹt thở.', basePrice: 100000 },
  ],
  showtimes: [
    { id: 's1', movieId: 'm1', startAt: nextHours(3), room: 'P1', seatsBooked: [] },
    { id: 's2', movieId: 'm2', startAt: nextHours(5), room: 'P2', seatsBooked: [] },
  ],
  combos: [
    { id: 'c1', name: 'Combo Solo', price: 50000 },
    { id: 'c2', name: 'Combo Couple', price: 90000 },
  ],
  rewards: [
    { id: 'r1', name: 'Voucher 50K', threshold: 500000 },
    { id: 'r2', name: 'Vé miễn phí 2D', threshold: 1000000 },
  ],
  users: [
    { id: 'u-admin', name: 'System Admin', email: 'admin@cinema.local', password: 'Admin@123', role: 'admin', dob: '1995-01-01', gender: 'Khác', phone: '0900000001', stars: 0, spending: 0, usedRewards: [] },
    { id: 'u-staff', name: 'Cinema Staff', email: 'staff@cinema.local', password: 'Staff@123', role: 'staff', dob: '1998-01-01', gender: 'Khác', phone: '0900000002', stars: 0, spending: 0, usedRewards: [] },
  ],
  tickets: [],
};

function nextHours(h) {
  const d = new Date(Date.now() + h * 3600000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  return JSON.parse(raw);
}
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
function getSession() { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
function setSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

let db = load();
let session = getSession();

function toast(msg, type = 'primary') {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="toast align-items-center text-bg-${type} border-0" role="alert"><div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
  const el = wrap.firstChild;
  byId('toastContainer').appendChild(el);
  new bootstrap.Toast(el, { delay: 2500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function currentUser() {
  return db.users.find((u) => u.id === session?.userId) || null;
}

function ensureRole(role) {
  return currentUser()?.role === role;
}

function render() {
  db = load();
  session = getSession();
  renderSession();
  renderMovies();
  renderCustomer();
  renderStaff();
  renderAdmin();
}

function renderSession() {
  const user = currentUser();
  byId('sessionBadge').textContent = user ? `${user.role.toUpperCase()} - ${user.name}` : 'Guest';
  byId('logoutBtn').classList.toggle('d-none', !user);
}

function renderMovies() {
  const list = byId('movieList');
  list.innerHTML = '';
  db.movies.forEach((m) => {
    const sTimes = db.showtimes.filter((s) => s.movieId === m.id).map((s) => new Date(s.startAt).toLocaleString('vi-VN')).join('<br>') || 'Chưa có';
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `<div class="card h-100"><div class="card-body">
      <h4 class="h6">${m.title} <span class="badge bg-warning text-dark">${m.rating}</span></h4>
      <p class="small text-muted mb-2">${m.description}</p>
      <p class="small mb-0"><strong>Lịch chiếu:</strong><br>${sTimes}</p>
    </div></div>`;
    list.appendChild(col);
  });
}

function renderCustomer() {
  const ok = ensureRole('customer');
  byId('customerGuard').classList.toggle('d-none', ok);
  byId('customerContent').classList.toggle('d-none', !ok);
  if (!ok) return;
  const user = currentUser();
  byId('customerProfile').innerHTML = `Xin chào <strong>${user.name}</strong><br>Email: ${user.email}<br>Stars: <strong>${user.stars}</strong><br>Chi tiêu: <strong>${fmt(user.spending)}</strong>`;

  const movieSel = byId('bookingMovie');
  movieSel.innerHTML = db.movies.map((m) => `<option value="${m.id}">${m.title}</option>`).join('');
  populateShowtimeSelect();
  renderSeatMap();
  renderCombos();
  renderTotal();

  const myTickets = db.tickets.filter((t) => t.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  byId('ticketHistory').innerHTML = myTickets.map((t) => `<tr><td>${t.code}</td><td>${movieById(showtimeById(t.showtimeId).movieId)?.title || '-'}</td><td>${t.seats.join(', ')}</td><td>${fmt(t.total)}</td><td>${t.paymentMethod}</td><td>${t.used ? '<span class="badge bg-secondary">Đã dùng</span>' : '<span class="badge bg-success">Hợp lệ</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">Chưa có vé</td></tr>';

  const unlocked = db.rewards.filter((r) => user.spending >= r.threshold);
  byId('rewardStatus').innerHTML = unlocked.length
    ? unlocked.map((r) => `✅ ${r.name} (mốc ${fmt(r.threshold)})`).join('<br>')
    : 'Chưa đạt mốc thưởng.';
}

function renderSeatMap() {
  const showtime = showtimeById(byId('bookingShowtime').value);
  const map = byId('seatMap');
  map.innerHTML = '';
  if (!showtime) return;
  const selected = getSelectedSeats();
  const allSeats = Array.from({ length: 40 }, (_, i) => `A${i + 1}`);
  allSeats.forEach((seat) => {
    const div = document.createElement('div');
    div.className = 'seat';
    if (showtime.seatsBooked.includes(seat)) div.classList.add('booked');
    if (selected.includes(seat)) div.classList.add('selected');
    div.textContent = seat;
    div.onclick = () => {
      if (showtime.seatsBooked.includes(seat)) return;
      const picked = getSelectedSeats();
      if (picked.includes(seat)) setSelectedSeats(picked.filter((s) => s !== seat));
      else if (picked.length < 4) setSelectedSeats([...picked, seat]);
      else toast('Tối đa 4 ghế/lần đặt.', 'warning');
      renderSeatMap();
      renderTotal();
    };
    map.appendChild(div);
  });
}

function renderCombos() {
  byId('comboOptions').innerHTML = db.combos.map((c) => `<div class="col-md-6"><label class="form-check"><input class="form-check-input combo-check" type="checkbox" value="${c.id}"> ${c.name} - ${fmt(c.price)}</label></div>`).join('');
  document.querySelectorAll('.combo-check').forEach((c) => c.addEventListener('change', renderTotal));
}

function renderTotal() {
  const showtime = showtimeById(byId('bookingShowtime').value);
  if (!showtime) return;
  const movie = movieById(showtime.movieId);
  const seats = getSelectedSeats();
  const comboIds = getSelectedCombos();
  const comboTotal = comboIds.reduce((sum, id) => sum + comboById(id).price, 0);
  const total = seats.length * movie.basePrice + comboTotal;
  byId('bookingTotal').textContent = `Tổng: ${fmt(total)}`;
}

function renderStaff() {
  const ok = ensureRole('staff');
  byId('staffGuard').classList.toggle('d-none', ok);
  byId('staffContent').classList.toggle('d-none', !ok);
}

function renderAdmin() {
  const ok = ensureRole('admin');
  byId('adminGuard').classList.toggle('d-none', ok);
  byId('adminContent').classList.toggle('d-none', !ok);
  if (!ok) return;

  byId('adminMovies').innerHTML = db.movies.map((m) => `<li class="list-group-item d-flex justify-content-between"><span>${m.title} (${m.rating})</span><span><button class="btn btn-sm btn-outline-primary" onclick="editMovie('${m.id}')">Sửa</button> <button class="btn btn-sm btn-outline-danger" onclick="deleteMovie('${m.id}')">Xóa</button></span></li>`).join('');
  const showtimeMovieSelect = document.querySelector('#showtimeForm [name="movieId"]');
  showtimeMovieSelect.innerHTML = db.movies.map((m) => `<option value="${m.id}">${m.title}</option>`).join('');
  const roomSel = document.querySelector('#showtimeForm [name="room"]');
  roomSel.innerHTML = db.rooms.map((r) => `<option>${r}</option>`).join('');
  byId('adminShowtimes').innerHTML = db.showtimes.map((s) => `<li class="list-group-item d-flex justify-content-between"><span>${movieById(s.movieId)?.title || '?'} - ${new Date(s.startAt).toLocaleString('vi-VN')} - ${s.room}</span><button class="btn btn-sm btn-outline-danger" onclick="deleteShowtime('${s.id}')">Xóa</button></li>`).join('');

  byId('adminCombos').innerHTML = db.combos.map((c) => `<li class="list-group-item d-flex justify-content-between"><span>${c.name} - ${fmt(c.price)}</span><button class="btn btn-sm btn-outline-danger" onclick="deleteCombo('${c.id}')">Xóa</button></li>`).join('');
  byId('adminUsers').innerHTML = db.users.map((u) => `<li class="list-group-item">${u.name} | ${u.email} | ${u.role} | Stars ${u.stars}</li>`).join('');
  byId('adminRewards').innerHTML = db.rewards.map((r) => `<li class="list-group-item d-flex justify-content-between"><span>${r.name} - mốc ${fmt(r.threshold)}</span><button class="btn btn-sm btn-outline-danger" onclick="deleteReward('${r.id}')">Xóa</button></li>`).join('');

  const starsForm = byId('starsConfigForm');
  starsForm.pointRate.value = db.config.pointRate;
  starsForm.starValue.value = db.config.starValue;
}

function populateShowtimeSelect() {
  const movieId = byId('bookingMovie').value;
  const options = db.showtimes.filter((s) => s.movieId === movieId);
  byId('bookingShowtime').innerHTML = options.map((s) => `<option value="${s.id}">${new Date(s.startAt).toLocaleString('vi-VN')} - ${s.room}</option>`).join('');
}

function movieById(id) { return db.movies.find((m) => m.id === id); }
function showtimeById(id) { return db.showtimes.find((s) => s.id === id); }
function comboById(id) { return db.combos.find((c) => c.id === id); }

function getSelectedSeats() { return JSON.parse(sessionStorage.getItem('selectedSeats') || '[]'); }
function setSelectedSeats(v) { sessionStorage.setItem('selectedSeats', JSON.stringify(v)); }
function getSelectedCombos() { return [...document.querySelectorAll('.combo-check:checked')].map((c) => c.value); }

byId('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get('email').toString().trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) return toast('Email đã tồn tại', 'danger');
  db.users.push({
    id: uid('u'),
    name: f.get('name'),
    email,
    password: f.get('password'),
    role: 'customer',
    dob: f.get('dob'),
    gender: f.get('gender'),
    phone: f.get('phone'),
    stars: 0,
    spending: 0,
    usedRewards: [],
  });
  save(db);
  e.target.reset();
  toast('Đăng ký thành công, hãy đăng nhập.', 'success');
  render();
});

byId('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get('email').toString().trim().toLowerCase();
  const password = f.get('password').toString();
  const user = db.users.find((u) => u.email === email && u.password === password);
  if (!user) return toast('Sai tài khoản hoặc mật khẩu.', 'danger');
  setSession({ userId: user.id });
  toast(`Xin chào ${user.name}`, 'success');
  render();
});

byId('forgotForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get('email').toString().trim().toLowerCase();
  const user = db.users.find((u) => u.email === email);
  if (!user) return toast('Không tìm thấy email.', 'danger');
  user.password = f.get('newPassword').toString();
  save(db);
  e.target.reset();
  toast('Đặt lại mật khẩu thành công.', 'success');
});

byId('logoutBtn').addEventListener('click', () => {
  setSession(null);
  sessionStorage.clear();
  render();
});

byId('changePasswordForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = currentUser();
  if (!user) return;
  user.password = new FormData(e.target).get('newPassword').toString();
  save(db);
  e.target.reset();
  toast('Đổi mật khẩu thành công.', 'success');
});

byId('bookingMovie').addEventListener('change', () => {
  populateShowtimeSelect();
  setSelectedSeats([]);
  renderSeatMap();
  renderTotal();
});
byId('bookingShowtime').addEventListener('change', () => {
  setSelectedSeats([]);
  renderSeatMap();
  renderTotal();
});

byId('bookingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = currentUser();
  const showtime = showtimeById(byId('bookingShowtime').value);
  const movie = movieById(showtime.movieId);
  const seats = getSelectedSeats();
  const paymentMethod = byId('paymentMethod').value;
  const comboIds = getSelectedCombos();
  if (!seats.length) return toast('Vui lòng chọn ghế.', 'warning');
  const comboTotal = comboIds.reduce((sum, id) => sum + comboById(id).price, 0);
  const total = seats.length * movie.basePrice + comboTotal;

  if (paymentMethod === 'stars') {
    const need = Math.ceil(total / db.config.starValue);
    if (user.stars < need) return toast(`Không đủ Stars, cần ${need}.`, 'danger');
    user.stars -= need;
  } else {
    user.spending += total;
    user.stars += Math.floor(total / db.config.pointRate);
  }

  showtime.seatsBooked.push(...seats);
  db.tickets.push({
    id: uid('t'),
    code: uid('TICKET').toUpperCase(),
    userId: user.id,
    showtimeId: showtime.id,
    seats,
    comboIds,
    total,
    paymentMethod,
    used: false,
    createdAt: new Date().toISOString(),
  });
  save(db);
  setSelectedSeats([]);
  toast('Đặt vé thành công.', 'success');
  render();
});

byId('scanForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('staff')) return;
  const code = new FormData(e.target).get('ticketCode').toString().trim();
  const ticket = db.tickets.find((t) => t.code === code);
  if (!ticket) return (byId('scanResult').innerHTML = '<span class="text-danger">Vé không tồn tại.</span>');
  if (ticket.used) return (byId('scanResult').innerHTML = '<span class="text-warning">Vé đã được sử dụng.</span>');
  ticket.used = true;
  save(db);
  byId('scanResult').innerHTML = `<span class="text-success">Vé hợp lệ. Đã xác nhận sử dụng cho ghế ${ticket.seats.join(', ')}.</span>`;
  toast('Đã check-in vé thành công.', 'success');
  render();
});

byId('counterPaymentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('staff')) return;
  const f = new FormData(e.target);
  const user = db.users.find((u) => u.email === f.get('userEmail').toString().trim().toLowerCase() && u.role === 'customer');
  if (!user) return toast('Không tìm thấy Customer.', 'danger');
  const amount = Number(f.get('amount'));
  const starsUsed = Number(f.get('starsUsed'));
  if (starsUsed > user.stars) return toast('Khách không đủ Stars.', 'danger');
  user.stars -= starsUsed;
  user.spending += amount;
  user.stars += Math.floor(amount / db.config.pointRate);
  save(db);
  e.target.reset();
  toast('Thanh toán tại quầy thành công.', 'success');
  render();
});

byId('movieForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('admin')) return;
  const f = new FormData(e.target);
  const id = f.get('id').toString();
  const payload = {
    id: id || uid('m'),
    title: f.get('title').toString(),
    rating: f.get('rating').toString(),
    description: f.get('description').toString(),
    basePrice: 90000,
  };
  if (id) {
    const idx = db.movies.findIndex((m) => m.id === id);
    db.movies[idx] = payload;
  } else db.movies.push(payload);
  save(db);
  e.target.reset();
  toast('Lưu phim thành công.', 'success');
  render();
});

byId('showtimeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('admin')) return;
  const f = new FormData(e.target);
  db.showtimes.push({
    id: uid('s'),
    movieId: f.get('movieId').toString(),
    startAt: f.get('startAt').toString(),
    room: f.get('room').toString(),
    seatsBooked: [],
  });
  save(db);
  e.target.reset();
  toast('Thêm lịch chiếu thành công.', 'success');
  render();
});

byId('comboForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('admin')) return;
  const f = new FormData(e.target);
  db.combos.push({ id: uid('c'), name: f.get('name').toString(), price: Number(f.get('price')) });
  save(db);
  e.target.reset();
  toast('Đã thêm combo.', 'success');
  render();
});

byId('starsConfigForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('admin')) return;
  const f = new FormData(e.target);
  db.config.pointRate = Number(f.get('pointRate'));
  db.config.starValue = Number(f.get('starValue'));
  save(db);
  toast('Đã lưu cấu hình stars.', 'success');
  render();
});

byId('rewardForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ensureRole('admin')) return;
  const f = new FormData(e.target);
  db.rewards.push({ id: uid('r'), name: f.get('name').toString(), threshold: Number(f.get('threshold')) });
  save(db);
  e.target.reset();
  toast('Đã thêm thưởng.', 'success');
  render();
});

window.editMovie = (id) => {
  const m = movieById(id);
  const form = byId('movieForm');
  form.id.value = m.id;
  form.title.value = m.title;
  form.rating.value = m.rating;
  form.description.value = m.description;
};
window.deleteMovie = (id) => {
  db.movies = db.movies.filter((m) => m.id !== id);
  db.showtimes = db.showtimes.filter((s) => s.movieId !== id);
  save(db);
  render();
};
window.deleteShowtime = (id) => { db.showtimes = db.showtimes.filter((s) => s.id !== id); save(db); render(); };
window.deleteCombo = (id) => { db.combos = db.combos.filter((c) => c.id !== id); save(db); render(); };
window.deleteReward = (id) => { db.rewards = db.rewards.filter((r) => r.id !== id); save(db); render(); };

render();
