// === Telegram WebApp ===
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// === Состояние ===
let categories = [];
let menuItems = [];
let cart = [];
let activeCategory = null;
let phoneMask = null;

// === Инициализация ===
document.addEventListener('DOMContentLoaded', async () => {
  loadCart();
  await Promise.all([fetchCategories(), fetchMenu()]);
  renderCategories();
  renderMenu();
  updateCartUI();
  setupPhoneMask();
});

// === API ===
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
  }
}

async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    menuItems = await res.json();
  } catch (err) {
    console.error('Ошибка загрузки меню:', err);
  }
}

// === Категории ===
function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = '';

  // Кнопка "Все"
  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn' + (activeCategory === null ? ' active' : '');
  allBtn.textContent = 'Все';
  allBtn.onclick = () => {
    activeCategory = null;
    renderCategories();
    renderMenu();
  };
  container.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (activeCategory === cat.id ? ' active' : '');
    btn.textContent = cat.name;
    btn.onclick = () => {
      activeCategory = cat.id;
      renderCategories();
      renderMenu();
    };
    container.appendChild(btn);
  });
}

// === Меню ===
function renderMenu() {
  const grid = document.getElementById('menu-grid');
  const emptyState = document.getElementById('empty-state');

  let filtered = menuItems;
  if (activeCategory !== null) {
    filtered = menuItems.filter(item => item.category_id === activeCategory);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filtered.map(item => {
    const cartItem = cart.find(c => c.id === item.id);
    const qty = cartItem ? cartItem.quantity : 0;

    return `
      <div class="menu-card">
        ${item.image
          ? `<img class="menu-card-img" src="${item.image}" alt="${item.name}" loading="lazy">`
          : `<div class="menu-card-placeholder">🍽️</div>`
        }
        <div class="menu-card-body">
          <div class="menu-card-name">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="menu-card-desc">${escapeHtml(item.description)}</div>` : ''}
          <div class="menu-card-footer">
            <span class="menu-card-price">${item.price} ₽</span>
            ${qty > 0
              ? `<div class="qty-controls">
                   <button class="qty-btn qty-btn-minus" onclick="removeFromCart(${item.id})">−</button>
                   <span class="qty-value">${qty}</span>
                   <button class="qty-btn qty-btn-plus" onclick="addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">+</button>
                 </div>`
              : `<button class="btn-add" onclick="addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">+</button>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// === Корзина ===
function addToCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1
    });
  }
  saveCart();
  updateCartUI();
  renderMenu();

  // Haptic feedback
  if (tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }
}

function removeFromCart(itemId) {
  const idx = cart.findIndex(c => c.id === itemId);
  if (idx === -1) return;

  if (cart[idx].quantity > 1) {
    cart[idx].quantity--;
  } else {
    cart.splice(idx, 1);
  }
  saveCart();
  updateCartUI();
  renderMenu();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
  renderMenu();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartUI() {
  const count = getCartCount();
  const total = getCartTotal();

  // Шапка
  document.getElementById('header-cart-count').textContent = count;

  // FAB
  const fab = document.getElementById('cart-fab');
  if (count > 0) {
    fab.style.display = 'flex';
    document.getElementById('cart-fab-badge').textContent = count;
  } else {
    fab.style.display = 'none';
  }

  // Панель корзины
  const cartItemsEl = document.getElementById('cart-items');
  const cartEmpty = document.getElementById('cart-empty');
  const cartFooter = document.getElementById('cart-footer');

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '';
    cartEmpty.style.display = 'block';
    cartFooter.style.display = 'none';
    return;
  }

  cartEmpty.style.display = 'none';
  cartFooter.style.display = 'block';

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${item.price} ₽ × ${item.quantity} = ${item.price * item.quantity} ₽</div>
      </div>
      <div class="cart-item-controls">
        <button class="cart-qty-btn minus" onclick="removeFromCart(${item.id})">−</button>
        <span class="cart-qty-value">${item.quantity}</span>
        <button class="cart-qty-btn plus" onclick="addToCart({id:${item.id},name:'${item.name.replace(/'/g, "\\'")}',price:${item.price}})">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeItemCompletely(${item.id})">✕</button>
    </div>
  `).join('');

  document.getElementById('cart-total-amount').textContent = total + ' ₽';
  document.getElementById('form-total-amount').textContent = total + ' ₽';
}

function removeItemCompletely(itemId) {
  cart = cart.filter(c => c.id !== itemId);
  saveCart();
  updateCartUI();
  renderMenu();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCart() {
  try {
    const saved = localStorage.getItem('cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }
}

// === Тогглер корзины ===
function toggleCart() {
  const panel = document.getElementById('cart-panel');
  const overlay = document.getElementById('cart-overlay');
  const isOpen = panel.classList.contains('open');

  if (isOpen) {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    panel.classList.add('open');
    overlay.classList.add('open');
  }
}

// === Форма заказа ===
function openOrderForm() {
  if (cart.length === 0) return;
  toggleCart(); // Закрываем корзину
  document.getElementById('order-modal').style.display = 'flex';
  document.getElementById('form-total-amount').textContent = getCartTotal() + ' ₽';
}

function closeOrderForm() {
  document.getElementById('order-modal').style.display = 'none';
  clearFormErrors();
}

function setupPhoneMask() {
  const phoneInput = document.getElementById('phone-input');
  if (phoneInput && typeof IMask !== 'undefined') {
    phoneMask = IMask(phoneInput, {
      mask: '+{7} (000) 000-00-00'
    });
  }
}

function clearFormErrors() {
  document.querySelectorAll('.form-group.error').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error').forEach(el => el.remove());
}

function showFieldError(inputId, message) {
  const group = document.getElementById(inputId).closest('.form-group');
  group.classList.add('error');
  const errEl = document.createElement('div');
  errEl.className = 'form-error';
  errEl.textContent = message;
  group.appendChild(errEl);
}

async function submitOrder(e) {
  e.preventDefault();
  clearFormErrors();

  const phone = document.getElementById('phone-input').value;
  const address = document.getElementById('address-input').value.trim();
  const comment = document.getElementById('comment-input').value.trim();

  let hasError = false;

  // Валидация телефона (18 символов с маской: +7 (999) 999-99-99)
  if (!phone || phone.length < 18) {
    showFieldError('phone-input', 'Введите номер телефона полностью');
    hasError = true;
  }

  if (!address) {
    showFieldError('address-input', 'Введите адрес доставки');
    hasError = true;
  }

  if (hasError) return;

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправка...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        address,
        comment,
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity
        }))
      })
    });

    const data = await res.json();

    if (data.success) {
      closeOrderForm();
      clearCart();
      showSuccess();

      // Haptic feedback
      if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

      // Сброс формы
      document.getElementById('order-form').reset();
      if (phoneMask) phoneMask.value = '';
    } else {
      alert(data.error || 'Ошибка при создании заказа');
    }
  } catch (err) {
    console.error('Ошибка отправки заказа:', err);
    alert('Ошибка соединения. Попробуйте ещё раз.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить заказ';
  }
}

function showSuccess() {
  const overlay = document.getElementById('success-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 2500);
}

// === Утилиты ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
