/* =========================================================
   SAĞLIK ASISTANI – app.js  v10
   ========================================================= */

const BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `${location.protocol}//${location.host}/api`
    : 'https://saglikasistani-production.up.railway.app/api';
const WATER_GOAL = 2000;
const CIRC = 364.4; // 2 * π * 58

let currentUser = JSON.parse(localStorage.getItem('sa_user') || 'null');
let todayLogId   = null;
let currentMealTip = 'KAHVALTI';
/** Dashboard’dan düzenlenen kayıt: modal kaydedildiğinde silinip yenisi yazılır. */
let _yemekModalReplaceEntryId = null;
let lastSelectedFood = null;
let selectedDate = new Date().toISOString().split('T')[0];
let chartWeight = null;
let chartCalories = null;
let chartMacros = null;
let _personalPlan = null;
let _latestKnownWeight = null;
let selectedEntry = null;
let lastEntriesCache = [];
let modalSelectedFood = null;
let duzenlenecekEntryId = null;
let deleteConfirmCallback = null;
let _modalAraTid = null;
let _kutuphaneTimeout = null;
let _dateNavLock = false;

/* ============================================================
   DARK MODE
   ============================================================ */
function initTheme() {
    const saved = localStorage.getItem('sa_theme') || 'light';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    const iconDark  = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');
    const lbl = document.getElementById('theme-label');
    const emoji = document.getElementById('theme-emoji');
    const emojiMobile = document.getElementById('theme-emoji-mobile');
    const topBtn = document.getElementById('topbar-theme-btn');
    const mobileBtn = document.getElementById('mobile-theme-btn');
    if (iconDark)  iconDark.classList.toggle('hidden', isDark);
    if (iconLight) iconLight.classList.toggle('hidden', !isDark);
    if (lbl) lbl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    if (emoji) emoji.textContent = isDark ? '☀️' : '🌙';
    if (emojiMobile) emojiMobile.textContent = isDark ? '☀️' : '🌙';
    if (topBtn) topBtn.title = isDark ? 'Açık tema' : 'Koyu tema';
    if (mobileBtn) mobileBtn.title = isDark ? 'Açık tema' : 'Koyu tema';
    localStorage.setItem('sa_theme', theme);
    if (chartWeight || chartCalories || chartMacros) rebuildChartDefaults();
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

function rebuildChartDefaults() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    Chart.defaults.color = isDark ? '#94a3b8' : '#475569';
    Chart.defaults.borderColor = isDark ? '#263347' : '#e2e8f0';
}

/* ============================================================
   SVG GRADIENT
   ============================================================ */
function injectSvgDefs() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('svg-defs');
    svg.innerHTML = `
        <defs>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#16a34a"/>
                <stop offset="100%" style="stop-color:#4ade80"/>
            </linearGradient>
        </defs>`;
    document.body.appendChild(svg);
}

/* ============================================================
   AUTH
   ============================================================ */
function switchAuthTab(tab) {
    const isGiris = tab === 'giris';
    document.getElementById('form-giris').classList.toggle('hidden', !isGiris);
    document.getElementById('form-kayit').classList.toggle('hidden', isGiris);
    document.getElementById('tab-giris-btn').classList.toggle('active', isGiris);
    document.getElementById('tab-kayit-btn').classList.toggle('active', !isGiris);
    if (!isGiris) updateAuthStepper(1);
    clearAuthErrors();
}

function clearAuthErrors() {
    document.getElementById('giris-hata').classList.add('hidden');
    document.getElementById('kayit-hata').classList.add('hidden');
}

document.getElementById('form-giris').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('giris-submit-btn');
    setLoading(btn, true);
    document.getElementById('giris-hata').classList.add('hidden');
    try {
        const data = await apiFetch('/users/giris', {
            method: 'POST',
            body: JSON.stringify({
                email:    document.getElementById('giris-email').value.trim(),
                password: document.getElementById('giris-sifre').value
            })
        });
        currentUser = data;
        localStorage.setItem('sa_user', JSON.stringify(data));
        showApp();
    } catch (err) {
        const el = document.getElementById('giris-hata');
        el.textContent = '❌ ' + err.message;
        el.classList.remove('hidden');
    } finally {
        setLoading(btn, false);
    }
});

document.getElementById('form-kayit').addEventListener('submit', async e => {
    e.preventDefault();
    const step1Visible = !document.getElementById('kayit-step-1')?.classList.contains('hidden');
    if (step1Visible) {
        kayitAdim2Gec();
        return;
    }
    const btn = document.getElementById('kayit-submit-btn');
    setLoading(btn, true);
    document.getElementById('kayit-hata').classList.add('hidden');
    try {
        // Adım 1 – Kullanıcı kaydı
        const data = await apiFetch('/users/kayit', {
            method: 'POST',
            body: JSON.stringify({
                ad:       document.getElementById('kayit-ad').value.trim(),
                soyad:    document.getElementById('kayit-soyad').value.trim(),
                email:    document.getElementById('kayit-email').value.trim(),
                password: document.getElementById('kayit-sifre').value
            })
        });
        currentUser = data;
        localStorage.setItem('sa_user', JSON.stringify(data));

        // Adım 2 – Fiziksel bilgiler
        const dogum = document.getElementById('kayit-dogum')?.value;
        const boy   = parseFloat(document.getElementById('kayit-boy')?.value || '0');
        const kilo  = parseFloat(document.getElementById('kayit-kilo')?.value || '0');
        const hedef = parseFloat(document.getElementById('kayit-hedef-kilo')?.value || '0');
        if (dogum && boy > 0 && hedef > 0) {
            await apiFetch('/physical-info', {
                method: 'POST',
                body: JSON.stringify({
                    userId: data.id,
                    dogumTarihi: dogum,
                    cinsiyet: document.getElementById('kayit-cinsiyet').value,
                    boy,
                    hedefKilo: hedef,
                    aktiviteSeviyesi: document.getElementById('kayit-aktivite').value
                })
            }).catch(() => {});
        }

        // Güncel kiloyu günlük log'a yaz
        if (kilo > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const log = await apiFetch('/daily-logs', {
                method: 'POST',
                body: JSON.stringify({ userId: data.id, tarih: todayStr, guncelKilo: kilo, icilenSuMiktari: 0 })
            }).catch(() => null);
            if (log?.id) {
                await apiFetch(`/daily-logs/${log.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ guncelKilo: kilo })
                }).catch(() => {});
            }
        }

        showToast('Hoş geldin, ' + data.ad + '! 🎉', 'success');
        showApp();
    } catch (err) {
        const el = document.getElementById('kayit-hata');
        el.textContent = '❌ ' + err.message;
        el.classList.remove('hidden');
    } finally {
        setLoading(btn, false);
    }
});

function kayitAdim2Gec() {
    const ad    = document.getElementById('kayit-ad').value.trim();
    const soyad = document.getElementById('kayit-soyad').value.trim();
    const email = document.getElementById('kayit-email').value.trim();
    const sifre = document.getElementById('kayit-sifre').value;
    if (!ad || !soyad || !email || sifre.length < 6) {
        const el = document.getElementById('kayit-hata');
        el.textContent = '❌ Lütfen tüm alanları doldurun (şifre min. 6 karakter).';
        el.classList.remove('hidden');
        return;
    }
    document.getElementById('kayit-hata').classList.add('hidden');
    document.getElementById('kayit-step-1').classList.add('hidden');
    document.getElementById('kayit-step-2').classList.remove('hidden');
    updateAuthStepper(2);
}

function kayitAdim1Gec() {
    document.getElementById('kayit-step-2').classList.add('hidden');
    document.getElementById('kayit-step-1').classList.remove('hidden');
    updateAuthStepper(1);
}

function updateAuthStepper(step) {
    const d1 = document.getElementById('auth-step-dot-1');
    const d2 = document.getElementById('auth-step-dot-2');
    const line = document.getElementById('auth-step-line');
    if (!d1 || !d2 || !line) return;
    d1.classList.toggle('active', step >= 1);
    d2.classList.toggle('active', step >= 2);
    line.classList.toggle('active', step >= 2);
}

/* ============================================================
   APP INIT
   ============================================================ */
function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    updateUserUI();
    bindNavigation();
    bindDateStrip();
    navigateToPage('dashboard');

    selectedDate = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('dash-date');
    if (dateEl) dateEl.value = selectedDate;

    loadDashboard();
    fizikselBilgiGetir(); // Profil bilgilerini otomatik yükle
}

function profilePhotoStorageKey() {
    if (!currentUser) return null;
    if (currentUser.id != null) return 'sa_profile_photo_' + currentUser.id;
    if (currentUser.email) return 'sa_profile_photo_' + encodeURIComponent(currentUser.email);
    return null;
}

function setAvatarPhoto(el, initialLetter, dataUrl) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.indexOf('data:image') === 0) {
        const img = document.createElement('img');
        img.className = 'avatar-photo-img';
        img.alt = '';
        img.draggable = false;
        img.src = dataUrl;
        el.appendChild(img);
        el.dataset.hasPhoto = '1';
    } else {
        el.textContent = initialLetter;
        delete el.dataset.hasPhoto;
    }
}

function refreshProfilePhotosOnUI() {
    if (!currentUser) return;
    const initial = (currentUser.ad || '?')[0].toUpperCase();
    const key = profilePhotoStorageKey();
    const dataUrl = key ? localStorage.getItem(key) : null;
    ['sb-avatar', 'topbar-avatar', 'mobile-avatar', 'profil-avatar'].forEach(id => {
        setAvatarPhoto(document.getElementById(id), initial, dataUrl);
    });
}

let _profilPhotoBackdropBound = false;
function profilPhotoMenuBackdrop() {
    document.removeEventListener('click', profilPhotoMenuBackdrop);
    _profilPhotoBackdropBound = false;
    const menu = document.getElementById('profil-photo-menu');
    if (menu) menu.classList.add('hidden');
}

function profilPhotoMenuToggle(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('profil-photo-menu');
    if (!menu) return;
    const opening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    const removeBtn = menu.querySelector('.profil-photo-remove');
    if (removeBtn) {
        const key = profilePhotoStorageKey();
        const has = !!(key && localStorage.getItem(key));
        removeBtn.classList.toggle('hidden', !has);
    }
    if (opening) {
        setTimeout(() => {
            _profilPhotoBackdropBound = true;
            document.addEventListener('click', profilPhotoMenuBackdrop);
        }, 0);
    } else if (_profilPhotoBackdropBound) {
        document.removeEventListener('click', profilPhotoMenuBackdrop);
        _profilPhotoBackdropBound = false;
    }
}

function profilPhotoMenuCloseOnly() {
    const menu = document.getElementById('profil-photo-menu');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    if (_profilPhotoBackdropBound) {
        document.removeEventListener('click', profilPhotoMenuBackdrop);
        _profilPhotoBackdropBound = false;
    }
}

function profilPhotoPickGallery(e) {
    if (e) e.stopPropagation();
    profilPhotoMenuCloseOnly();
    document.getElementById('profil-photo-file-gallery')?.click();
}

function profilPhotoPickCamera(e) {
    if (e) e.stopPropagation();
    profilPhotoMenuCloseOnly();
    document.getElementById('profil-photo-file-camera')?.click();
}

function profilPhotoRemove(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const key = profilePhotoStorageKey();
    if (key) localStorage.removeItem(key);
    refreshProfilePhotosOnUI();
    profilPhotoMenuCloseOnly();
    showToast('Profil fotoğrafı kaldırıldı.', 'success');
}

function compressProfileImageToDataUrl(file, maxEdge, quality) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                URL.revokeObjectURL(url);
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                const scale = Math.min(1, maxEdge / Math.max(w, h));
                w = Math.round(w * scale);
                h = Math.round(h * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (err) { reject(err); }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Görsel yüklenemedi'));
        };
        img.src = url;
    });
}

async function profilPhotoFileChosen(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    if (!file || !file.type || file.type.indexOf('image') !== 0) return;
    const key = profilePhotoStorageKey();
    if (!key) {
        showToast('Oturum bulunamadı.', 'error');
        return;
    }
    try {
        const dataUrl = await compressProfileImageToDataUrl(file, 512, 0.88);
        localStorage.setItem(key, dataUrl);
        refreshProfilePhotosOnUI();
        showToast('Profil fotoğrafı güncellendi.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Fotoğraf işlenemedi.', 'error');
    }
}

function updateUserUI() {
    if (!currentUser) return;
    const fullName = currentUser.ad + ' ' + currentUser.soyad;

    refreshProfilePhotosOnUI();

    setText('sb-user-name', fullName);
    setText('sb-user-email', currentUser.email);
    setText('topbar-user-name', fullName);
    setText('profil-name', fullName);
    setText('profil-email', currentUser.email);
}

function cikisYap() {
    localStorage.removeItem('sa_user');
    currentUser = null; todayLogId = null;
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('form-giris').reset();
    clearAuthErrors();
    if (chartWeight)   { chartWeight.destroy(); chartWeight = null; }
    if (chartCalories) { chartCalories.destroy(); chartCalories = null; }
    if (chartMacros)   { chartMacros.destroy(); chartMacros = null; }
    showToast('Çıkış yapıldı.', 'success');
}

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    const main = document.querySelector('.app-main');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sb) return;
    if (window.innerWidth <= 768) {
        const opened = sb.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('hidden', !opened);
    } else {
        const collapsed = sb.classList.toggle('collapsed');
        if (main) {
            main.style.marginLeft = collapsed ? '0' : 'var(--sidebar-w)';
            main.style.width = collapsed ? '100%' : 'calc(100% - var(--sidebar-w))';
        }
        if (backdrop) backdrop.classList.add('hidden');
    }
}

function closeSidebar() {
    const sb = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (backdrop) backdrop.classList.add('hidden');
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeSidebar();
    }
});

function bindNavigation() {
    document.querySelectorAll('.sb-nav-item, .mb-nav-item').forEach(btn => {
        if (btn.dataset.boundNav === '1') return;
        btn.dataset.boundNav = '1';
        btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
    });
}

function navigateToPage(pageKey) {
    if (!pageKey) return;
    document.querySelectorAll('.sb-nav-item, .mb-nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.page === pageKey);
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageKey);
    if (page) page.classList.add('active');
    closeSidebar();

    const titles = { dashboard: 'Ana Sayfa', profil: 'Profilim', raporlar: 'Analiz ve Raporlar' };
    setText('topbar-title', titles[pageKey] || 'Sağlık Asistanı');

    if (pageKey === 'raporlar') raporlariYukle();
    if (pageKey === 'profil') fizikselBilgiGetir();
}

/* ============================================================
   DATE STRIP
   ============================================================ */
function bindDateStrip() {
    const dateEl = document.getElementById('dash-date');
    if (dateEl && !dateEl.dataset.bound) {
        dateEl.dataset.bound = '1';
        dateEl.addEventListener('change', () => {
            if (dateEl.value) tarihSecildi(dateEl.value);
        });
    }
}

function tarihSecildi(val) { selectedDate = val; loadDashboard(); }

function tarihGeri() {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    selectedDate = d.toISOString().split('T')[0];
    const el = document.getElementById('dash-date');
    if (el) el.value = selectedDate;
    loadDashboard();
}

function tarihIleri() {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    selectedDate = d.toISOString().split('T')[0];
    const el = document.getElementById('dash-date');
    if (el) el.value = selectedDate;
    loadDashboard();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
    const dateEl = document.getElementById('dash-date');
    if (dateEl?.value) selectedDate = dateEl.value;
    if (dateEl && dateEl.value !== selectedDate) dateEl.value = selectedDate;

    const saat = new Date().getHours();
    const selam = saat < 6 ? 'İyi geceler' : saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar';
    setText('dashboard-greeting', `${selam}, ${currentUser?.ad || 'Hoş geldin'} 👋`);

    const d = new Date(selectedDate + 'T00:00:00');
    setText('dashboard-date', d.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

    await hedefKaloriYukle();

    const log = await getOrCreateLogByDate(selectedDate);
    if (!log) return;

    todayLogId = log.id;
    const suVal = log.icilenSuMiktari ?? 0;
    setText('dash-su', suVal);
    setText('dash-kilo', log.guncelKilo ? (Math.round(log.guncelKilo * 10) / 10) : '—');
    if (log.guncelKilo) _latestKnownWeight = log.guncelKilo;

    updateWaterUI(suVal);

    if (log.guncelKilo) {
        const kiloRow = document.getElementById('kilo-bmi-row');
        if (kiloRow) kiloRow.classList.remove('hidden');
        updateBmiChip(log.guncelKilo);
    }

    await mealListeleriYukle(todayLogId);

    loadStreak();
}

async function getOrCreateLogByDate(dateStr) {
    const logs = await apiFetch(`/daily-logs/${currentUser.id}`).catch(() => []);
    const found = (logs || []).find(l => l.tarih === dateStr);
    if (found?.id) return found;
    return await apiFetch('/daily-logs', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, tarih: dateStr, guncelKilo: null, icilenSuMiktari: 0 })
    }).catch(() => null);
}

async function hedefKaloriYukle() {
    try {
        const g = await apiFetch(`/goals/${currentUser.id}`);
        setText('kcal-hedef', g?.gunlukHedefKalori ?? 2000);
        setActivePreset(g?.gunlukHedefKalori ?? 2000);
        return g;
    } catch {
        setText('kcal-hedef', 2000);
        setActivePreset(2000);
        return null;
    }
}

async function mealListeleriYukle(logId) {
    if (!logId) return;
    const all = await apiFetch(`/food-entries/${logId}`).catch(() => []);
    lastEntriesCache = all || [];

    if (selectedEntry && !lastEntriesCache.some(e => e.id === selectedEntry.id)) {
        selectedEntry = null;
        renderSelectedEntry(null);
    } else if (selectedEntry) {
        selectedEntry = lastEntriesCache.find(e => e.id === selectedEntry.id) || selectedEntry;
        renderSelectedEntry(selectedEntry);
    }

    const byTip = { KAHVALTI: [], OGLE: [], AKSAM: [], ARA_OGUN: [] };
    lastEntriesCache.forEach(e => {
        const t = e.ogunTipi || 'ARA_OGUN';
        if (!byTip[t]) byTip[t] = [];
        byTip[t].push(e);
    });

    renderMealList('meal-KAHVALTI', byTip.KAHVALTI);
    renderMealList('meal-OGLE', byTip.OGLE);
    renderMealList('meal-AKSAM', byTip.AKSAM);
    renderMealList('meal-ARA_OGUN', byTip.ARA_OGUN);

    // Per-meal kcal badges
    ['KAHVALTI', 'OGLE', 'AKSAM', 'ARA_OGUN'].forEach(tip => {
        const kcal = byTip[tip].reduce((s, e) => s + (e.toplamKalori ?? 0), 0);
        const el = document.getElementById('meal-kcal-' + tip);
        if (el) el.textContent = kcal + ' kcal';
    });

    const takenKcal = lastEntriesCache.reduce((s, e) => s + (e.toplamKalori ?? 0), 0);
    const goal = parseInt(document.getElementById('kcal-hedef').textContent) || 2000;
    const kalan = Math.max(0, goal - takenKcal);

    animateNumber('kcal-alinan', takenKcal);
    animateNumber('kcal-kalan', kalan);

    updateCalorieRing(takenKcal, goal);

    const totP = lastEntriesCache.reduce((s, e) => s + (e.toplamProtein ?? 0), 0);
    const totK = lastEntriesCache.reduce((s, e) => s + (e.toplamKarb ?? 0), 0);
    const totY = lastEntriesCache.reduce((s, e) => s + (e.toplamYag ?? 0), 0);

    const fmt = v => Math.round((v || 0) * 10) / 10;
    setText('macro-protein', fmt(totP));
    setText('macro-karb', fmt(totK));
    setText('macro-yag', fmt(totY));

    updateMacroBars(totP, totK, totY);
    updateCalorieStatus(takenKcal, goal);
    updateMacroTip(takenKcal, totP, totK, totY);
}

/* ============================================================
   CALORIE RING
   ============================================================ */
function updateCalorieRing(consumed, goal) {
    const fill = document.getElementById('calorie-ring-fill');
    const over = document.getElementById('calorie-ring-over');
    if (!fill) return;

    if (goal <= 0) {
        fill.style.strokeDashoffset = CIRC;
        if (over) over.style.opacity = '0';
        return;
    }

    const pct = Math.min(consumed / goal, 1);
    fill.style.strokeDashoffset = CIRC * (1 - pct);

    if (over) {
        if (consumed > goal) {
            const overPct = Math.min((consumed - goal) / goal, 1);
            over.style.strokeDashoffset = CIRC * (1 - overPct);
            over.style.opacity = '1';
        } else {
            over.style.opacity = '0';
        }
    }
}

function updateCalorieStatus(consumed, goal) {
    const el = document.getElementById('calorie-status');
    if (!el) return;
    if (!consumed) {
        el.textContent = 'Başlamadı';
        el.className = 'ring-kalan-val ring-status empty';
        return;
    }
    const pct = Math.round((consumed / goal) * 100);
    if (consumed > goal) {
        el.textContent = `+${consumed - goal} kcal`;
        el.className = 'ring-kalan-val ring-status over';
    } else if (pct >= 90) {
        el.textContent = 'Hedefe Yakın!';
        el.className = 'ring-kalan-val ring-status ok';
    } else {
        el.textContent = pct + '%';
        el.className = 'ring-kalan-val ring-status ok';
    }
}

/* ============================================================
   MACRO BARS
   ============================================================ */
function updateMacroBars(protein, karb, yag) {
    const proteinKcal = protein * 4;
    const karbKcal = karb * 4;
    const yagKcal = yag * 9;
    const total = proteinKcal + karbKcal + yagKcal;

    if (total <= 0) {
        setBarWidth('macro-protein-bar', 0);
        setBarWidth('macro-karb-bar', 0);
        setBarWidth('macro-yag-bar', 0);
        setText('macro-protein-pct', '—');
        setText('macro-karb-pct', '—');
        setText('macro-yag-pct', '—');
        return;
    }

    const pp = Math.round((proteinKcal / total) * 100);
    const kp = Math.round((karbKcal / total) * 100);
    const yp = Math.round((yagKcal / total) * 100);

    setBarWidth('macro-protein-bar', pp);
    setBarWidth('macro-karb-bar', kp);
    setBarWidth('macro-yag-bar', yp);

    setText('macro-protein-pct', pp + '%');
    setText('macro-karb-pct', kp + '%');
    setText('macro-yag-pct', yp + '%');
}

function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(pct, 100) + '%';
}

function updateMacroTip(kcal, p, k, y) {
    const el = document.getElementById('macro-tip');
    if (!el) return;
    if (!kcal) { el.textContent = 'Bugün henüz besin eklenmedi.'; return; }
    const tips = [
        p < 30 ? '💡 Daha fazla protein almayı dene (et, yumurta, süt ürünleri).' : null,
        y > 100 ? '⚠️ Yağ tüketimi yüksek, dikkat et.' : null,
        k > 300 ? '💡 Karbonhidrat yüksek, tam tahıllara geç.' : null,
    ].filter(Boolean);
    el.textContent = tips[0] || '✅ Makro dengen iyi görünüyor!';
}

/* ============================================================
   WATER
   ============================================================ */
function updateWaterUI(ml) {
    const pct = Math.min((ml / WATER_GOAL) * 100, 100);
    const fill = document.getElementById('water-bottle-fill');
    const progress = document.getElementById('water-progress-fill');
    const valEl = document.getElementById('water-bottle-val');
    const remEl = document.getElementById('water-remaining-text');

    if (fill) fill.style.height = pct + '%';
    if (progress) progress.style.width = pct + '%';
    if (valEl) valEl.textContent = Math.round(pct) + '%';

    const remaining = Math.max(0, WATER_GOAL - ml);
    if (remEl) {
        remEl.textContent = remaining > 0
            ? `${remaining} ml kalan (hedef ${WATER_GOAL} ml)`
            : '🎉 Günlük su hedefine ulaştın!';
    }
}

/* ============================================================
   BMI
   ============================================================ */
function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    return weightKg / (h * h);
}

function updateBmiChip(weight) {
    const chip = document.getElementById('bmi-chip');
    if (!chip) return;

    const physInfo = window._physInfo;
    if (!physInfo?.boy) { chip.textContent = 'Boy gir → BMI'; chip.className = 'bmi-chip'; return; }

    const bmi = calcBMI(weight, physInfo.boy);
    if (!bmi) return;
    const { label, cls } = getBmiCategory(bmi);
    chip.textContent = `BMI: ${bmi.toFixed(1)} – ${label}`;
    chip.className = `bmi-chip ${cls}`;

    const kiloRow = document.getElementById('kilo-bmi-row');
    if (kiloRow) kiloRow.classList.remove('hidden');
}

function getBmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'Zayıf', cls: 'underweight' };
    if (bmi < 25)   return { label: 'Normal', cls: 'normal' };
    if (bmi < 30)   return { label: 'Fazla Kilolu', cls: 'overweight' };
    return { label: 'Obez', cls: 'obese' };
}

function showBmiCard(bmi, height) {
    const card = document.getElementById('bmi-card');
    if (!card) return;

    const { label, cls } = getBmiCategory(bmi);
    setText('bmi-value', bmi.toFixed(1));

    const labelEl = document.getElementById('bmi-label');
    if (labelEl) {
        const colors = { underweight: '#3b82f6', normal: '#22c55e', overweight: '#f97316', obese: '#ef4444' };
        labelEl.textContent = label;
        labelEl.style.background = colors[cls] + '20';
        labelEl.style.color = colors[cls];
        labelEl.style.padding = '3px 10px';
        labelEl.style.borderRadius = '999px';
    }

    // indicator position (zona gore lineer)
    const pct = calcBmiIndicatorPct(bmi);
    const indicator = document.getElementById('bmi-indicator');
    if (indicator) setTimeout(() => { indicator.style.left = pct + '%'; }, 100);

    const noteEl = document.getElementById('bmi-note');
    if (noteEl) {
        const notes = {
            underweight: 'Vücut kitle indeksiniz normalin altında. Sağlıklı kilo almayı düşünebilirsiniz.',
            normal: 'Vücut kitle indeksiniz normal aralıkta. Tebrikler!',
            overweight: 'Vücut kitle indeksiniz biraz yüksek. Egzersiz ve sağlıklı beslenme önerilir.',
            obese: 'Sağlık açısından risk oluşturabilir. Bir doktorla görüşmenizi öneririz.'
        };
        noteEl.textContent = notes[cls];
    }

    card.classList.remove('hidden');
}

function calcBmiIndicatorPct(bmi) {
    if (!isFinite(bmi) || bmi <= 0) return 0;
    if (bmi < 18.5) return Math.max(0, Math.min(25, (bmi / 18.5) * 25));
    if (bmi < 25) return 25 + ((bmi - 18.5) / (25 - 18.5)) * 25;
    if (bmi < 30) return 50 + ((bmi - 25) / (30 - 25)) * 25;
    return 75 + Math.min(25, ((bmi - 30) / 10) * 25);
}

function calcAgeFromBirthDate(birthDate) {
    if (!birthDate) return null;
    const b = new Date(birthDate + 'T00:00:00');
    if (!isFinite(b.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return Math.max(0, age);
}

function calcNutritionPlan(currentWeight, targetWeight, height, birthDate, gender, activity) {
    if (!currentWeight || !targetWeight || !height || !birthDate) return null;
    const age = calcAgeFromBirthDate(birthDate);
    if (age == null) return null;

    let bmr;
    if (gender === 'ERKEK') {
        bmr = 88.36 + (13.4 * currentWeight) + (5.0 * height) - (5.7 * age);
    } else {
        bmr = 447.6 + (9.2 * currentWeight) + (3.1 * height) - (4.3 * age);
    }
    const factors = { SEDANTER: 1.2, HAFIF_AKTIF: 1.375, ORTA_AKTIF: 1.55, COK_AKTIF: 1.725, EKSTRA_AKTIF: 1.9 };
    const maintenance = Math.round(bmr * (factors[activity] || 1.2));
    const diff = Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10;
    const action = targetWeight < currentWeight ? 'kilo_ver' : targetWeight > currentWeight ? 'kilo_al' : 'koru';
    const delta = diff >= 5 ? 500 : 300;

    let targetCalories = maintenance;
    if (action === 'kilo_ver') targetCalories = maintenance - delta;
    if (action === 'kilo_al') targetCalories = maintenance + delta;
    const minSafe = gender === 'ERKEK' ? 1500 : 1200;
    if (action === 'kilo_ver') targetCalories = Math.max(minSafe, targetCalories);

    const weekly = action === 'koru' ? 0 : (delta === 500 ? 0.5 : 0.3);
    const durationWeeks = weekly > 0 ? Math.ceil(diff / weekly) : 0;
    return { maintenance, targetCalories, action, weekly, durationWeeks, diff };
}

function updateGoalPresetsFromPlan() {
    if (!_personalPlan) return;
    const planTarget = Math.round(_personalPlan.targetCalories / 50) * 50;
    const maintenance = Math.round(_personalPlan.maintenance / 50) * 50;
    const presets = [
        { kcal: Math.max(1000, planTarget - 200), emoji: '⬇️', label: 'Düşük' },
        { kcal: planTarget, emoji: '🎯', label: 'Kişisel Hedef' },
        { kcal: maintenance, emoji: '⚖️', label: 'Koruma' },
        { kcal: maintenance + 200, emoji: '💪', label: 'Yüksek' }
    ];
    const buttons = Array.from(document.querySelectorAll('.preset-btn'));
    buttons.forEach((btn, i) => {
        const p = presets[i] || presets[presets.length - 1];
        btn.dataset.kcal = String(p.kcal);
        btn.innerHTML = `${p.emoji} ${p.kcal}<span>${p.label}</span>`;
    });
}

/* ============================================================
   STREAK
   ============================================================ */
async function loadStreak() {
    try {
        const logs = await apiFetch(`/daily-logs/${currentUser.id}`).catch(() => []);
        const streak = calcStreak(logs || []);
        updateStreakUI(streak);

        // Report stats
        setText('rstat-days', logs.length);
        setText('rstat-streak', streak);
        if (logs.length > 0) {
            const cals = logs.filter(l => l.toplamAlinanKalori > 0).map(l => l.toplamAlinanKalori);
            if (cals.length > 0) {
                const avg = Math.round(cals.reduce((a, b) => a + b, 0) / cals.length);
                setText('rstat-avg-cal', avg);
            }
            const weights = logs.filter(l => l.guncelKilo).map(l => l.guncelKilo).sort((a, b) => a - b);
            if (weights.length >= 2) {
                const diff = ((weights[weights.length - 1] - weights[0]) * 10 | 0) / 10;
                const el = document.getElementById('rstat-weight-change');
                if (el) {
                    el.textContent = (diff > 0 ? '+' : '') + diff + ' kg';
                    el.style.color = diff < 0 ? 'var(--green)' : diff > 0 ? 'var(--red)' : '';
                }
            }
        }
    } catch {}
}

function calcStreak(logs) {
    if (!logs.length) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const log = logs.find(l => l.tarih === ds);
        if (log && (log.toplamAlinanKalori > 0 || log.icilenSuMiktari > 0)) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    return streak;
}

function updateStreakUI(streak) {
    if (streak <= 1) return;
    const dashMini = document.getElementById('dash-streak-mini');
    if (dashMini) dashMini.classList.remove('hidden');
    setText('dash-streak-count', streak);

    const profileBadge = document.getElementById('profil-streak');
    if (profileBadge) {
        profileBadge.textContent = `🔥 ${streak} günlük seri`;
        profileBadge.classList.remove('hidden');
    }
}

/* ============================================================
   HEDEF KALORİ
   ============================================================ */
async function setGunlukHedefAc() {
    document.getElementById('hedef-sonuc').classList.add('hidden');
    document.getElementById('hedef-modal').classList.remove('hidden');
    updateGoalPresetsFromPlan();
    const g = await apiFetch(`/goals/${currentUser.id}`).catch(() => null);
    document.getElementById('hedef-kcal-input').value = g?.gunlukHedefKalori ?? 2000;
    setActivePreset(g?.gunlukHedefKalori);
}

function setHedefPreset(val) {
    document.getElementById('hedef-kcal-input').value = val;
    setActivePreset(val);
}

function setHedefPresetFromBtn(btn) {
    const kcal = parseInt(btn?.dataset?.kcal || '0');
    if (!kcal) return;
    setHedefPreset(kcal);
}

function setActivePreset(val) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.kcal || '0') === val);
    });
}

async function setGunlukHedefKaydet() {
    const kcal = parseInt(document.getElementById('hedef-kcal-input').value || '0');
    if (!kcal || kcal < 500) { showResult('hedef-sonuc', '❌ Geçersiz kalori hedefi.', 'error'); return; }
    try {
        await apiFetch('/goals', {
            method: 'POST',
            body: JSON.stringify({ userId: currentUser.id, gunlukHedefKalori: kcal })
        });
        setText('kcal-hedef', kcal);
        const taken = parseInt(document.getElementById('kcal-alinan').textContent) || 0;
        setText('kcal-kalan', Math.max(0, kcal - taken));
        updateCalorieRing(taken, kcal);
        updateCalorieStatus(taken, kcal);
        showToast('Hedef kalori güncellendi!', 'success');
        setTimeout(() => closeModal('hedef-modal'), 700);
    } catch (err) {
        showResult('hedef-sonuc', '❌ ' + err.message, 'error');
    }
}

/* ============================================================
   PROFİL – FİZİKSEL
   ============================================================ */
document.getElementById('form-fiziksel').addEventListener('submit', async e => {
    e.preventDefault();
    clearResult('fiziksel-sonuc');
    try {
        const data = await apiFetch('/physical-info', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                dogumTarihi: document.getElementById('fiz-dogum').value,
                cinsiyet: document.getElementById('fiz-cinsiyet').value,
                boy: parseFloat(document.getElementById('fiz-boy').value),
                hedefKilo: parseFloat(document.getElementById('fiz-hedefKilo').value),
                aktiviteSeviyesi: document.getElementById('fiz-aktivite').value
            })
        });
        window._physInfo = data;
        showResult('fiziksel-sonuc', `✅ Kaydedildi! Boy: ${data.boy} cm | Hedef: ${data.hedefKilo} kg`, 'success');
        showToast('Fiziksel bilgiler güncellendi.', 'success');
        await renderPhysInfo(data);
        fillPhysForm(data);
    } catch (err) {
        showResult('fiziksel-sonuc', '❌ ' + err.message, 'error');
    }
});

async function fizikselBilgiGetir() {
    const el = document.getElementById('fiziksel-getir-sonuc');
    el.classList.add('hidden');
    try {
        const d = await apiFetch(`/physical-info/${currentUser.id}`);
        window._physInfo = d;
        await renderPhysInfo(d);
        fillPhysForm(d);
    } catch (err) {
        el.innerHTML = `<p style="color:var(--red);font-size:13px">❌ ${err.message}</p>`;
        el.classList.remove('hidden');
    }
}

async function renderPhysInfo(d) {
    const el = document.getElementById('fiziksel-getir-sonuc');
    const cinMap = { ERKEK: 'Erkek', KADIN: 'Kadın' };
    const actMap = {
        SEDANTER: 'Sedanter', HAFIF_AKTIF: 'Hafif Aktif',
        ORTA_AKTIF: 'Orta Aktif', COK_AKTIF: 'Çok Aktif', EKSTRA_AKTIF: 'Ekstra Aktif'
    };
    el.innerHTML = `
        <div class="fiz-row"><span class="fiz-row-label">Doğum Tarihi</span><span class="fiz-row-val">${d.dogumTarihi ?? '—'}</span></div>
        <div class="fiz-row"><span class="fiz-row-label">Cinsiyet</span><span class="fiz-row-val">${cinMap[d.cinsiyet] ?? d.cinsiyet ?? '—'}</span></div>
        <div class="fiz-row"><span class="fiz-row-label">Boy</span><span class="fiz-row-val">${d.boy ?? '—'} cm</span></div>
        <div class="fiz-row"><span class="fiz-row-label">Hedef Kilo</span><span class="fiz-row-val">${d.hedefKilo ?? '—'} kg</span></div>
        <div class="fiz-row"><span class="fiz-row-label">Aktivite</span><span class="fiz-row-val">${actMap[d.aktiviteSeviyesi] ?? d.aktiviteSeviyesi ?? '—'}</span></div>
    `;
    el.classList.remove('hidden');

    // BMI
    const log = null;
    const currentWeight = await getCurrentWeightForPlan(d);
    if (currentWeight && d.boy) {
        const bmi = calcBMI(currentWeight, d.boy);
        if (bmi) showBmiCard(bmi);
        updateBmiChip(currentWeight);
    }

    // Kalori plani
    if (d.boy && d.hedefKilo && d.dogumTarihi && currentWeight) {
        const plan = calcNutritionPlan(currentWeight, d.hedefKilo, d.boy, d.dogumTarihi, d.cinsiyet, d.aktiviteSeviyesi);
        if (plan) {
            showTdeeCard(plan);
            _personalPlan = plan;
            updateGoalPresetsFromPlan();
            syncGoalFromPlan(plan);
        }
    } else {
        showTdeeCard(null);
    }
}

async function getCurrentWeightForPlan(physInfo) {
    const dashWeight = parseFloat(document.getElementById('dash-kilo')?.textContent);
    if (isFinite(dashWeight) && dashWeight > 0) return dashWeight;
    if (isFinite(_latestKnownWeight) && _latestKnownWeight > 0) return _latestKnownWeight;

    if (currentUser?.id) {
        const logs = await apiFetch(`/daily-logs/${currentUser.id}`).catch(() => []);
        const fromLogs = (logs || [])
            .filter(l => l?.guncelKilo && isFinite(l.guncelKilo))
            .sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')))[0]?.guncelKilo;
        if (isFinite(fromLogs) && fromLogs > 0) {
            _latestKnownWeight = fromLogs;
            return fromLogs;
        }
    }

    const target = parseFloat(physInfo?.hedefKilo || '0');
    return isFinite(target) && target > 0 ? target : null;
}

function fillPhysForm(d) {
    if (!d) return;
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el && value != null) el.value = value;
    };
    setVal('fiz-dogum', d.dogumTarihi);
    setVal('fiz-cinsiyet', d.cinsiyet);
    setVal('fiz-boy', d.boy);
    setVal('fiz-hedefKilo', d.hedefKilo);
    setVal('fiz-aktivite', d.aktiviteSeviyesi);
}

function showTdeeCard(plan) {
    const card = document.getElementById('tdee-card');
    if (!card) return;
    if (!plan) {
        setText('tdee-maintenance', '—');
        setText('tdee-target', '—');
        setText('tdee-weekly', '—');
        setText('tdee-duration', '—');
        setText('tdee-note', 'Kalori planı için dashboarda güncel kilo giriniz.');
        card.classList.remove('hidden');
        return;
    }
    setText('tdee-maintenance', plan.maintenance);
    setText('tdee-target', plan.targetCalories);
    if (plan.action === 'koru') {
        setText('tdee-weekly', 'Sabit');
        setText('tdee-duration', 'Hedefte');
    } else {
        const dir = plan.action === 'kilo_ver' ? '-' : '+';
        setText('tdee-weekly', `~${dir}${plan.weekly} kg/hafta`);
        setText('tdee-duration', `${plan.durationWeeks} hafta`);
    }
    const actionText = plan.action === 'kilo_ver' ? 'kilo verme' : plan.action === 'kilo_al' ? 'kilo alma' : 'koruma';
    setText('tdee-note', `Hedef farkı: ${plan.diff} kg · Plan: ${actionText}`);
    card.classList.remove('hidden');
}

async function syncGoalFromPlan(plan) {
    if (!plan?.targetCalories || !currentUser?.id) return;
    try {
        await apiFetch('/goals', {
            method: 'POST',
            body: JSON.stringify({ userId: currentUser.id, gunlukHedefKalori: plan.targetCalories })
        });
        setText('kcal-hedef', plan.targetCalories);
        const input = document.getElementById('hedef-kcal-input');
        if (input) input.value = plan.targetCalories;
        setActivePreset(plan.targetCalories);
    } catch (_) {}
}

/* ============================================================
   BESİN KÜTÜPHANESİ
   ============================================================ */
function kutuphaneAra(val) {
    clearTimeout(_kutuphaneTimeout);
    _kutuphaneTimeout = setTimeout(async () => {
        if (!val || val.trim().length < 2) return kutuphaneYenile();
        const data = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(val.trim())}`).catch(() => []);
        renderKutuphane(data);
    }, 250);
}

async function kutuphaneYenile() {
    document.getElementById('kutuphane-stat').textContent = 'Yükleniyor…';
    const data = await apiFetch('/foods').catch(() => []);
    renderKutuphane(data);
}

function renderKutuphane(list) {
    const tb = document.getElementById('kutuphane-tbody');
    const stat = document.getElementById('kutuphane-stat');
    if (!tb) return;

    if (stat) stat.textContent = list?.length ? `${list.length} besin listeleniyor` : '';

    if (!list?.length) {
        tb.innerHTML = '<tr><td colspan="6" class="muted">Kayıt bulunamadı.</td></tr>';
        return;
    }
    tb.innerHTML = list.map(f => `
        <tr>
            <td>${escHtml(f.yemekAdi)}</td>
            <td>${f.birimKalori ?? '—'}</td>
            <td>${f.birimProtein ?? '—'}</td>
            <td>${f.birimYag ?? '—'}</td>
            <td>${f.birimKarb ?? '—'}</td>
            <td>${escHtml(f.birimMiktar ?? '')}</td>
        </tr>
    `).join('');
}

function yeniBesinFormAc() {
    document.getElementById('yeni-besin-form').classList.remove('hidden');
    document.getElementById('nb-sonuc').classList.add('hidden');
    document.getElementById('nb-ad').focus();
}

function yeniBesinFormKapat() {
    document.getElementById('yeni-besin-form').classList.add('hidden');
}

async function yeniBesinKaydet() {
    clearResult('nb-sonuc');
    try {
        await apiFetch('/foods', {
            method: 'POST',
            body: JSON.stringify({
                yemekAdi: document.getElementById('nb-ad').value.trim(),
                birimMiktar: document.getElementById('nb-birim').value.trim(),
                birimKalori: parseInt(document.getElementById('nb-kcal').value),
                birimProtein: parseFloat(document.getElementById('nb-protein').value || '0'),
                birimKarb: parseFloat(document.getElementById('nb-karb').value || '0'),
                birimYag: parseFloat(document.getElementById('nb-yag').value || '0')
            })
        });
        showResult('nb-sonuc', '✅ Besin eklendi.', 'success');
        showToast('Yeni besin eklendi!', 'success');
        await kutuphaneYenile();
        setTimeout(() => yeniBesinFormKapat(), 800);
    } catch (err) {
        showResult('nb-sonuc', '❌ ' + err.message, 'error');
    }
}

/* ============================================================
   RAPORLAR
   ============================================================ */
async function raporlariYukle() {
    if (!currentUser) return;
    rebuildChartDefaults();

    const [weights, cal7, prog, macros] = await Promise.all([
        apiFetch(`/reports/${currentUser.id}/weights`).catch(() => []),
        apiFetch(`/reports/${currentUser.id}/calories/last7days`).catch(() => []),
        apiFetch(`/reports/${currentUser.id}/progress`).catch(() => null),
        apiFetch(`/reports/${currentUser.id}/macros/last7days`).catch(() => null)
    ]);

    renderWeightChart(weights);
    renderCaloriesChart(cal7);
    renderProgress(prog);
    renderMacroChartFromSummary(macros);

    await loadStreak();
}

function renderWeightChart(points) {
    const ctx = document.getElementById('chart-weight');
    if (!ctx) return;
    const labels = (points || []).map(p => formatDateShort(p.tarih));
    const data   = (points || []).map(p => p.kilo);

    if (chartWeight) chartWeight.destroy();
    chartWeight = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Kilo (kg)',
                data,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.08)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#22c55e',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
            scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,.05)' } } }
        }
    });
}

function renderCaloriesChart(days) {
    const ctx = document.getElementById('chart-calories');
    if (!ctx) return;
    const labels = (days || []).map(p => formatDateShort(p.tarih));
    const data   = (days || []).map(p => p.kalori);
    const goal   = parseInt(document.getElementById('kcal-hedef')?.textContent) || 2000;

    if (chartCalories) chartCalories.destroy();
    chartCalories = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Kalori (kcal)',
                    data,
                    backgroundColor: data.map(d => d > goal ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)'),
                    borderRadius: 6
                },
                {
                    label: 'Hedef',
                    data: labels.map(() => goal),
                    type: 'line',
                    borderColor: '#f97316',
                    borderDash: [5, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } } }
        }
    });
}

function renderMacroChartFromSummary(summary) {
    const ctx = document.getElementById('chart-macros');
    if (!ctx) return;

    const p = summary?.toplamProtein || 0;
    const k = summary?.toplamKarb || 0;
    const y = summary?.toplamYag || 0;

    const proteinKcal = p * 4;
    const karbKcal    = k * 4;
    const yagKcal     = y * 9;
    const total = proteinKcal + karbKcal + yagKcal;

    if (!total) {
        const wrap = ctx.closest('.macro-donut-wrap');
        if (wrap) wrap.innerHTML = '<p class="muted" style="text-align:center;padding:40px 0;width:100%">Henüz yeterli veri yok.</p>';
        return;
    }

    if (chartMacros) chartMacros.destroy();
    chartMacros = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['P', 'K', 'Y'],
            datasets: [{
                data: [proteinKcal, karbKcal, yagKcal],
                backgroundColor: ['#3b82f6', '#f97316', '#a855f7'],
                borderWidth: 2,
                borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#141e30' : '#fff'
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: { legend: { display: false } }
        }
    });

    const legend = document.getElementById('macro-legend');
    if (legend) {
        legend.className = 'macro-legend macro-legend-inline';
        legend.innerHTML = [
            { abbr: 'P', kcal: proteinKcal, color: '#3b82f6' },
            { abbr: 'K', kcal: karbKcal, color: '#f97316' },
            { abbr: 'Y', kcal: yagKcal, color: '#a855f7' }
        ].map(m => `
            <div class="macro-legend-item">
                <span class="macro-legend-dot" style="background:${m.color}"></span>
                <span class="macro-legend-val">${m.abbr} ${Math.round((m.kcal / total) * 100)}%</span>
            </div>
        `).join('');
    }
}

function avg(arr) {
    const valid = arr.filter(v => v > 0);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function renderProgress(p) {
    setText('pr-bas', p?.baslangicKilo ? fmt(p.baslangicKilo) : '—');
    setText('pr-mev', p?.mevcutKilo    ? fmt(p.mevcutKilo)    : '—');
    setText('pr-hedef', p?.hedefKilo   ? fmt(p.hedefKilo)     : '—');

    const y = p?.yuzde;
    const pct = y == null ? 0 : Math.max(0, Math.min(100, y));
    const fill = document.getElementById('pr-fill');
    if (fill) fill.style.width = pct + '%';
    setText('pr-yuzde', y == null ? '—' : Math.round(pct) + '%');
}

/* ============================================================
   YEMEK MODAL
   ============================================================ */
let _modalBasket = [];
/** Sepet «Kaydet» sırasında /ai çağrısı yapılırken satır dizini (yeniden oluşturmada yarış önlemek için) */
let _basketKaydetBusyIdx = null;

/**
 * Sunucu /ai/suggest-nutrition için yapılandırılmış bağlam (Groq ayrı prompt alır, OFF atlanır).
 * Taban makrolar + not: model nottaki malzemeleri (örn. 10 yumurta) taban kcal’e kilitlemeden toplar.
 */
function buildStructuredNutritionPrompt({ dishName, baseMacros, refUnitLabel, qtyMultiplier, userNote, priorAiRefined }) {
    const dn = String(dishName || '').trim() || 'Yemek';
    const ref = String(refUnitLabel || '').trim() || '—';
    const note = String(userNote || '').trim();
    const m = Number(qtyMultiplier);
    const mult = isFinite(m) && m > 0 ? m : 1;
    const bm = baseMacros || {};
    const kcal = Number(bm.birimKalori ?? bm.kcal ?? 0);
    const p = Number(bm.birimProtein ?? bm.protein ?? 0);
    const k = Number(bm.birimKarb ?? bm.karb ?? 0);
    const y = Number(bm.birimYag ?? bm.yag ?? 0);
    const safeDish = dn.replace(/"/g, '”');
    const lines = [
        `DISH: "${safeDish}"`,
        `BASE_MACROS_PER_APP_UNIT: ${Math.round(kcal * 10) / 10} kcal, P ${Math.round(p * 10) / 10}g, K ${Math.round(k * 10) / 10}g, Y ${Math.round(y * 10) / 10}g`,
        `REF_UNIT_LABEL: ${ref}`,
        `BASE_SOURCE: ${priorAiRefined ? 'prior_ai_or_user_edit (önceki Kaydet sonrası birim)' : 'database_list_row (liste satırı, çarpan 1x)'}`,
        `QTY_MULTIPLIER: ${mult}`,
        `USER_NOTE: ${note}`,
        '',
        'YORUM: BASE ile USER_NOTE çelişirse nottaki malzemelere öncelik ver. Notta "N yumurta" gibi sayı varsa bu sayıyı o malzeme için TOPLAM adet kabul et (isimde "yumurtalı" geçse bile tabanda 320 kcal gibi küçük bir değere kilitleme). BASE_SOURCE=prior ise önceki turun tahminini bileşen değişimine göre güncelle.'
    ];
    return lines.join('\n');
}

function basketBuildNutritionQuery(item, miktar, noteTrim) {
    ensureBasketDefaults(item);
    /** Her zaman liste / ilk kayıt birimini baz al; önceki AI turunun birim değerini tekrar çarpanla çarpmayı önler. */
    const baseRow = item._foodBaseline && typeof item._foodBaseline === 'object'
        ? item._foodBaseline
        : (item.food || {});
    return buildStructuredNutritionPrompt({
        dishName: item?.food?.yemekAdi,
        baseMacros: {
            birimKalori: baseRow.birimKalori,
            birimProtein: baseRow.birimProtein,
            birimKarb: baseRow.birimKarb,
            birimYag: baseRow.birimYag
        },
        refUnitLabel: (baseRow.birimMiktar || item?.food?.birimMiktar || '').trim(),
        qtyMultiplier: miktar,
        userNote: noteTrim,
        /** Baz hep liste / ilk satır; metin «önceki AI birimi» sanılmasın. */
        priorAiRefined: false
    });
}

function yemekModalSetTab(tab) {
    const panels = {
        ara: document.getElementById('yemek-panel-ara'),
        kamera: document.getElementById('yemek-panel-kamera'),
        barkod: document.getElementById('yemek-panel-barkod')
    };
    Object.entries(panels).forEach(([key, el]) => {
        if (!el) return;
        if (key === tab) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    document.querySelectorAll('.yemek-modal-tabs .yemek-tab').forEach(btn => {
        const on = btn.dataset.tab === tab;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const sonuclar = document.getElementById('modal-food-sonuclar');
    if (sonuclar && tab !== 'ara') sonuclar.classList.add('hidden');

    if (tab === 'ara') {
        setTimeout(() => document.getElementById('modal-food-arama')?.focus(), 50);
    } else if (tab === 'barkod') {
        setTimeout(() => document.getElementById('modal-barcode-input')?.focus(), 50);
    } else if (tab === 'kamera') {
        setTimeout(() => restoreModalKameraChooserIfIdle(), 0);
    }
}

function modalPhotoUiPrepareFresh() {
    _pendingModalPhotoFile = null;
    const previewImg = document.getElementById('modal-photo-preview-img');
    if (previewImg) previewImg.src = '';
    document.getElementById('modal-photo-preview')?.classList.add('hidden');
    document.getElementById('modal-photo-picker')?.classList.remove('hidden');
    const g = document.getElementById('modal-photo-gallery');
    const c = document.getElementById('modal-photo-camera');
    if (g) g.value = '';
    if (c) c.value = '';
}

/** Foto seçici yalnızca analiz/öneri panelleri kapalı ve önizlemede bekleyen dosya yoksa gösterilir. */
function restoreModalKameraChooserIfIdle() {
    const reviewPanel = document.getElementById('ai-review-panel');
    const sugPanel = document.getElementById('ai-suggest-panel');
    const reviewOpen = !!(reviewPanel && !reviewPanel.classList.contains('hidden'));
    const sugOpen = !!(sugPanel && !sugPanel.classList.contains('hidden'));
    if (reviewOpen || sugOpen || _pendingModalPhotoFile) return;
    modalPhotoUiPrepareFresh();
}

function yemekModalAc(mealTip) {
    currentMealTip = mealTip || 'KAHVALTI';
    _yemekModalReplaceEntryId = null;
    modalSelectedFood = null;
    _modalBasket = [];
    _basketKaydetBusyIdx = null;
    window._modalFoodList = [];

    const tipNames = { KAHVALTI: 'Kahvaltı ☀️', OGLE: 'Öğle 🌤️', AKSAM: 'Akşam 🌙', ARA_OGUN: 'Atıştırmalık 🍎' };
    setText('yemek-modal-sub', tipNames[currentMealTip] || currentMealTip);

    resetAiReviewPanel();
    document.getElementById('modal-food-arama').value = '';
    document.getElementById('modal-foodId').value = '';
    document.getElementById('modal-miktar').value = '1';
    const oniz = document.getElementById('modal-onizleme');
    if (oniz) oniz.innerHTML = '<span class="muted">Besin seçin ve miktar girin…</span>';
    document.getElementById('modal-sonuc').classList.add('hidden');
    const sonuclar = document.getElementById('modal-food-sonuclar');
    if (sonuclar) { sonuclar.innerHTML = ''; sonuclar.classList.add('hidden'); }
    const preview = document.getElementById('modal-food-preview');
    if (preview) preview.classList.add('hidden');
    document.getElementById('modal-add-row')?.classList.add('hidden');
    document.getElementById('modal-basket')?.classList.add('hidden');
    document.getElementById('ai-suggest-panel')?.classList.add('hidden');
    resetAiSuggestPanelCopy();
    _suggestOfferDetailOpen = false;
    const bcIn = document.getElementById('modal-barcode-input');
    if (bcIn) bcIn.value = '';
    const bcF = document.getElementById('barcode-scan-file');
    if (bcF) bcF.value = '';

    yemekModalSetTab('ara');

    document.getElementById('yemek-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-food-arama')?.focus(), 100);
}

async function modalBesinAra(q) {
    const box = document.getElementById('modal-food-sonuclar');
    if (!box) return;
    clearTimeout(_modalAraTid);
    _modalAraTid = setTimeout(async () => {
        const query = (q || '').trim();
        if (query.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }

        const list = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(query)}`).catch(() => []);
        if (!list?.length) {
            // Sonuç yok → AI'a sor butonu
            box.innerHTML = `
                <div class="autocomplete-item empty autocomplete-empty-ai">
                    <span class="ac-empty-msg">Liste dışı</span>
                    <button type="button" class="btn btn-outline btn-sm ac-empty-ai-btn" onclick='aiNutritionSuggest(${JSON.stringify(query)})'>🤖 AI ile bul</button>
                </div>`;
            box.classList.remove('hidden');
            return;
        }
        window._modalFoodList = list;
        box.innerHTML = list.slice(0, 25).map(f => `
            <div class="autocomplete-item" onclick="modalFoodSec(${f.id})">
                <div class="ac-name">${escHtml(f.yemekAdi)}</div>
                <div class="ac-info">
                    <div class="ac-kcal">${f.birimKalori ?? 0} kcal</div>
                    <div class="ac-unit">${escHtml(f.birimMiktar ?? '')}</div>
                </div>
            </div>
        `).join('');
        box.classList.remove('hidden');
    }, 200);
}

async function modalFoodSec(foodId) {
    const list = window._modalFoodList || [];
    modalSelectedFood = list.find(x => x.id === foodId) || null;
    if (!modalSelectedFood) return;

    document.getElementById('modal-foodId').value = String(foodId || '');
    document.getElementById('modal-food-arama').value = '';
    const box = document.getElementById('modal-food-sonuclar');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }

    _modalBasket.push({ food: { ...modalSelectedFood }, miktar: 1, not: '', _editOpen: false });
    renderBasket();

    document.getElementById('modal-food-preview')?.classList.add('hidden');
    document.getElementById('modal-add-row')?.classList.add('hidden');
    const oniz = document.getElementById('modal-onizleme');
    if (oniz) oniz.innerHTML = `<span class="muted">${escHtml(modalSelectedFood.yemekAdi)} sepete eklendi. Başka yemek seçebilirsin.</span>`;
    modalSelectedFood = null;
}

function modalOnizlemeGuncelle() {
    const oniz = document.getElementById('modal-onizleme');
    const miktar = parseFloat(document.getElementById('modal-miktar')?.value || '1');
    if (!oniz) return;

    if (!modalSelectedFood) { oniz.innerHTML = '<span class="muted">Besin seçin ve miktar girin…</span>'; return; }

    const m = isFinite(miktar) && miktar > 0 ? miktar : 1;
    const kcal = Math.round((modalSelectedFood.birimKalori ?? 0) * m * 10) / 10;
    const p    = Math.round((modalSelectedFood.birimProtein ?? 0) * m * 10) / 10;
    const k    = Math.round((modalSelectedFood.birimKarb ?? 0) * m * 10) / 10;
    const y    = Math.round((modalSelectedFood.birimYag ?? 0) * m * 10) / 10;

    oniz.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
            <span style="font-size:18px;font-weight:800;color:var(--green-dk)">${kcal} kcal</span>
            <span style="color:var(--blue);font-weight:600">P: ${p}g</span>
            <span style="color:var(--orange);font-weight:600">K: ${k}g</span>
            <span style="color:var(--purple);font-weight:600">Y: ${y}g</span>
        </div>`;
}

function modalSepeteEkle() {
    if (!modalSelectedFood) return;
    const miktar = parseFloat(document.getElementById('modal-miktar')?.value || '1');
    if (!isFinite(miktar) || miktar <= 0) { showToast('Geçerli miktar girin.', 'error'); return; }

    _modalBasket.push({ food: { ...modalSelectedFood }, miktar, not: '', _editOpen: false });
    renderBasket();

    // Arama alanını temizle
    modalSelectedFood = null;
    document.getElementById('modal-food-arama').value = '';
    document.getElementById('modal-foodId').value = '';
    document.getElementById('modal-food-preview')?.classList.add('hidden');
    document.getElementById('modal-add-row')?.classList.add('hidden');
    const oniz = document.getElementById('modal-onizleme');
    if (oniz) oniz.innerHTML = '<span class="muted">Başka besin ekleyebilirsiniz…</span>';
    showToast(`${_modalBasket[_modalBasket.length-1].food.yemekAdi} sepete eklendi`, 'success');
}

function ensureBasketDefaults(item) {
    if (!item || typeof item !== 'object') return;
    if (typeof item.not !== 'string') item.not = '';
    if (typeof item._editOpen !== 'boolean') item._editOpen = false;
    if (typeof item._makroOzellesti !== 'boolean') item._makroOzellesti = false;
    if (item._foodBaseline == null && item.food && typeof item.food === 'object') {
        item._foodBaseline = { ...item.food };
    }
}

function renderBasket() {
    const basketEl = document.getElementById('modal-basket');
    const itemsEl  = document.getElementById('basket-items');
    const summaryRow = document.getElementById('basket-summary-row');
    const countEl  = document.getElementById('basket-count');
    if (!basketEl || !itemsEl) return;

    if (!_modalBasket.length) {
        basketEl.classList.add('hidden');
        itemsEl.innerHTML = '';
        if (summaryRow) summaryRow.innerHTML = '';
        return;
    }
    basketEl.classList.remove('hidden');
    if (countEl) countEl.textContent = _modalBasket.length + ' öğe';

    _modalBasket.forEach(ensureBasketDefaults);

    const totals = { kcal: 0, p: 0, k: 0, y: 0 };
    const itemsHtml = _modalBasket.map((item, idx) => {
        const kcal = Math.round((item.food.birimKalori ?? 0) * item.miktar * 10) / 10;
        const p = Math.round((item.food.birimProtein ?? 0) * item.miktar * 10) / 10;
        const k = Math.round((item.food.birimKarb ?? 0) * item.miktar * 10) / 10;
        const y = Math.round((item.food.birimYag ?? 0) * item.miktar * 10) / 10;
        totals.kcal += kcal; totals.p += p; totals.k += k; totals.y += y;
        const birimEtiket = (item.food.birimMiktar || 'birim').replace(/[<>"']/g, '');
        const noteShort = item.not ? escHtml(item.not) : '';
        const saving = _basketKaydetBusyIdx === idx;
        const panelHtml = item._editOpen ? `
            <div class="basket-edit-panel">
                <div class="basket-edit-compact basket-edit-note-only">
                    <textarea id="basket-note-${idx}" class="basket-note-input" maxlength="600" rows="3"
                        ${saving ? 'disabled' : ''} aria-label="Porsiyon notu"
                        placeholder="Yapılış (ör. 10 yumurta, dürüm…). Not varsa Kaydet ile makroları günceller."></textarea>
                </div>
                <p class="basket-edit-ai-hint">Not doluysa Kaydet, metne göre makrolar yeniden hesaplanır. Not boşsa liste değerleri kullanılır.</p>
                <div class="basket-edit-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="basketToggleDetay(${idx})" ${saving ? 'disabled' : ''}>Vazgeç</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="basketKaydetSatir(${idx})" ${saving ? 'disabled' : ''}>${saving ? 'Hesaplanıyor…' : 'Kaydet'}</button>
                </div>
            </div>` : '';
        return `
        <div class="basket-item-shell ${item._editOpen ? 'basket-open' : ''}">
            <div class="basket-item-row-inner">
                <div class="basket-row-text">
                    <div class="basket-item-head-row">
                        <div class="basket-item-head">
                            <span class="basket-item-name">${escHtml(item.food.yemekAdi)}</span>
                            <span class="basket-miktar-pill" title="${escHtml(birimEtiket)}">
                                <input type="number" id="basket-miktar-${idx}" class="basket-miktar-pill-input" min="0.1" step="0.1"
                                    ${saving ? 'disabled' : ''} aria-label="Miktar çarpanı" value="${item.miktar}">
                                <span class="basket-miktar-suffix">×</span>
                            </span>
                        </div>
                        <div class="basket-head-actions">
                            <button type="button" class="btn-basket-porsiyon" onclick="basketToggleDetay(${idx})" title="Miktar ve açıklama">
                                ${item._editOpen ? 'Kapat' : 'Porsiyon & Detay'}
                            </button>
                            <button type="button" class="basket-item-del" onclick="basketSil(${idx})" aria-label="Sil">×</button>
                        </div>
                    </div>
                    ${noteShort ? `<div class="basket-item-note-preview">${noteShort}</div>` : ''}
                    <div class="basket-item-detail">
                        <span class="basket-item-macros">${kcal} kcal</span>
                        <span class="p">P ${p}g</span>
                        <span class="k">K ${k}g</span>
                        <span class="y">Y ${y}g</span>
                    </div>
                </div>
            </div>
            ${panelHtml}
        </div>`;
    }).join('');
    itemsEl.innerHTML = itemsHtml;
    if (summaryRow) {
        summaryRow.innerHTML = `
        <div class="basket-summary">
            <span class="basket-summary-kcal">Toplam: ${Math.round(totals.kcal * 10) / 10} kcal</span>
            <span class="basket-summary-macros">
                <span class="p">P ${Math.round(totals.p * 10) / 10}g</span>
                <span class="k">K ${Math.round(totals.k * 10) / 10}g</span>
                <span class="y">Y ${Math.round(totals.y * 10) / 10}g</span>
            </span>
        </div>`;
    }
    _modalBasket.forEach((it, idx) => {
        if (!it._editOpen) return;
        const ta = document.getElementById(`basket-note-${idx}`);
        if (ta) ta.value = it.not || '';
    });
}

function basketToggleDetay(idx) {
    const item = _modalBasket[idx];
    if (!item) return;
    const willOpen = !item._editOpen;
    _modalBasket.forEach((x, i) => { x._editOpen = willOpen && i === idx; });
    renderBasket();
}

async function basketKaydetSatir(idx) {
    const item = _modalBasket[idx];
    if (!item || _basketKaydetBusyIdx !== null) return;
    const mEl = document.getElementById(`basket-miktar-${idx}`);
    const nEl = document.getElementById(`basket-note-${idx}`);
    const m = parseFloat(mEl?.value ?? item.miktar);
    const note = (nEl?.value || '').trim();
    if (!isFinite(m) || m <= 0) {
        showToast('Geçerli bir miktar girin (en az 0,1).', 'warning');
        return;
    }
    const miktarRounded = Math.round(m * 1000) / 1000;
    ensureBasketDefaults(item);

    if (!note) {
        if (item._foodBaseline && typeof item._foodBaseline === 'object') {
            item.food = { ...item._foodBaseline };
        }
        item.miktar = miktarRounded;
        item.not = '';
        item._makroOzellesti = false;
        item._editOpen = false;
        renderBasket();
        return;
    }

    item.miktar = miktarRounded;
    item.not = note;

    _basketKaydetBusyIdx = idx;
    renderBasket();
    try {
        const foodName = basketBuildNutritionQuery(item, miktarRounded, note);
        const ai = await apiFetch('/ai/suggest-nutrition', {
            method: 'POST',
            body: JSON.stringify({ foodName })
        });
        const kcal = Number(ai.kcal) || 0;
        const pr = Number(ai.protein) || 0;
        const kr = Number(ai.karb) || 0;
        const yg = Number(ai.yag) || 0;
        item.food = item.food && typeof item.food === 'object' ? item.food : {};
        item.food.birimKalori = Math.max(0, Math.round(kcal));
        item.food.birimProtein = Math.round(pr * 100) / 100;
        item.food.birimKarb = Math.round(kr * 100) / 100;
        item.food.birimYag = Math.round(yg * 100) / 100;
        item._makroOzellesti = true;
        item._editOpen = false;
        showToast('Makrolar notunuza göre güncellendi.', 'success');
    } catch (e) {
        item._makroOzellesti = false;
        if (item._foodBaseline && typeof item._foodBaseline === 'object') {
            item.food = { ...item._foodBaseline };
        }
        showToast('AI hesaplama başarısız: ' + (e.message || e), 'error');
    } finally {
        _basketKaydetBusyIdx = null;
        renderBasket();
    }
}

function basketSil(idx) {
    _modalBasket.splice(idx, 1);
    renderBasket();
}

function resetAiSuggestPanelCopy() {
    const t = document.getElementById('ai-suggest-panel-title');
    const s = document.getElementById('ai-suggest-panel-sub');
    if (t) t.textContent = '🔍 Ara';
}

function syncSuggestFormToRow() {
    const row = _aiReviewItems[0];
    if (!row) return;
    const n = document.getElementById('ai-suggest-name');
    if (n) row.ad = (n.value || '').trim();

    const num = id => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = parseFloat(el.value);
        return isFinite(v) ? Math.max(0, v) : null;
    };
    let hit = num('ai-suggest-kcal');
    if (hit !== null) row.kcal = hit;
    hit = num('ai-suggest-protein');
    if (hit !== null) row.protein = hit;
    hit = num('ai-suggest-karb');
    if (hit !== null) row.karb = hit;
    hit = num('ai-suggest-yag');
    if (hit !== null) row.yag = hit;

    const det = document.getElementById('ai-suggest-detail');
    if (det && typeof det.value === 'string') row._porsiyonDetay = det.value;

    const mEl = document.getElementById('ai-suggest-miktar');
    if (mEl) {
        const m = parseFloat(mEl.value);
        if (isFinite(m) && m > 0) row._suggestMiktar = Math.round(m * 1000) / 1000;
    }
}

/** Barkod / liste dışı: kamera AI satırı ile aynı üst şerit (Düzenle, +, Porsiyon & Detay, sil). */
function renderEditableSuggestHtml({ ad, kcal, protein, karb, yag }) {
    const kcalD = Number(kcal) || 0;
    const prD = Number(protein) || 0;
    const krD = Number(karb) || 0;
    const ygD = Number(yag) || 0;
    const safeName = escHtml(ad || '');
    const rk = Math.round(kcalD * 10) / 10;
    const rp = Math.round(prD * 10) / 10;
    const rkr = Math.round(krD * 10) / 10;
    const ry = Math.round(ygD * 10) / 10;

    const row = _aiReviewItems[0] || {};
    const editing = !!row._editingSuggestName;
    const rawDet = typeof row._porsiyonDetay === 'string' ? row._porsiyonDetay.trim() : '';
    const notePreview = rawDet && !_suggestOfferDetailOpen
        ? `<div class="ai-review-note-preview">${escHtml(rawDet)}</div>`
        : '';

    const portionBtn = _suggestOfferDetailOpen
        ? `<button type="button" class="btn-basket-porsiyon" onclick="toggleSuggestOfferDetail(false)">Kapat</button>`
        : `<button type="button" class="btn-basket-porsiyon" onclick="toggleSuggestOfferDetail(true)">Porsiyon &amp; Detay</button>`;

    const expandedHtml = _suggestOfferDetailOpen ? `
            <div id="suggest-offer-totals" class="basket-summary suggest-offer-live-totals"></div>
            <div class="basket-edit-panel suggest-offer-notes">
                <div class="basket-edit-compact">
                    <textarea id="ai-suggest-detail" class="basket-note-input suggest-offer-detail-ta" maxlength="900" rows="3"
                        placeholder="Yapılış (ör. yarım şişe, 250 ml, 10 yumurta…). Not doluysa Kaydet ile makroları hesaplat."></textarea>
                </div>
                <p class="basket-edit-ai-hint">Not doluysa <b>Kaydet</b> ile makrolar metne göre yeniden hesaplanır (boşsa yukarıdaki liste birimi korunur).</p>
                <div class="basket-edit-actions suggest-offer-ai-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleSuggestOfferDetail(false)">Vazgeç</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="aiSuggestRecalcWithDetail()">Kaydet</button>
                </div>
            </div>` : '';

    const macroInputsExpand = `
                <span class="suggest-macro-slot">
                    <span class="suggest-macro-lbl">kcal <span class="suggest-per-unit-hint">(liste)</span></span>
                    <input type="number" id="ai-suggest-kcal" class="suggest-macro-inp" min="0" step="0.1" value="${kcalD}"
                        oninput="updateSuggestOfferTotals()" aria-label="Kalori liste birimi">
                </span>
                <span class="suggest-macro-slot suggest-macro-slot--p">
                    <span class="suggest-macro-lbl p">P (g)</span>
                    <input type="number" id="ai-suggest-protein" class="suggest-macro-inp" min="0" step="0.1" value="${prD}"
                        oninput="updateSuggestOfferTotals()" aria-label="Protein liste birimi">
                </span>
                <span class="suggest-macro-slot suggest-macro-slot--k">
                    <span class="suggest-macro-lbl k">K (g)</span>
                    <input type="number" id="ai-suggest-karb" class="suggest-macro-inp" min="0" step="0.1" value="${krD}"
                        oninput="updateSuggestOfferTotals()" aria-label="Karbonhidrat liste birimi">
                </span>
                <span class="suggest-macro-slot suggest-macro-slot--y">
                    <span class="suggest-macro-lbl y">Y (g)</span>
                    <input type="number" id="ai-suggest-yag" class="suggest-macro-inp" min="0" step="0.1" value="${ygD}"
                        oninput="updateSuggestOfferTotals()" aria-label="Yağ liste birimi">
                </span>`;

    const macroCollapsed = !_suggestOfferDetailOpen ? `
            <div class="ai-review-macro-pills">
                <span class="ai-pill kcal">${rk} kcal</span>
                <span class="ai-pill p">P ${rp}g</span>
                <span class="ai-pill k">K ${rkr}g</span>
                <span class="ai-pill y">Y ${ry}g</span>
            </div>
            <div class="ai-edit-macros ${editing ? '' : 'hidden'}">
                <label>Kcal <input type="number" step="0.1" value="${rk}" oninput="suggestOfferMacroField('kcal', this.value)"></label>
                <label>P <input type="number" step="0.1" value="${rp}" oninput="suggestOfferMacroField('protein', this.value)"></label>
                <label>K <input type="number" step="0.1" value="${rkr}" oninput="suggestOfferMacroField('karb', this.value)"></label>
                <label>Y <input type="number" step="0.1" value="${ry}" oninput="suggestOfferMacroField('yag', this.value)"></label>
            </div>` : `
            <div class="basket-item-detail suggest-offer-macros suggest-offer-macros-expand">${macroInputsExpand}</div>`;

    return `
<div class="suggest-offer-wrap">
    <div class="ai-review-item ${_suggestOfferDetailOpen ? 'ai-review-item--open' : ''} suggest-offer-card" id="suggest-offer-card">
        <div class="ai-review-item-head-row">
            <div class="ai-review-item-header">
                <input type="text" id="ai-suggest-name" class="ai-name-field" value="${safeName}" ${editing ? '' : 'readonly'}
                    placeholder="Besin veya paket adı" autocomplete="off" spellcheck="false">
                <div class="ai-header-btns">
                    <button type="button" class="ai-item-edit-btn" onclick="suggestOfferToggleEdit()" title="İsim veya makro düzenle">${editing ? 'Uygula' : 'Düzenle'}</button>
                    <button type="button" class="ai-item-add-btn" onclick="suggestOfferPlusHint()" title="Başka ürün">+</button>
                </div>
            </div>
            <div class="ai-review-head-actions">
                ${portionBtn}
                <button type="button" class="ai-item-del-btn" onclick="suggestOfferSil()" title="Sil">×</button>
            </div>
        </div>
        ${macroCollapsed}
        ${notePreview}
        ${expandedHtml}
    </div>
    <div class="suggest-offer-sepet">
        <button type="button" class="btn btn-primary btn-full" onclick="aiSuggestEkle()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Sepete Ekle
        </button>
    </div>
</div>`;
}

function toggleSuggestOfferDetail(goOpen) {
    syncSuggestFormToRow();
    const row = _aiReviewItems[0];
    if (goOpen === true) {
        if (row) row._editingSuggestName = false;
        _suggestOfferDetailOpen = true;
    } else if (goOpen === false) {
        _suggestOfferDetailOpen = false;
    }
    refreshAiSuggestOfferCard();
}

function suggestOfferToggleEdit() {
    const row = _aiReviewItems[0];
    if (!row) return;
    if (!row._editingSuggestName) {
        _suggestOfferDetailOpen = false;
        row._editingSuggestName = true;
        refreshAiSuggestOfferCard();
        setTimeout(() => document.getElementById('ai-suggest-name')?.focus(), 40);
        return;
    }
    syncSuggestFormToRow();
    row._editingSuggestName = false;
    refreshAiSuggestOfferCard();
}

function suggestOfferMacroField(field, value) {
    const row = _aiReviewItems[0];
    if (!row) return;
    const n = parseFloat(value);
    row[field] = isFinite(n) ? Math.max(0, n) : 0;
}

function suggestOfferPlusHint() {
    showToast('Başka ürün için barkodu değiştirip «Bul» kullan veya Ara sekmesinden ekle.', 'info');
}

function suggestOfferSil() {
    _aiReviewItems = [];
    _suggestOfferDetailOpen = false;
    const itemsEl = document.getElementById('ai-suggest-items');
    if (itemsEl) itemsEl.innerHTML = '';
    document.getElementById('ai-suggest-panel')?.classList.add('hidden');
    restoreModalKameraChooserIfIdle();
}

function refreshAiSuggestOfferCard() {
    const row = _aiReviewItems[0];
    const itemsEl = document.getElementById('ai-suggest-items');
    if (!row || !itemsEl) return;
    itemsEl.innerHTML = renderEditableSuggestHtml({
        ad: row.ad,
        kcal: row.kcal,
        protein: row.protein,
        karb: row.karb,
        yag: row.yag
    });
    const det = document.getElementById('ai-suggest-detail');
    if (det && typeof row._porsiyonDetay === 'string') det.value = row._porsiyonDetay;
    updateSuggestOfferTotals();
}

function updateSuggestOfferTotals() {
    const wrap = document.getElementById('suggest-offer-totals');
    if (!wrap) return;
    const m = Math.max(0.1, parseFloat(document.getElementById('ai-suggest-miktar')?.value) || ((_aiReviewItems[0] || {})._suggestMiktar) || 1);
    const kcal = (parseFloat(document.getElementById('ai-suggest-kcal')?.value) || 0) * m;
    const p = (parseFloat(document.getElementById('ai-suggest-protein')?.value) || 0) * m;
    const k = (parseFloat(document.getElementById('ai-suggest-karb')?.value) || 0) * m;
    const y = (parseFloat(document.getElementById('ai-suggest-yag')?.value) || 0) * m;
    const rk = Math.round(kcal * 10) / 10;
    const rp = Math.round(p * 10) / 10;
    const rkr = Math.round(k * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    wrap.innerHTML = `
        <span class="basket-summary-kcal">Tahmini toplam: <strong>${rk}</strong> kcal</span>
        <span class="basket-summary-macros suggest-offer-tot-macros">
            <span class="p">P ${rp}g</span>
            <span class="k">K ${rkr}g</span>
            <span class="y">Y ${ry}g</span>
        </span>`;
}

// AI öneri: DB'de yoksa Groq / sunucu önerisi
async function aiNutritionSuggest(foodName) {
    yemekModalSetTab('ara');

    const box = document.getElementById('modal-food-sonuclar');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }

    const panel   = document.getElementById('ai-suggest-panel');
    const loading = document.getElementById('ai-suggest-loading');
    const itemsEl = document.getElementById('ai-suggest-items');

    resetAiSuggestPanelCopy();
    panel.classList.remove('hidden');
    _suggestOfferDetailOpen = false;
    loading.classList.remove('hidden');
    itemsEl.innerHTML = '';

    try {
        const dbList = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(foodName)}`).catch(() => []);
        if (dbList?.length) {
            loading.classList.add('hidden');
            itemsEl.innerHTML = `
                <div class="autocomplete-results" style="position:static;max-height:260px">
                    ${dbList.slice(0, 8).map(f => `
                        <div class="autocomplete-item" onclick="aiSuggestDbEkle(${f.id}, '${escHtml(f.yemekAdi)}')">
                            <div class="ac-name">${escHtml(f.yemekAdi)}</div>
                            <div class="ac-info">
                                <div class="ac-kcal">${f.birimKalori ?? 0} kcal</div>
                                <div class="ac-unit">${escHtml(f.birimMiktar ?? '')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
            return;
        }

        const res = await apiFetch('/ai/suggest-nutrition', {
            method: 'POST',
            body: JSON.stringify({ foodName })
        });
        loading.classList.add('hidden');

        const g = Number(res.gram);
        _aiReviewItems = [{
            ...res,
            _id: 0,
            gram: isFinite(g) && g > 0 ? g : 100,
            birimMiktarLabel: undefined,
            _porsiyonDetay: '',
            _suggestMiktar: 1,
            _editingSuggestName: false
        }];
        _suggestOfferDetailOpen = false;
        refreshAiSuggestOfferCard();
    } catch (err) {
        loading.classList.add('hidden');
        itemsEl.innerHTML = `<p style="color:var(--red);font-size:13px">❌ ${err.message}</p>`;
    }
}

/** AI öneri kartı (besin ara / barkod) — porsiyon notu ile yeniden hesaplama */
async function aiSuggestRecalcWithDetail() {
    const nameEl = document.getElementById('ai-suggest-name');
    const detEl = document.getElementById('ai-suggest-detail');
    const name = (nameEl?.value || '').trim();
    const det = (detEl?.value || '').trim();
    if (!name) {
        showToast('Önce ürün adını yazın.', 'warning');
        return;
    }
    try {
        const kcal0 = Number(document.getElementById('ai-suggest-kcal')?.value || 0);
        const pr0 = Number(document.getElementById('ai-suggest-protein')?.value || 0);
        const kr0 = Number(document.getElementById('ai-suggest-karb')?.value || 0);
        const yg0 = Number(document.getElementById('ai-suggest-yag')?.value || 0);
        const q = det
            ? buildStructuredNutritionPrompt({
                dishName: name,
                baseMacros: {
                    birimKalori: kcal0,
                    birimProtein: pr0,
                    birimKarb: kr0,
                    birimYag: yg0
                },
                refUnitLabel: 'AI / düzenlenen 1 porsiyon',
                qtyMultiplier: 1,
                userNote: det,
                priorAiRefined: true
            })
            : name;
        const ai = await apiFetch('/ai/suggest-nutrition', {
            method: 'POST',
            body: JSON.stringify({ foodName: q })
        });
        const kcal = Number(ai.kcal || 0);
        const pr = Number(ai.protein || 0);
        const kr = Number(ai.karb || 0);
        const yg = Number(ai.yag || 0);
        const kEl = document.getElementById('ai-suggest-kcal');
        const pEl = document.getElementById('ai-suggest-protein');
        const karbEl = document.getElementById('ai-suggest-karb');
        const yEl = document.getElementById('ai-suggest-yag');
        if (kEl) kEl.value = kcal;
        if (pEl) pEl.value = pr;
        if (karbEl) karbEl.value = kr;
        if (yEl) yEl.value = yg;
        if (nameEl && ai.ad) nameEl.value = ai.ad;
        const row = _aiReviewItems[0];
        if (row) {
            row.ad = ai.ad || name;
            row.kcal = kcal;
            row.protein = pr;
            row.karb = kr;
            row.yag = yg;
            row.gram = Number(ai.gram || 100);
            row._porsiyonDetay = det;
        }
        _suggestOfferDetailOpen = false;
        refreshAiSuggestOfferCard();
        showToast('Makrolar notunuza göre güncellendi — gerekirse elle düzeltin.', 'success');
    } catch (e) {
        showToast('AI hesaplama başarısız: ' + (e.message || e), 'error');
    }
}

async function modalBarcodeBul() {
    const raw = document.getElementById('modal-barcode-input')?.value || '';
    const code = raw.replace(/\D/g, '');
    if (code.length < 8 || code.length > 14) {
        showToast('Geçerli barkod girin (8–14 rakam).', 'warning');
        return;
    }

    document.getElementById('modal-food-sonuclar')?.classList.add('hidden');
    document.getElementById('ai-review-panel')?.classList.add('hidden');

    const panel = document.getElementById('ai-suggest-panel');
    const loading = document.getElementById('ai-suggest-loading');
    const itemsEl = document.getElementById('ai-suggest-items');
    if (!panel || !loading || !itemsEl) return;

    _suggestOfferDetailOpen = false;
    setText('ai-suggest-panel-title', '📦 Barkod');
    setText('ai-suggest-panel-sub', 'Open Facts ailesi (gıda / kozmetik / pet) + gerekirse AI');

    panel.classList.remove('hidden');
    loading.classList.remove('hidden');
    itemsEl.innerHTML = '';

    try {
        const data = await apiFetch(`/foods/barcode/${encodeURIComponent(code)}`);
        loading.classList.add('hidden');

        const birim = data.birimAciklama || '100 g';
        const ad = data.urunAdi || (`Ürün ${data.barkod || code}`);
        const mkSrc = data.makroKaynagi || '';

        if (mkSrc === 'AI_TAHMIN') {
            const baseSrc = data.kaynak || 'Veritabanı';
            const subTxt = baseSrc.includes('Yapay zeka tahmini')
                ? 'Kayıtta yok veya eksik makro · tamamen yapay zeka tahmini (etiketi kontrol edin)'
                : `${baseSrc} · makrolar yapay zeka ile tamamlandı (etiketi kontrol edin)`;
            setText('ai-suggest-panel-sub', subTxt);
            if (data.uyari) showToast(data.uyari, 'warning');
        } else {
            const kn = data.kaynak || 'Open Facts';
            setText('ai-suggest-panel-sub', `${kn} — ${birim} başına`);
        }

        _aiReviewItems = [{
            ad,
            kcal: data.kcal,
            protein: data.protein,
            karb: data.karb,
            yag: data.yag,
            gram: 100,
            _id: 0,
            birimMiktarLabel: `${birim} — ${data.barkod || code}` + (mkSrc === 'AI_TAHMIN' ? ' · AI' : ' · OFF'),
            _porsiyonDetay: '',
            _suggestMiktar: 1,
            _editingSuggestName: false
        }];
        _suggestOfferDetailOpen = false;
        refreshAiSuggestOfferCard();
    } catch (err) {
        loading.classList.add('hidden');
        itemsEl.innerHTML = `<p style="color:var(--red);font-size:13px">❌ ${escHtml(err.message || 'Barkod hatası')}</p>`;
    }
}

async function decodeBarcodeZXingFallback(file) {
    try {
        const mod = await import('https://esm.sh/@zxing/browser@0.1.5');
        const Reader = mod.BrowserMultiFormatReader;
        if (!Reader) return '';
        const reader = new Reader();
        const url = URL.createObjectURL(file);
        try {
            const result = await reader.decodeFromImageUrl(url);
            return result?.getText ? result.getText() : String(result?.text || '');
        } finally {
            URL.revokeObjectURL(url);
        }
    } catch (_e) {
        return '';
    }
}

async function modalBarcodeFromImage(input) {
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;

    let rawText = '';

    try {
        if ('BarcodeDetector' in window && typeof BarcodeDetector === 'function') {
            try {
                const bmp = await createImageBitmap(file);
                try {
                    const detector = new BarcodeDetector({
                        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
                    });
                    const codes = await detector.detect(bmp);
                    if (codes?.length) rawText = String(codes[0].rawValue || '');
                } finally {
                    if (bmp && bmp.close) bmp.close();
                }
            } catch (_bdErr) {
                rawText = '';
            }
        }

        if (!rawText) {
            rawText = await decodeBarcodeZXingFallback(file);
        }

        const digits = String(rawText || '').replace(/\D/g, '');
        if (!digits || digits.length < 8 || digits.length > 14) {
            showToast('Fotoğrafta barkod okunamadı. Daha net/yakından çekin veya rakamları elle girin.', 'warning');
            return;
        }

        const box = document.getElementById('modal-barcode-input');
        if (box) box.value = digits;
        await modalBarcodeBul();
    } catch (e) {
        showToast(`Barkod okunamadı: ${e?.message || e}`, 'error');
    }
}

async function aiSuggestDbEkle(foodId, foodName) {
    try {
        const all = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(foodName)}`).catch(() => []);
        const food = all.find(x => x.id === foodId);
        if (!food) throw new Error('Besin bulunamadı');
        _modalBasket.push({ food, miktar: 1, not: '', _editOpen: false });
        renderBasket();
        document.getElementById('ai-suggest-panel')?.classList.add('hidden');
        showToast(`${food.yemekAdi} sepete eklendi`, 'success');
    } catch (err) {
        showToast('Sepete eklenemedi: ' + err.message, 'error');
    }
}

function _readAiSuggestForm() {
    syncSuggestFormToRow();
    const base = _aiReviewItems[0] || {};
    const nameEl = document.getElementById('ai-suggest-name');
    const ad = ((nameEl?.value ?? base.ad ?? '') || '').trim();
    const gramRaw = Number(base.gram);
    const gram = isFinite(gramRaw) && gramRaw > 0 ? gramRaw : 100;
    return {
        ad,
        gram,
        kcal: Number(base.kcal) || 0,
        protein: Number(base.protein) || 0,
        karb: Number(base.karb) || 0,
        yag: Number(base.yag) || 0
    };
}

async function aiSuggestEkle() {
    const item = _aiReviewItems[0];
    if (!item) return;

    let payload;
    const nameEl = document.getElementById('ai-suggest-name');
    if (nameEl) {
        payload = _readAiSuggestForm();
        if (!payload.ad) {
            showToast('Besin adı boş olamaz.', 'warning');
            return;
        }
    } else {
        payload = {
            ad: item.ad,
            gram: item.gram || 100,
            kcal: Number(item.kcal) || 0,
            protein: Number(item.protein) || 0,
            karb: Number(item.karb) || 0,
            yag: Number(item.yag) || 0
        };
    }

    const birimMiktar = item.birimMiktarLabel
        ? item.birimMiktarLabel
        : `${Math.round(payload.gram)}g porsiyon`;

    const miktar = Math.max(0.1, Math.round((item._suggestMiktar ?? 1) * 1000) / 1000);
    const notStr = String(item._porsiyonDetay || '').trim();

    try {
        const newFood = await apiFetch('/foods', {
            method: 'POST',
            body: JSON.stringify({
                yemekAdi: payload.ad,
                birimMiktar,
                birimKalori: Math.round(Number(payload.kcal) || 0),
                birimProtein: payload.protein,
                birimKarb: payload.karb,
                birimYag: payload.yag
            })
        });
        _modalBasket.push({ food: newFood, miktar, not: notStr, _editOpen: false });
        renderBasket();
        _suggestOfferDetailOpen = false;
        document.getElementById('ai-suggest-panel')?.classList.add('hidden');
        showToast(`${payload.ad} sepete eklendi`, 'success');
    } catch (err) {
        showToast('Sepete eklenemedi: ' + (err.message || err), 'error');
    }
}

async function modalOnayla() {
    const sonuc = document.getElementById('modal-sonuc');
    if (sonuc) sonuc.classList.add('hidden');

    if (!_modalBasket.length) {
        if (sonuc) { sonuc.textContent = '❌ Sepet boş. Lütfen besin seçin.'; sonuc.classList.remove('hidden'); }
        return;
    }

    const log = await getOrCreateLogByDate(selectedDate);
    if (!log?.id) { if (sonuc) { sonuc.textContent = '❌ Günlük log oluşturulamadı.'; sonuc.classList.remove('hidden'); } return; }

    const btn = document.getElementById('modal-onayla-btn');
    if (btn) setLoading(btn, true);

    const replaceEntryId = _yemekModalReplaceEntryId;
    if (replaceEntryId && _modalBasket.length !== 1) {
        if (btn) setLoading(btn, false);
        if (sonuc) {
            sonuc.textContent = '❌ Günlük düzenlemesi yalnızca tek satır sepet ile yapılabilir.';
            sonuc.classList.remove('hidden');
        }
        return;
    }
    if (replaceEntryId) _yemekModalReplaceEntryId = null;

    let eklenen = 0;
    if (replaceEntryId) {
        try {
            await apiFetch(`/food-entries/${replaceEntryId}`, { method: 'DELETE' });
        } catch (err) {
            if (btn) setLoading(btn, false);
            _yemekModalReplaceEntryId = replaceEntryId;
            showToast('Kayıt güncellenemedi (silme): ' + err.message, 'error');
            return;
        }
    }

    for (const item of _modalBasket) {
        try {
            ensureBasketDefaults(item);
            const body = { dailyLogId: log.id, foodId: item.food.id, miktar: item.miktar, ogunTipi: currentMealTip };
            if (item.not && String(item.not).trim()) body.aciklama = String(item.not).trim();
            if (item._makroOzellesti) {
                body.ozellestirilenBirimKalori = Number(item.food.birimKalori);
                body.ozellestirilenBirimProtein = Number(item.food.birimProtein) || 0;
                body.ozellestirilenBirimKarb = Number(item.food.birimKarb) || 0;
                body.ozellestirilenBirimYag = Number(item.food.birimYag) || 0;
            }
            await apiFetch('/food-entries', { method: 'POST', body: JSON.stringify(body) });
            eklenen++;
        } catch (err) {
            showToast(`"${item.food.yemekAdi}" eklenemedi: ${err.message}`, 'error');
        }
    }

    if (btn) setLoading(btn, false);
    if (eklenen > 0) {
        showToast(`${eklenen} yemek öğüne eklendi 🍽️`, 'success');
        closeModal('yemek-modal');
        await loadDashboard();
    }
}

/* ============================================================
   YEMEK SİL
   ============================================================ */
async function yemekSil(entryId) {
    const entry = lastEntriesCache.find(e => e.id === entryId);
    const name = entry?.yemekAdi || 'Bu yemek';

    document.getElementById('confirm-food-name').textContent = name;
    document.getElementById('confirm-modal').classList.remove('hidden');

    deleteConfirmCallback = async () => {
        closeModal('confirm-modal');
        try {
            await apiFetch(`/food-entries/${entryId}`, { method: 'DELETE' });
            if (selectedEntry?.id === entryId) { selectedEntry = null; renderSelectedEntry(null); }
            showToast('Yemek silindi.', 'success');
            await loadDashboard();
        } catch (err) {
            showToast('Silme hatası: ' + err.message, 'error');
        }
    };

    document.getElementById('confirm-delete-btn').onclick = deleteConfirmCallback;
}

/* ============================================================
   YEMEK DÜZENLE
   ============================================================ */
function duzenleModalAc(entryId) {
    const entry = lastEntriesCache.find(e => e.id === entryId);
    if (!entry) return;

    duzenlenecekEntryId = entryId;
    setText('duzenle-yemek-adi', entry.yemekAdi ?? ('Besin #' + entry.foodId));
    const miktarEl = document.getElementById('duzenle-miktar');
    if (miktarEl) miktarEl.value = entry.miktar || 1;
    document.getElementById('duzenle-sonuc').classList.add('hidden');
    document.getElementById('duzenle-preview').textContent = '';

    duzenleOnizlemeGuncelle(entry);
    document.getElementById('duzenle-modal').classList.remove('hidden');
}

function duzenleOnizlemeGuncelle(baseEntry) {
    const miktarEl = document.getElementById('duzenle-miktar');
    const previewEl = document.getElementById('duzenle-preview');
    if (!miktarEl || !previewEl || !baseEntry) return;

    const miktar = parseFloat(miktarEl.value || '1');
    if (!isFinite(miktar) || miktar <= 0) return;

    const entry = lastEntriesCache.find(e => e.id === duzenlenecekEntryId);
    if (!entry) return;

    const ratio = miktar / (entry.miktar || 1);
    const kcal = Math.round((entry.toplamKalori ?? 0) * ratio);
    previewEl.textContent = `Tahmini: ${kcal} kcal`;
}

document.getElementById('duzenle-miktar')?.addEventListener('input', () => {
    const entry = lastEntriesCache.find(e => e.id === duzenlenecekEntryId);
    duzenleOnizlemeGuncelle(entry);
});

async function duzenleKaydet() {
    const sonuc = document.getElementById('duzenle-sonuc');
    if (sonuc) sonuc.classList.add('hidden');
    const miktar = parseFloat(document.getElementById('duzenle-miktar')?.value || '0');
    if (!isFinite(miktar) || miktar <= 0) {
        if (sonuc) { sonuc.textContent = '❌ Miktar geçersiz.'; sonuc.classList.remove('hidden'); }
        return;
    }
    try {
        await apiFetch(`/food-entries/${duzenlenecekEntryId}?miktar=${encodeURIComponent(miktar)}`, { method: 'PATCH' });
        showToast('Güncellendi.', 'success');
        closeModal('duzenle-modal');
        duzenlenecekEntryId = null;
        await loadDashboard();
    } catch (err) {
        if (sonuc) { sonuc.textContent = '❌ ' + err.message; sonuc.classList.remove('hidden'); }
    }
}

/* ============================================================
   SU / KİLO
   ============================================================ */
async function suDegistir(deltaMl) {
    if (!currentUser) return;
    const log = await getOrCreateLogByDate(selectedDate);
    if (!log?.id) return;
    try {
        const updated = await apiFetch(`/daily-logs/${log.id}/water?deltaMl=${encodeURIComponent(deltaMl)}`, { method: 'POST' });
        const ml = updated?.icilenSuMiktari ?? 0;
        setText('dash-su', ml);
        updateWaterUI(ml);
        const msg = deltaMl > 0 ? `+${deltaMl} ml eklendi 💧` : `${deltaMl} ml çıkarıldı`;
        showToast(msg, 'success');
    } catch (err) {
        showToast('Su güncellenemedi: ' + err.message, 'error');
    }
}

async function kiloGuncelle() {
    if (!currentUser) return;
    const log = await getOrCreateLogByDate(selectedDate);
    if (!log?.id) return;
    const val = parseFloat(document.getElementById('dash-kilo-input')?.value || '');
    if (!isFinite(val) || val <= 0 || val > 500) { showToast('Geçerli bir kilo girin.', 'error'); return; }
    try {
        const updated = await apiFetch(`/daily-logs/${log.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ guncelKilo: val })
        });
        const displayKilo = updated?.guncelKilo ?? val;
        setText('dash-kilo', Math.round(displayKilo * 10) / 10);
        showToast(`Kilo güncellendi: ${val} kg`, 'success');
        document.getElementById('dash-kilo-input').value = '';

        if (window._physInfo?.boy) {
            const bmi = calcBMI(val, window._physInfo.boy);
            if (bmi) updateBmiChip(val);
        }

        const kiloRow = document.getElementById('kilo-bmi-row');
        if (kiloRow) kiloRow.classList.remove('hidden');
    } catch (err) {
        showToast('Kilo güncellenemedi: ' + err.message, 'error');
    }
}

/** Günlük satırından sepet `{ food }` oluştur (API birim makroları göndermediği için toplamlardan çıkarım). */
function basketFoodFromLogEntry(entry) {
    const m = Math.max(0.1, Number(entry?.miktar) || 1);
    const rk = Number(entry?.toplamKalori ?? 0) / m;
    const rp = Number(entry?.toplamProtein ?? 0) / m;
    const rkarb = Number(entry?.toplamKarb ?? 0) / m;
    const ry = Number(entry?.toplamYag ?? 0) / m;
    return {
        id: entry.foodId,
        yemekAdi: entry.yemekAdi || ('Besin #' + entry.foodId),
        birimMiktar: entry.birimMiktar || 'birim',
        birimKalori: Math.max(0, Math.round(rk * 100) / 100),
        birimProtein: Math.max(0, Math.round(rp * 100) / 100),
        birimKarb: Math.max(0, Math.round(rkarb * 100) / 100),
        birimYag: Math.max(0, Math.round(ry * 100) / 100)
    };
}

/** Öğün listesinde ✏️ — Yemek Ekle sepetindeki «Porsiyon & Detay» ile aynı akış. */
function yemekPorsiyonDetayAc(entryId) {
    const entry = lastEntriesCache.find(e => e.id === entryId);
    if (!entry) return;

    _yemekModalReplaceEntryId = entryId;
    currentMealTip = entry.ogunTipi || 'OGLE';
    modalSelectedFood = null;
    _basketKaydetBusyIdx = null;
    window._modalFoodList = [];

    const tipNames = { KAHVALTI: 'Kahvaltı ☀️', OGLE: 'Öğle 🌤️', AKSAM: 'Akşam 🌙', ARA_OGUN: 'Atıştırmalık 🍎' };
    setText('yemek-modal-sub', tipNames[currentMealTip] || currentMealTip);

    resetAiReviewPanel();
    document.getElementById('modal-food-arama').value = '';
    document.getElementById('modal-foodId').value = '';
    document.getElementById('modal-miktar').value = '1';
    const oniz = document.getElementById('modal-onizleme');
    if (oniz) oniz.innerHTML = '<span class="muted">Porsiyonu düzenleyip «Tümünü Öğüne Ekle» ile kaydedin.</span>';
    document.getElementById('modal-sonuc')?.classList.add('hidden');
    const sonuclar = document.getElementById('modal-food-sonuclar');
    if (sonuclar) { sonuclar.innerHTML = ''; sonuclar.classList.add('hidden'); }
    document.getElementById('modal-food-preview')?.classList.add('hidden');
    document.getElementById('modal-add-row')?.classList.add('hidden');
    document.getElementById('ai-suggest-panel')?.classList.add('hidden');
    resetAiSuggestPanelCopy();
    _suggestOfferDetailOpen = false;
    const bcIn = document.getElementById('modal-barcode-input');
    if (bcIn) bcIn.value = '';

    const food = basketFoodFromLogEntry(entry);
    const m = Math.max(0.1, Number(entry.miktar) || 1);
    _modalBasket = [{
        food,
        miktar: m,
        not: typeof entry.aciklama === 'string' ? entry.aciklama : '',
        _editOpen: true,
        _makroOzellesti: false
    }];
    _modalBasket.forEach(ensureBasketDefaults);
    if (_modalBasket[0]) _modalBasket[0]._foodBaseline = { ...food };

    yemekModalSetTab('ara');
    document.getElementById('yemek-modal').classList.remove('hidden');
    renderBasket();
    syncModalMainOnaylaBtn();
}

/* ============================================================
   RENDER SELECTED ENTRY
   ============================================================ */
function renderMealList(containerId, list) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!list?.length) { el.innerHTML = ''; return; }

    el.innerHTML = list.map(e => {
        const isSel = selectedEntry?.id === e.id;
        const p = fmt(e.toplamProtein);
        const k = fmt(e.toplamKarb);
        const y = fmt(e.toplamYag);
        return `
        <div class="meal-item ${isSel ? 'selected' : ''}">
            <div class="meal-item-content" onclick="selectEntry(${e.id})">
                <div class="meal-item-top">
                    <div class="meal-item-name">${escHtml(e.yemekAdi ?? ('Besin #' + e.foodId))}</div>
                    <div class="meal-item-kcal">${e.toplamKalori ?? 0} kcal</div>
                </div>
                <div class="meal-item-meta">${escHtml(e.birimMiktar || 'birim')}</div>
                ${e.aciklama ? `<div class="meal-item-note">${escHtml(e.aciklama)}</div>` : ''}
                <div class="meal-item-macros">
                    <span style="color:var(--blue)">P ${p}g</span> •
                    <span style="color:var(--orange)">K ${k}g</span> •
                    <span style="color:var(--purple)">Y ${y}g</span>
                </div>
            </div>
            <div class="meal-item-actions">
                <button type="button" class="btn-icon btn-icon-edit" onclick="event.stopPropagation(); yemekPorsiyonDetayAc(${e.id})" title="Porsiyon & detay">✏️</button>
                <button type="button" class="btn-icon btn-icon-delete" onclick="event.stopPropagation(); yemekSil(${e.id})" title="Sil">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function selectEntry(entryId) {
    const found = lastEntriesCache.find(e => e.id === entryId);
    if (!found) return;
    selectedEntry = found;
    renderSelectedEntry(found);
    mealListeleriYukle(todayLogId);
}

function renderSelectedEntry(entry) {
    const box = document.getElementById('selected-food-box');
    if (!box) return;
    if (!entry) { box.classList.add('hidden'); box.innerHTML = ''; return; }

    box.innerHTML = `
        <div class="sel-food-title">Seçili: <b>${escHtml(entry.yemekAdi ?? 'Besin')}</b></div>
        <div class="sel-food-row">
            <div class="sel-pill">🔥 <b>${entry.toplamKalori ?? 0}</b> kcal</div>
            <div class="sel-pill">Protein <b>${fmt(entry.toplamProtein)}</b>g</div>
            <div class="sel-pill">Karb <b>${fmt(entry.toplamKarb)}</b>g</div>
            <div class="sel-pill">Yağ <b>${fmt(entry.toplamYag)}</b>g</div>
        </div>`;
    box.classList.remove('hidden');
}

/* ============================================================
   ŞIFRE GÖSTERme
   ============================================================ */
function togglePassword(inputId, btn) {
    const el = document.getElementById(inputId);
    if (el.type === 'password') {
        el.type = 'text';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
        el.type = 'password';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
}

/* ============================================================
   MODAL CLOSE
   ============================================================ */
function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    if (id === 'yemek-modal') {
        resetAiReviewPanel();
        _yemekModalReplaceEntryId = null;
    }
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['yemek-modal', 'hedef-modal', 'duzenle-modal', 'confirm-modal'].forEach(id => closeModal(id));
    }
    if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        const ara = document.getElementById('kutuphane-ara');
        if (ara) { ara.focus(); ara.select(); }
    }
});

function isInputFocused() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/* ============================================================
   HELPERS
   ============================================================ */
async function apiFetch(path, options = {}) {
    const res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(extractApiErrorMessage(txt, res.status));
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
}

function extractApiErrorMessage(rawText, status) {
    if (!rawText || !rawText.trim()) {
        return status >= 500 ? 'Sunucu hatası oluştu. Lütfen tekrar deneyin.' : `İstek başarısız (HTTP ${status})`;
    }

    try {
        const parsed = JSON.parse(rawText);
        const msg = parsed?.error || parsed?.message || parsed?.detail;
        if (msg && String(msg).trim()) return String(msg).trim();
    } catch (_) {}

    const clean = String(rawText).replace(/\s+/g, ' ').trim();
    if (clean.startsWith('{') && clean.includes('timestamp')) {
        return status >= 500
            ? 'Sunucu hatası oluştu. Lütfen tekrar deneyin.'
            : 'İstek sırasında bir hata oluştu.';
    }
    return clean || `İstek başarısız (HTTP ${status})`;
}

function showToast(msg, type = 'success', duration = 3000) {
    const t = document.getElementById('toast');
    const iconEl = document.getElementById('toast-icon');
    const msgEl  = document.getElementById('toast-msg');
    if (!t) return;
    const icons = { success: '✓', error: '✕', warning: '!' };
    if (iconEl) iconEl.textContent = icons[type] || '✓';
    if (msgEl)  msgEl.textContent  = msg;
    t.className = `toast ${type}`;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.add('hidden'), duration);
}

function showResult(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'result-box ' + type;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function clearResult(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'result-box hidden';
    el.textContent = '';
}

function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn._orig = btn._orig || btn.innerHTML;
    btn.innerHTML = loading
        ? '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite"></div>'
        : btn._orig;
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function fmt(v) { return (Math.round((v || 0) * 10) / 10).toString(); }

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-');
    return `${parseInt(d)}/${parseInt(m)}`;
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const step = (target - current) / 20;
    let val = current;
    let frames = 0;
    const timer = setInterval(() => {
        val += step;
        frames++;
        if (frames >= 20 || Math.abs(val - target) < 1) {
            el.textContent = target;
            clearInterval(timer);
        } else {
            el.textContent = Math.round(val);
        }
    }, 25);
}

/* ============================================================
   MODAL KAMERA & AI REVIEW
   ============================================================ */
let _aiReviewItems = []; // {ad, kcal, protein, karb, yag, gram}
/** Barkod / liste dışı öneri kartında kamera gibi önce kapalı; «Porsiyon & Detay» ile miktar+not alanı açılır (içeride Kaydet AI). */
let _suggestOfferDetailOpen = false;
let _pendingModalPhotoFile = null;
function toggleModalPhotoPicker() {
    yemekModalSetTab('kamera');
}

async function modalPhotoAnalyze(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    _pendingModalPhotoFile = file;

    const previewWrap = document.getElementById('modal-photo-preview');
    const previewImg = document.getElementById('modal-photo-preview-img');
    if (previewImg) previewImg.src = URL.createObjectURL(file);
    previewWrap?.classList.remove('hidden');
    document.getElementById('modal-photo-picker')?.classList.add('hidden');
}

function modalPhotoRetake() {
    _pendingModalPhotoFile = null;
    const previewWrap = document.getElementById('modal-photo-preview');
    const previewImg = document.getElementById('modal-photo-preview-img');
    if (previewImg) previewImg.src = '';
    previewWrap?.classList.add('hidden');
    document.getElementById('modal-photo-picker')?.classList.remove('hidden');
}

async function modalPhotoUse() {
    if (!_pendingModalPhotoFile) return;
    const file = _pendingModalPhotoFile;
    _pendingModalPhotoFile = null;
    document.getElementById('modal-photo-preview')?.classList.add('hidden');

    // picker'ı gizle, review panelini göster
    document.getElementById('modal-photo-picker').classList.add('hidden');
    const panel = document.getElementById('ai-review-panel');
    const loading = document.getElementById('ai-review-loading');
    const itemsDiv = document.getElementById('ai-review-items');
    const addBtn = document.getElementById('ai-review-add-btn');

    panel.classList.remove('hidden');
    syncModalMainOnaylaBtn();
    loading.classList.remove('hidden');
    itemsDiv.innerHTML = '';
    addBtn.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${BASE}/ai/analyze-food-items?mode=auto`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Analiz başarısız');
        }
        const items = await res.json();

        if (!items.length) {
            loading.classList.add('hidden');
            itemsDiv.innerHTML = '';
            panel.classList.add('hidden');
            showToast('Yemek tespit edilemedi. Tekrar seçebilirsiniz.', 'warning');
            restoreModalKameraChooserIfIdle();
            syncModalMainOnaylaBtn();
            return;
        }

        const deduped = dedupeAiDetectedItems(items).slice(0, 8);
        _aiReviewItems = deduped.map((it, i) => withAiCompositeMeta({ ...it, _id: i }));
        renderAiReviewItems();
        addBtn.classList.remove('hidden');

        // Her item için kütüphane eşleşmesi ara
        _aiReviewItems.forEach(it => searchLibraryMatch(it));

    } catch (err) {
        itemsDiv.innerHTML = '';
        panel.classList.add('hidden');
        showToast('Analiz hatası: ' + (err.message || err), 'error');
        restoreModalKameraChooserIfIdle();
    } finally {
        loading.classList.add('hidden');
        syncModalMainOnaylaBtn();
    }
}

function withAiCompositeMeta(item) {
    const next = { ...item };
    next._baseKcal = Number(next.kcal || 0);
    next._baseProtein = Number(next.protein || 0);
    next._baseKarb = Number(next.karb || 0);
    next._baseYag = Number(next.yag || 0);
    next._editingName = false;
    if (typeof next._porsiyonPanelOpen !== 'boolean') next._porsiyonPanelOpen = false;
    next._porsiyonDetay = typeof next._porsiyonDetay === 'string' ? next._porsiyonDetay : '';
    return next;
}

function normalizeAiFoodName(name) {
    return String(name || '')
        .toLocaleLowerCase('tr')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function dedupeAiDetectedItems(items) {
    const seen = new Set();
    const out = [];
    (items || []).forEach((it) => {
        const key = normalizeAiFoodName(it?.ad);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(it);
    });
    return out;
}

async function aiResolveItemByName(name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const dbList = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(clean)}`).catch(() => []);
    if (dbList?.length) {
        const f = dbList[0];
        return {
            ad: f.yemekAdi,
            kcal: Number(f.birimKalori || 0),
            protein: Number(f.birimProtein || 0),
            karb: Number(f.birimKarb || 0),
            yag: Number(f.birimYag || 0),
            gram: 100,
            _libraryFoodId: f.id
        };
    }
    const ai = await apiFetch('/ai/suggest-nutrition', {
        method: 'POST',
        body: JSON.stringify({ foodName: clean })
    }).catch(() => null);
    if (!ai) return null;
    return {
        ad: ai.ad || clean,
        kcal: Number(ai.kcal || 0),
        protein: Number(ai.protein || 0),
        karb: Number(ai.karb || 0),
        yag: Number(ai.yag || 0),
        gram: Number(ai.gram || 100)
    };
}

function aiItemTogglePorsiyonPanel(id) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    item._porsiyonPanelOpen = !item._porsiyonPanelOpen;
    if (item._porsiyonPanelOpen) item._editingName = false;
    renderAiReviewItems();
}

function renderAiReviewItems() {
    const div = document.getElementById('ai-review-items');
    div.innerHTML = _aiReviewItems.map(it => {
        const rawDet = typeof it._porsiyonDetay === 'string' ? it._porsiyonDetay.trim() : '';
        const notePreview = rawDet && !it._porsiyonPanelOpen
            ? `<div class="ai-review-note-preview">${escHtml(rawDet)}</div>`
            : '';
        const porsiyonPanel = it._porsiyonPanelOpen ? `
            <div class="basket-edit-panel ai-review-porsiyon-drop">
                <textarea id="ai-detail-${it._id}" class="basket-note-input ai-review-detail-ta" maxlength="900" rows="3"
                    placeholder="Yapılış (ör. 10 yumurta, dürüm…). Not yazıp Kaydet ile makroları güncelle."
                    oninput="aiItemDetayChange(${it._id}, this.value)"></textarea>
                <p class="basket-edit-ai-hint">Not doluysa <b>Kaydet</b> — makrolar metne göre yeniden hesaplanır. Not boşsa foto satırı korunur.</p>
                <div class="basket-edit-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="aiItemTogglePorsiyonPanel(${it._id})">Vazgeç</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="aiItemRecalcFromDetail(${it._id})">Kaydet</button>
                </div>
            </div>` : '';
        return `
        <div class="ai-review-item ${it._porsiyonPanelOpen ? 'ai-review-item--open' : ''}" id="ai-item-${it._id}">
            <div class="ai-review-item-head-row">
                <div class="ai-review-item-header">
                    <input id="ai-name-input-${it._id}" class="ai-name-field" type="text" value="${escHtml(it.ad)}" ${it._editingName ? '' : 'readonly'}>
                    <div class="ai-header-btns">
                        <button type="button" class="ai-item-edit-btn" onclick="aiItemToggleEdit(${it._id})" title="İsim düzenle; tek isim yazınca AI makroyu yeniler">${it._editingName ? 'Uygula' : 'Düzenle'}</button>
                        <button type="button" class="ai-item-add-btn" onclick="aiItemOpenAdd(${it._id})" title="Yanına yemek ekle">+</button>
                    </div>
                </div>
                <div class="ai-review-head-actions">
                    <button type="button" class="btn-basket-porsiyon" onclick="aiItemTogglePorsiyonPanel(${it._id})">
                        ${it._porsiyonPanelOpen ? 'Kapat' : 'Porsiyon & Detay'}
                    </button>
                    <button type="button" class="ai-item-del-btn" onclick="aiItemSil(${it._id})" title="Sil">×</button>
                </div>
            </div>
            <div class="ai-review-macro-pills">
                <span class="ai-pill kcal">${Math.round((it.kcal || 0) * 10) / 10} kcal</span>
                <span class="ai-pill p">P ${Math.round((it.protein || 0) * 10) / 10}g</span>
                <span class="ai-pill k">K ${Math.round((it.karb || 0) * 10) / 10}g</span>
                <span class="ai-pill y">Y ${Math.round((it.yag || 0) * 10) / 10}g</span>
            </div>
            ${notePreview}
            <div class="ai-edit-macros ${it._editingName ? '' : 'hidden'}">
                <label>Kcal <input type="number" step="0.1" value="${Math.round((it.kcal || 0) * 10) / 10}" oninput="aiItemMacroChange(${it._id}, 'kcal', this.value)"></label>
                <label>P <input type="number" step="0.1" value="${Math.round((it.protein || 0) * 10) / 10}" oninput="aiItemMacroChange(${it._id}, 'protein', this.value)"></label>
                <label>K <input type="number" step="0.1" value="${Math.round((it.karb || 0) * 10) / 10}" oninput="aiItemMacroChange(${it._id}, 'karb', this.value)"></label>
                <label>Y <input type="number" step="0.1" value="${Math.round((it.yag || 0) * 10) / 10}" oninput="aiItemMacroChange(${it._id}, 'yag', this.value)"></label>
            </div>
            <div id="ai-add-wrap-${it._id}" class="ai-add-wrap hidden">
                <input id="ai-add-input-${it._id}" type="text" class="ai-add-input" placeholder="Yemek ara (örn: tavuk göğsü)" oninput="aiItemSearchAdd(${it._id}, this.value)">
                <div id="ai-add-results-${it._id}" class="autocomplete-results hidden" style="position:static;max-height:180px"></div>
            </div>
            <div id="ai-match-${it._id}" class="ai-item-library-match hidden"></div>
            ${porsiyonPanel}
        </div>`;
    }).join('');
    _aiReviewItems.forEach(it => {
        const ta = document.getElementById(`ai-detail-${it._id}`);
        if (ta && typeof it._porsiyonDetay === 'string') ta.value = it._porsiyonDetay;
    });
    syncModalMainOnaylaBtn();
}

function aiItemSil(id) {
    _aiReviewItems = _aiReviewItems.filter(x => x._id !== id);
    const el = document.getElementById(`ai-item-${id}`);
    if (el) el.remove();
    if (!_aiReviewItems.length) {
        document.getElementById('ai-review-add-btn')?.classList.add('hidden');
        document.getElementById('ai-review-panel')?.classList.add('hidden');
        document.getElementById('ai-review-loading')?.classList.add('hidden');
        restoreModalKameraChooserIfIdle();
    }
    syncModalMainOnaylaBtn();
}

function aiItemMacroChange(id, field, value) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    const n = parseFloat(value);
    item[field] = isFinite(n) ? Math.max(0, n) : 0;
}

function aiItemDetayChange(id, value) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    item._porsiyonDetay = typeof value === 'string' ? value : '';
}

/** Porsiyon notu → /ai/suggest-nutrition ile makroları güncelle (foto AI satırı) */
async function aiItemRecalcFromDetail(id) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    const nameEl = document.getElementById(`ai-name-input-${id}`);
    const detEl = document.getElementById(`ai-detail-${id}`);
    const name = (nameEl?.value ?? item.ad ?? '').trim();
    const det = (detEl?.value ?? item._porsiyonDetay ?? '').trim();
    if (!name) {
        showToast('Önce bir yemek adı yaz.', 'warning');
        return;
    }
    try {
        const q = det
            ? buildStructuredNutritionPrompt({
                dishName: name,
                baseMacros: {
                    birimKalori: Number(item.kcal ?? 0),
                    birimProtein: Number(item.protein ?? 0),
                    birimKarb: Number(item.karb ?? 0),
                    birimYag: Number(item.yag ?? 0)
                },
                refUnitLabel: 'Foto / AI satırı tahmini',
                qtyMultiplier: 1,
                userNote: det,
                priorAiRefined: true
            })
            : name;
        const ai = await apiFetch('/ai/suggest-nutrition', {
            method: 'POST',
            body: JSON.stringify({ foodName: q })
        });
        const merged = withAiCompositeMeta({
            ...item,
            ad: ai.ad || name,
            kcal: Number(ai.kcal || 0),
            protein: Number(ai.protein || 0),
            karb: Number(ai.karb || 0),
            yag: Number(ai.yag || 0),
            gram: Number(ai.gram || 100),
            _porsiyonDetay: det,
            _libraryFoodId: undefined
        });
        Object.assign(item, merged);
        item._libraryFoodId = undefined;
        item._porsiyonPanelOpen = false;
        renderAiReviewItems();
        searchLibraryMatch(item);
        showToast('Makrolar yazdığınız puana göre güncellendi — gerekirse elle düzeltin.', 'success');
    } catch (e) {
        showToast('AI hesaplama başarısız: ' + (e.message || e), 'error');
    }
}

async function aiItemToggleEdit(id) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    if (!item._editingName) {
        item._porsiyonPanelOpen = false;
        item._editingName = true;
        renderAiReviewItems();
        const inp = document.getElementById(`ai-name-input-${id}`);
        if (inp) inp.focus();
        return;
    }

    const input = document.getElementById(`ai-name-input-${id}`);
    const raw = (input?.value || '').trim();
    if (!raw) {
        item._editingName = false;
        renderAiReviewItems();
        return;
    }

    const parts = Array.from(new Set(raw.split(',').map(x => x.trim()).filter(Boolean)));
    if (!parts.length) {
        item._editingName = false;
        renderAiReviewItems();
        return;
    }

    // Tek isim: yeni ada göre AI makroları (ör. foto «tost» → kullanıcı «kumru» yazdı)
    if (parts.length === 1) {
        const detTa = document.getElementById(`ai-detail-${id}`);
        if (detTa) item._porsiyonDetay = detTa.value.trim();
        const newName = parts[0];
        const det = (item._porsiyonDetay || '').trim();
        item._editingName = false;
        renderAiReviewItems();

        try {
            const foodName = det
                ? buildStructuredNutritionPrompt({
                    dishName: newName,
                    baseMacros: {
                        birimKalori: Number(item.kcal ?? 0),
                        birimProtein: Number(item.protein ?? 0),
                        birimKarb: Number(item.karb ?? 0),
                        birimYag: Number(item.yag ?? 0)
                    },
                    refUnitLabel: 'Önceki foto/yanlış isim tahmini',
                    qtyMultiplier: 1,
                    userNote: det,
                    priorAiRefined: true
                })
                : newName;
            const ai = await apiFetch('/ai/suggest-nutrition', {
                method: 'POST',
                body: JSON.stringify({ foodName })
            });
            const merged = withAiCompositeMeta({
                ...item,
                ad: ai.ad || newName,
                kcal: Number(ai.kcal || 0),
                protein: Number(ai.protein || 0),
                karb: Number(ai.karb || 0),
                yag: Number(ai.yag || 0),
                gram: Number(ai.gram || 100),
                _porsiyonDetay: det,
                _libraryFoodId: undefined
            });
            Object.assign(item, merged);
            item._libraryFoodId = undefined;
            renderAiReviewItems();
            searchLibraryMatch(item);
            showToast('İsme göre makrolar yenilendi.', 'success');
        } catch (e) {
            item._editingName = true;
            renderAiReviewItems();
            showToast('Makrolar güncellenemedi: ' + (e.message || e), 'error');
        }
        return;
    }

    const resolved = [];
    for (const name of parts) {
        const val = await aiResolveItemByName(name);
        if (val) resolved.push(val);
    }
    if (!resolved.length) {
        showToast('Yemek adı çözümlenemedi. Lütfen tekrar deneyin.', 'warning');
        return;
    }

    const idx = _aiReviewItems.findIndex(x => x._id === id);
    const expanded = resolved.map((r, i) => withAiCompositeMeta({
        ...r,
        _id: Date.now() + i + Math.floor(Math.random() * 1000)
    }));
    expanded.forEach(x => { x._editingName = false; });
    _aiReviewItems.splice(idx, 1, ...expanded);
    renderAiReviewItems();
}

function aiItemOpenAdd(id) {
    const wrap = document.getElementById(`ai-add-wrap-${id}`);
    const input = document.getElementById(`ai-add-input-${id}`);
    const results = document.getElementById(`ai-add-results-${id}`);
    if (!wrap || !input || !results) return;
    wrap.classList.toggle('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    input.value = '';
    if (!wrap.classList.contains('hidden')) setTimeout(() => input.focus(), 30);
}

async function aiItemSearchAdd(id, q) {
    const results = document.getElementById(`ai-add-results-${id}`);
    if (!results) return;
    const query = (q || '').trim();
    if (query.length < 2) {
        results.classList.add('hidden');
        results.innerHTML = '';
        return;
    }
    const list = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(query)}`).catch(() => []);
    if (!list?.length) {
        results.innerHTML = `<div class="autocomplete-item empty">Sonuç yok</div>`;
        results.classList.remove('hidden');
        return;
    }
    results.innerHTML = list.slice(0, 8).map(f => `
        <div class="autocomplete-item" onclick="aiItemAddFromDb(${id}, ${f.id})">
            <div class="ac-name">${escHtml(f.yemekAdi)}</div>
            <div class="ac-info">
                <div class="ac-kcal">${f.birimKalori ?? 0} kcal</div>
                <div class="ac-unit">${escHtml(f.birimMiktar ?? '')}</div>
            </div>
        </div>
    `).join('');
    results.classList.remove('hidden');
}

async function aiItemAddFromDb(sourceId, foodId) {
    try {
        const pool = await apiFetch('/foods').catch(() => []);
        const found = (pool || []).find(x => x.id === foodId);
        if (!found) throw new Error('Besin bulunamadı');
        _aiReviewItems.push(withAiCompositeMeta({
            _id: Date.now() + Math.floor(Math.random() * 1000),
            ad: found.yemekAdi,
            kcal: found.birimKalori ?? 0,
            protein: found.birimProtein ?? 0,
            karb: found.birimKarb ?? 0,
            yag: found.birimYag ?? 0,
            gram: 100,
            _libraryFoodId: found.id
        }));
        renderAiReviewItems();
        showToast(`${found.yemekAdi} eklendi`, 'success');
    } catch (err) {
        showToast('Yemek eklenemedi: ' + err.message, 'error');
    }
}

async function searchLibraryMatch(item) {
    try {
        const list = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(item.ad)}`).catch(() => []);
        if (!list?.length) return;
        const match = list[0];
        const el = document.getElementById(`ai-match-${item._id}`);
        if (!el) return;
        el.classList.remove('hidden');
        el.innerHTML = `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Kütüphanede var: "${escHtml(match.yemekAdi)}" —
            <span onclick="aiItemKutuphaneSec(${item._id}, ${match.id}, '${escHtml(match.yemekAdi)}', ${match.birimKalori}, ${match.birimProtein}, ${match.birimKarb}, ${match.birimYag}, '${escHtml(match.birimMiktar || '')}')">
                kullan
            </span>
        `;
    } catch (_) {}
}

function aiItemKutuphaneSec(id, foodId, ad, kcal, protein, karb, yag, birimMiktar) {
    const item = _aiReviewItems.find(x => x._id === id);
    if (!item) return;
    item._libraryFoodId = foodId;
    item.ad = ad; item.kcal = kcal; item.protein = protein; item.karb = karb; item.yag = yag;
    item._baseKcal = Number(kcal || 0);
    item._baseProtein = Number(protein || 0);
    item._baseKarb = Number(karb || 0);
    item._baseYag = Number(yag || 0);
    item._libBirimMiktar = birimMiktar || '';
    item._miktar = inferAiPortionMultiplier(item);

    // DOM güncelle
    const itemEl = document.getElementById(`ai-item-${id}`);
    if (!itemEl) return;
    renderAiReviewItems();

    const matchEl = document.getElementById(`ai-match-${id}`);
    if (matchEl) matchEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Kütüphane verisi kullanılıyor ✓ (miktar: ${fmt(item._miktar || 1)})`;
    showToast(`"${ad}" kütüphane verisi kullanıldı`, 'success');
}

async function aiReviewEkle() {
    if (!_aiReviewItems.length) return;

    const btn = document.getElementById('ai-review-add-btn');
    setLoading(btn, true);

    let eklenen = 0;
    for (const item of _aiReviewItems) {
        try {
            const notStr = String(item._porsiyonDetay || '').trim();
            let foodObj;

            if (item._libraryFoodId) {
                const list = await apiFetch(`/foods/ara?yemekAdi=${encodeURIComponent(item.ad || '')}`).catch(() => []);
                foodObj = (list || []).find(f => f.id === item._libraryFoodId);
                if (!foodObj) throw new Error('Kütüphane besini çözülemedi');
            } else {
                const gram = item.gram || 100;
                foodObj = await apiFetch('/foods', {
                    method: 'POST',
                    body: JSON.stringify({
                        yemekAdi: item.ad,
                        birimMiktar: `${Math.round(gram)}g porsiyon`,
                        birimKalori: item.kcal,
                        birimProtein: item.protein,
                        birimKarb: item.karb,
                        birimYag: item.yag
                    })
                });
            }

            const miktar = item._libraryFoodId
                ? (item._miktar || inferAiPortionMultiplier(item) || 1)
                : 1;

            _modalBasket.push({ food: foodObj, miktar, not: notStr, _editOpen: false });
            eklenen++;
        } catch (err) {
            showToast(`"${item.ad}" sepete eklenemedi: ${err.message}`, 'error');
        }
    }

    setLoading(btn, false);
    if (eklenen > 0) {
        renderBasket();
        _aiReviewItems = [];
        const itemsDiv = document.getElementById('ai-review-items');
        if (itemsDiv) itemsDiv.innerHTML = '';
        document.getElementById('ai-review-panel')?.classList.add('hidden');
        document.getElementById('ai-review-add-btn')?.classList.add('hidden');
        restoreModalKameraChooserIfIdle();
        syncModalMainOnaylaBtn();
        showToast(eklenen === 1 ? '1 öğe sepete eklendi' : `${eklenen} öğe sepete eklendi`, 'success');
    }
}

/** AI foto satirlari kullanilirken ustteki ai-review-add varken alttaki mukerrer Tumuunu gizle. */
function syncModalMainOnaylaBtn() {
    const panel = document.getElementById('ai-review-panel');
    const addBtn = document.getElementById('ai-review-add-btn');
    const footerBtn = document.getElementById('modal-onayla-btn');
    if (!footerBtn || !panel || !addBtn) return;
    const aiCommitVisible = !panel.classList.contains('hidden') && !addBtn.classList.contains('hidden');
    footerBtn.classList.toggle('hidden', aiCommitVisible);
}

function resetAiReviewPanel() {
    _aiReviewItems = [];
    document.getElementById('ai-review-panel')?.classList.add('hidden');
    const itemsEl = document.getElementById('ai-review-items');
    if (itemsEl) itemsEl.innerHTML = '';
    modalPhotoUiPrepareFresh();
    syncModalMainOnaylaBtn();
}

function inferAiPortionMultiplier(item) {
    const gram = parseFloat(item?.gram || '0');
    if (!isFinite(gram) || gram <= 0) return 1;
    const m = String(item?._libBirimMiktar || '').match(/([\d.,]+)/);
    if (!m) return Math.max(0.1, Math.round((gram / 100) * 10) / 10);
    const birimGram = parseFloat(m[1].replace(',', '.'));
    if (!isFinite(birimGram) || birimGram <= 0) return Math.max(0.1, Math.round((gram / 100) * 10) / 10);
    return Math.max(0.1, Math.round((gram / birimGram) * 10) / 10);
}

/* ============================================================
   AI FOTOĞRAF ANALİZİ
   ============================================================ */
let _aiSelectedFile = null;

function handleAiPhotoSelect(input) {
    const file = input.files[0];
    if (!file) return;
    _aiSelectedFile = file;

    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('ai-preview-img').src = e.target.result;
        document.getElementById('ai-upload-area').classList.add('hidden');
        document.getElementById('ai-preview-wrap').classList.remove('hidden');
        document.getElementById('ai-result-box').classList.add('hidden');
        document.getElementById('ai-result-box').textContent = '';
    };
    reader.readAsDataURL(file);
}

function resetAiPhoto() {
    _aiSelectedFile = null;
    document.getElementById('ai-photo-input').value = '';
    document.getElementById('ai-preview-img').src = '';
    document.getElementById('ai-upload-area').classList.remove('hidden');
    document.getElementById('ai-preview-wrap').classList.add('hidden');
    document.getElementById('ai-result-box').classList.add('hidden');
    document.getElementById('ai-result-box').textContent = '';
}

async function analyzeAiPhoto() {
    if (!_aiSelectedFile) { showToast('Önce bir fotoğraf seçin.', 'warning'); return; }

    const btn = document.getElementById('ai-analyze-btn');
    const resultBox = document.getElementById('ai-result-box');
    setLoading(btn, true);

    resultBox.className = 'ai-result-box loading';
    resultBox.classList.remove('hidden');
    resultBox.textContent = 'Yapay zeka analiz ediyor…';

    try {
        const formData = new FormData();
        formData.append('image', _aiSelectedFile);

        const res = await fetch(`${BASE}/ai/analyze-food`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        resultBox.className = 'ai-result-box';
        resultBox.textContent = data.result || 'Analiz tamamlandı.';
    } catch (err) {
        resultBox.className = 'ai-result-box';
        resultBox.style.borderLeftColor = 'var(--red)';
        resultBox.textContent = 'Hata: ' + err.message;
        showToast('Analiz başarısız: ' + err.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

/* ============================================================
   DOMContentLoaded
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    injectSvgDefs();
    bindDateStrip();

    const uploadArea = document.getElementById('ai-upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--green)'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const input = document.getElementById('ai-photo-input');
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                handleAiPhotoSelect(input);
            }
        });
    }

    if (currentUser) showApp();
});
