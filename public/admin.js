// === Telegram WebApp ===
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// === Состояние ===
let categories = [];
let menuItems = [];
let orders = [];
let editingItemId = null;
let ordersInterval = null;

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadMenu();
  loadOrders();

  // Автообновление заказов каждые 30 секунд
  ordersInterval = setInterval(loadOrders, 30000);
});

// === Вкладки ===
function switchTab(tabName) {
  // Деактивируем все вкладки
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  // Активируем нужную
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Подгружаем данные
  if (tabName === 'orders') loadOrders();
}

// =====================
// === КАТЕГОРИИ ======
// =====================

async function loadCategories() {
  try {
    const res = await fetch('/api/admin/categories');
    categories = await res.json();
    renderCategories();
    updateCategorySelect();
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
  }
}

function renderCategories() {
  const list = document.getElementById('categories-list');
  
  if (categories.length === 0) {
    list.innerHTML = '<div class="empty-list">Категории пока не добавлены</div>';
    return;
  }

  list.innerHTML = categories.map(cat => `
    <div class="cat-item">
      <div>
        <span class="cat-item-name">${escapeHtml(cat.name)}</span>
        <span class="cat-item-sort">(порядок: ${cat.sort_order})</span>
      </div>
      <button class="btn btn-danger btn-small" onclick="deleteCategory(${cat.id})">Удалить</button>
    </div>
  `).join('');
}

async function addCategory() {
  const nameInput = document.getElementById('cat-name');
  const sortInput = document.getElementById('cat-sort');
  const name = nameInput.value.trim();
  const sort_order = parseInt(sortInput.value) || 0;

  if (!name) {
    alert('Введите название категории');
    return;
  }

  try {
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sort_order })
    });
    const data = await res.json();
    if (data.success) {
      nameInput.value = '';
      sortInput.value = '0';
      loadCategories();
    } else {
      alert(data.error || 'Ошибка создания');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию? Позиции останутся без категории.')) return;

  try {
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    loadCategories();
    loadMenu();
  } catch (err) {
    alert('Ошибка удаления');
  }
}

function updateCategorySelect() {
  const select = document.getElementById('item-category');
  select.innerHTML = '<option value="">Без категории</option>' +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

// =====================
// === МЕНЮ ===========
// =====================

async function loadMenu() {
  try {
    const res = await fetch('/api/admin/menu');
    menuItems = await res.json();
    renderMenuItems();
    renderStoplist();
  } catch (err) {
    console.error('Ошибка загрузки меню:', err);
  }
}

function renderStoplist() {
  const list = document.getElementById('stoplist-list');
  if (!list) return;
  
  const stopped = menuItems.filter(item => item.is_stopped);
  if (stopped.length === 0) {
    list.innerHTML = '<div class="empty-list">В стоп-листе пусто. Все блюда доступны.</div>';
    return;
  }
  
  list.innerHTML = stopped.map(item => `
    <div class="menu-item stopped">
      ${item.image ? `<img class="menu-item-img" src="${item.image}">` : `<div class="menu-item-placeholder">🍽️</div>`}
      <div class="menu-item-info">
        <div class="menu-item-name">${escapeHtml(item.name)}</div>
        <div class="menu-item-price">${item.price} ₽</div>
      </div>
      <div class="menu-item-controls">
        <button class="btn btn-primary btn-small" onclick="toggleStop(${item.id}, 1)">Вернуть в меню</button>
      </div>
    </div>
  `).join('');
}

function renderMenuItems() {
  const list = document.getElementById('menu-list');
  
  if (menuItems.length === 0) {
    list.innerHTML = '<div class="empty-list">Позиции меню пока не добавлены</div>';
    return;
  }

  list.innerHTML = menuItems.map(item => `
    <div class="menu-item ${item.is_stopped ? 'stopped' : ''}">
      ${item.image
        ? `<img class="menu-item-img" src="${item.image}" alt="${escapeHtml(item.name)}">`
        : `<div class="menu-item-placeholder">🍽️</div>`
      }
      <div class="menu-item-info">
        <div class="menu-item-name">${escapeHtml(item.name)}</div>
        <div class="menu-item-category">${item.category_name ? escapeHtml(item.category_name) : 'Без категории'}</div>
      </div>
      <div class="menu-item-price">${item.price} ₽</div>
      <div class="menu-item-controls">
        <div>
          <label class="toggle" title="${item.is_stopped ? 'В стоп-листе' : 'Доступно'}">
            <input type="checkbox" ${item.is_stopped ? 'checked' : ''} onchange="toggleStop(${item.id}, ${item.is_stopped})">
            <span class="toggle-slider"></span>
          </label>
          <div class="stop-label">${item.is_stopped ? 'СТОП' : ''}</div>
        </div>
        <button class="btn btn-secondary btn-small" onclick="editMenuItem(${item.id})">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteMenuItem(${item.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function saveMenuItem() {
  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-desc').value.trim();
  const price = document.getElementById('item-price').value;
  const category_id = document.getElementById('item-category').value;
  const sort_order = document.getElementById('item-sort').value;
  const imageInput = document.getElementById('item-image');

  if (!name) {
    alert('Введите название позиции');
    return;
  }
  if (!price || parseFloat(price) <= 0) {
    alert('Введите корректную цену');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('price', price);
  formData.append('category_id', category_id);
  formData.append('sort_order', sort_order || '0');
  
  if (imageInput.files[0]) {
    formData.append('image', imageInput.files[0]);
  }

  try {
    const url = editingItemId 
      ? `/api/admin/menu/${editingItemId}` 
      : '/api/admin/menu';
    const method = editingItemId ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();

    if (data.success) {
      resetMenuForm();
      loadMenu();
    } else {
      alert(data.error || 'Ошибка сохранения');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
}

function editMenuItem(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item) return;

  editingItemId = id;

  document.getElementById('item-name').value = item.name;
  document.getElementById('item-desc').value = item.description || '';
  document.getElementById('item-price').value = item.price;
  document.getElementById('item-category').value = item.category_id || '';
  document.getElementById('item-sort').value = item.sort_order || 0;

  // Превью текущего изображения
  const preview = document.getElementById('image-preview');
  if (item.image) {
    preview.src = item.image;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('menu-form-title').textContent = 'Редактирование позиции';
  document.getElementById('menu-form-btn').textContent = 'Сохранить';
  document.getElementById('menu-cancel-btn').style.display = 'inline-block';

  // Скролл к форме
  document.getElementById('tab-menu').scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  resetMenuForm();
}

function resetMenuForm() {
  editingItemId = null;
  document.getElementById('item-name').value = '';
  document.getElementById('item-desc').value = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-category').value = '';
  document.getElementById('item-sort').value = '0';
  document.getElementById('item-image').value = '';
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('file-label-text').textContent = '📷 Выбрать фото';
  document.getElementById('menu-form-title').textContent = 'Добавить позицию';
  document.getElementById('menu-form-btn').textContent = 'Добавить позицию';
  document.getElementById('menu-cancel-btn').style.display = 'none';
}

async function toggleStop(id, currentState) {
  try {
    await fetch(`/api/admin/menu/${id}/stop`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_stopped: currentState ? 0 : 1 })
    });
    loadMenu();
  } catch (err) {
    alert('Ошибка обновления стоп-листа');
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Удалить позицию из меню?')) return;

  try {
    await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
    loadMenu();
  } catch (err) {
    alert('Ошибка удаления');
  }
}

function previewImage(input) {
  const preview = document.getElementById('image-preview');
  const labelText = document.getElementById('file-label-text');

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
    labelText.textContent = '📷 ' + input.files[0].name;
  } else {
    preview.style.display = 'none';
    labelText.textContent = '📷 Выбрать фото';
  }
}

// =====================
// === ЗАКАЗЫ =========
// =====================

async function loadOrders() {
  try {
    const res = await fetch('/api/admin/orders');
    orders = await res.json();
    renderOrders();
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
  }
}

function renderOrders() {
  const list = document.getElementById('orders-list');
  
  if (orders.length === 0) {
    list.innerHTML = '<div class="empty-list">Заказов пока нет</div>';
    return;
  }

  list.innerHTML = orders.map(order => {
    const date = new Date(order.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="order-card">
        <div class="order-header">
          <span class="order-number">Заказ #${order.id}</span>
          <select class="status-select ${order.status}" onchange="updateOrderStatus(${order.id}, this.value)">
            <option value="new" ${order.status === 'new' ? 'selected' : ''}>Новый</option>
            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Готовится</option>
            <option value="delivering" ${order.status === 'delivering' ? 'selected' : ''}>В пути</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Завершен</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменен</option>
          </select>
        </div>
        <div class="order-date">${dateStr}</div>
        <div class="order-info">
          <div><strong>Телефон:</strong> ${escapeHtml(order.phone)}</div>
          <div><strong>Адрес:</strong> ${escapeHtml(order.address)}</div>
          ${order.comment ? `<div><strong>Коммент.:</strong> ${escapeHtml(order.comment)}</div>` : ''}
        </div>
        <div class="order-items">
          <div class="order-items-title">Состав:</div>
          ${(order.items || []).map(item => `
            <div class="order-item-line">• ${escapeHtml(item.name)} × ${item.quantity} — ${item.price * item.quantity} ₽</div>
          `).join('')}
        </div>
        <div class="order-total">Итого: ${order.total} ₽</div>
      </div>
    `;
  }).join('');
}

async function updateOrderStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
    } else {
      alert('Ошибка при обновлении статуса');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
}

async function clearAllOrders() {
  if (!confirm('Вы уверены, что хотите удалить ВСЕ заказы? Это действие необратимо.')) return;
  try {
    const res = await fetch('/api/admin/orders', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadOrders();
    } else {
      alert('Ошибка при очистке заказов');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function importDatabase(input) {
  if (!input.files || !input.files[0]) return;
  if (!confirm('Восстановить базу данных из выбранного файла? Текущие данные будут заменены.')) {
    input.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('dbfile', input.files[0]);
  try {
    const res = await fetch('/api/admin/import-db', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      alert('База данных успешно восстановлена!');
      location.reload();
    } else {
      alert(data.error || 'Ошибка восстановления базы');
    }
  } catch (e) {
    alert('Ошибка соединения при импорте');
  } finally {
    input.value = '';
  }
}
