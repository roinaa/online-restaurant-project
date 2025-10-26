document.addEventListener('DOMContentLoaded', () => {

    const cartBody = document.getElementById('cart-body');
    const grandTotalElement = document.getElementById('cart-grand-total');
    const cartCountElement = document.getElementById('cart-count');
    const API_BASE_URL = 'http://127.0.0.1:8000';


    function getCart() {
        return JSON.parse(localStorage.getItem('cart')) || [];
    }

    function saveCart(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCounter();
        loadCartItems();
    }

    function updateCartCounter() {
        let cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountElement) {
            cartCountElement.textContent = totalItems;
        }
    }

    // Cart Rendering

    function loadCartItems() {
        let cart = getCart();
        cartBody.innerHTML = '';

        if (cart.length === 0) {
            cartBody.innerHTML = '<p class="text-center p-4 text-muted">Your cart is empty.</p>';
            updateGrandTotal();
            return;
        }

        cart.forEach(item => {
            const itemRow = createCartItemRow(item);
            cartBody.appendChild(itemRow);
        });

        updateGrandTotal();
    }

    function createCartItemRow(item) {
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.dataset.itemId = item.id;

        const itemTotal = item.price * item.quantity;
        const imageUrl = item.image ? item.image : 'https://via.placeholder.com/300x200.png?text=No+Image';

        row.innerHTML = `
            <div class="cart-col product">
                <button class="btn-remove-item" title="Remove item">&times;</button>
                <img src="${imageUrl}" alt="${item.name}">
                <span>${item.name}</span>
            </div>
            <div class="cart-col qty">
                <div class="quantity-control">
                    <button class="btn-qty minus" data-change="-1">-</button>
                    <input type="text" value="${item.quantity}" readonly>
                    <button class="btn-qty plus" data-change="1">+</button>
                </div>
            </div>
            <div class="cart-col price">$${parseFloat(item.price).toFixed(2)}</div>
            <div class="cart-col total">$${itemTotal.toFixed(2)}</div>
        `;
        return row;
    }

    function updateGrandTotal() {
        let cart = getCart();
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (grandTotalElement) {
            grandTotalElement.textContent = `$${total.toFixed(2)}`;
        }
    }

    // Event Handlers

    cartBody.addEventListener('click', (e) => {
        const row = e.target.closest('.cart-item-row');
        if (!row) return;

        const itemId = row.dataset.itemId;

        if (e.target.classList.contains('btn-remove-item')) {
            handleRemoveItem(itemId);
        }

        if (e.target.classList.contains('btn-qty')) {
            const change = parseInt(e.target.dataset.change, 10);
            handleQuantityChange(itemId, change);
        }
    });

    function handleRemoveItem(itemId) {
        let cart = getCart();
        cart = cart.filter(item => item.id != itemId);
        saveCart(cart);
    }

    function handleQuantityChange(itemId, change) {
        let cart = getCart();
        let item = cart.find(i => i.id == itemId);

        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                handleRemoveItem(itemId);
            } else {
                saveCart(cart);
            }
        }
    }

    loadCartItems();
    updateCartCounter();
});