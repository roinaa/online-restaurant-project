document.addEventListener('DOMContentLoaded', () => {

    const cartBody = document.getElementById('cart-body');
    const grandTotalElement = document.getElementById('cart-grand-total');
    const cartCountElement = document.getElementById('cart-count');
    const checkoutButton = document.getElementById('proceed-to-checkout');
    const checkoutModalElement = document.getElementById('checkoutConfirmModal');
    const bsCheckoutModal = new bootstrap.Modal(checkoutModalElement);
    const confirmOrderBtn = document.getElementById('confirm-order-btn');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const clearCartModalElement = document.getElementById('clearCartConfirmModal');
    const bsClearCartModal = new bootstrap.Modal(clearCartModalElement);
    const confirmClearCartBtn = document.getElementById('confirm-clear-cart-btn');
    const couponInput = document.getElementById('coupon-input');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponMessage = document.getElementById('coupon-message');
    const couponForm = document.getElementById('coupon-form');
    const activeCouponDisplay = document.getElementById('active-coupon-display');
    const removeCouponModalElement = document.getElementById('removeCouponConfirmModal');
    const bsRemoveCouponModal = new bootstrap.Modal(removeCouponModalElement);
    const confirmRemoveCouponBtn = document.getElementById('confirm-remove-coupon-btn');

    const token = localStorage.getItem('authToken');

    const csrftoken = getCookie('csrftoken');

    function updateCartCounter(cartData) {
        if (!cartData || !cartData.items) {
            if (cartCountElement) cartCountElement.textContent = '0';
            return;
        }
        const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountElement) {
            cartCountElement.textContent = totalItems;
        }
    }

    // კალათის HTML-ში დახატვა
    async function loadCartItems() {
        // ვამოწმებთ, დალოგინებულია თუ არა მომხმარებელი
        if (!token) {
            cartBody.innerHTML = '<p class="text-center p-4 text-muted">Please <a href="/login/">log in</a> to view your cart.</p>';
            if (checkoutButton) checkoutButton.disabled = true;
            return;
        }

        // ვიღებთ კალათას Backend-იდან
        try {
            const response = await fetch('/api/cart/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                }
            });

            if (!response.ok) {
                if (response.status === 401) { // Unauthorized
                     cartBody.innerHTML = '<p class="text-center p-4 text-muted">Your session expired. Please <a href="/login/">log in</a> again.</p>';
                     localStorage.removeItem('authToken');
                } else {
                    throw new Error('Failed to fetch cart');
                }
                return;
            }

            const cartData = await response.json();
            renderCart(cartData);

        } catch (error) {
            console.error('Error loading cart:', error);
            cartBody.innerHTML = '<p class="text-center p-4 text-danger">Could not load cart. Please try again later.</p>';
        }
    }

    function renderCart(cartData) {
        cartBody.innerHTML = '';

        if (!cartData.items || cartData.items.length === 0) {
            cartBody.innerHTML = '<p class="text-center p-4 text-muted">Your cart is empty.</p>';
            if (checkoutButton) checkoutButton.disabled = true;

            if (clearCartBtn) {
                clearCartBtn.disabled = true;
                clearCartBtn.classList.remove('btn-outline-danger');
                clearCartBtn.classList.add('text-secondary');

                clearCartBtn.style.fontWeight = 'bold';
                clearCartBtn.style.textTransform = 'uppercase';
                clearCartBtn.style.textDecoration = 'none';
                clearCartBtn.style.border = 'none';
            }
        } else {
            cartBody.innerHTML = '';
            cartData.items.forEach(item => {
                const itemRow = createCartItemRow(item);
                cartBody.appendChild(itemRow);
            });
            if (checkoutButton) checkoutButton.disabled = false;

            if (clearCartBtn) {
                clearCartBtn.disabled = false;
                clearCartBtn.classList.add('btn-outline-danger');
                clearCartBtn.classList.remove('text-secondary');

                // ვაბრუნებთ სტილებს
                clearCartBtn.style.fontWeight = '';
                clearCartBtn.style.textTransform = '';
                clearCartBtn.style.textDecoration = '';
                clearCartBtn.style.border = '';
            }
        }

        // ვანახლებთ ჯამურ ფასს და მრიცხველს
        if (grandTotalElement) {
            grandTotalElement.textContent = `$${parseFloat(cartData.total_price).toFixed(2)}`;
        }
        updateCartCounter(cartData);

        if (cartData.coupon) {
            couponForm.style.display = 'none';
            activeCouponDisplay.style.display = 'block';
            activeCouponDisplay.innerHTML = `
                <div class="alert alert-success d-flex justify-content-between align-items-center">
                    <span>
                        Applied: <strong>${cartData.coupon.code}</strong> (-${cartData.coupon.discount_percent}%)
                    </span>
                    <button class="btn-close" id="remove-active-coupon-btn" title="Remove Coupon"></button>
                </div>
            `;
            document.getElementById('remove-active-coupon-btn').addEventListener('click', removeCoupon);
        } else {
            couponForm.style.display = 'block';
            activeCouponDisplay.style.display = 'none';
        }
    }


    function createCartItemRow(item) {
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.dataset.itemId = item.id;

        // ვითვლით ამ რიგის ჯამურ ფასს
        const itemTotal = item.price_at_order * item.quantity;
        const imageUrl = item.dish_image ? item.dish_image : 'https://via.placeholder.com/300x200.png?text=No+Image';

        row.innerHTML = `
            <div class="cart-col product">
                <button class="btn-remove-item" title="Remove item">&times;</button>
                <img src="${imageUrl}" alt="${item.dish_name}">
                <span>${item.dish_name}</span>
            </div>
            <div class="cart-col qty">
                <div class="quantity-control">
                    <button class="btn-qty minus" data-change="-1">-</button>
                    <input type="text" value="${item.quantity}" readonly>
                    <button class="btn-qty plus" data-change="1">+</button>
                </div>
            </div>
            <div class="cart-col price">$${parseFloat(item.price_at_order).toFixed(2)}</div>
            <div class="cart-col total">$${itemTotal.toFixed(2)}</div>
        `;
        return row;
    }

    //Event Handlers (ღილაკებზე დაჭერა)

    cartBody.addEventListener('click', (e) => {
        const row = e.target.closest('.cart-item-row');
        if (!row) return;

        const itemId = row.dataset.itemId;

        // წაშლის ღილაკი
        if (e.target.classList.contains('btn-remove-item')) {
            handleRemoveItem(itemId);
        }

        // რაოდენობის ცვლილების ღილაკები
        if (e.target.classList.contains('btn-qty')) {
            const change = parseInt(e.target.dataset.change, 10);
            const currentQuantity = parseInt(row.querySelector('input').value, 10);
            const newQuantity = currentQuantity + change;

            if (newQuantity > 0) {
                handleQuantityChange(itemId, newQuantity);
            } else {
                handleRemoveItem(itemId);
            }
        }
    });

    async function handleRemoveItem(itemId) {
        try {
            const response = await fetch('/api/cart/', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ item_id: itemId })
            });

            if (response.ok) {
                const cartData = await response.json();
                renderCart(cartData);
            } else {
                showGlobalAlert('Failed to remove item.', 'danger');
            }
        } catch (error) {
            console.error('Error removing item:', error);
            showGlobalAlert('An error occurred.', 'danger');
        }
    }

    async function handleQuantityChange(itemId, newQuantity) {
        try {
            const response = await fetch('/api/cart/', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    item_id: itemId,
                    quantity: newQuantity
                })
            });

            if (response.ok) {
                const cartData = await response.json();
                renderCart(cartData);
            } else {
                showGlobalAlert('Failed to update quantity.', 'danger');
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            showGlobalAlert('An error occurred.', 'danger');
        }
    }

  // Checkout ღილაკის ლოგიკა

    if (checkoutButton) {
        checkoutButton.addEventListener('click', () => {
            if (!token) {
                showGlobalAlert('Please log in to place an order.', 'warning');
                setTimeout(() => {
                    window.location.href = '/login/';
                }, 1500);
                return;
            }
            bsCheckoutModal.show();
        });
    }

    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', async () => {
            bsCheckoutModal.hide();
            try {
                // ვიძახებთ შეკვეთის განთავსების API-ს
                const response = await fetch('/api/orders/place/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    }
                });

                if (response.ok) {
                    showGlobalAlert('Order placed successfully!', 'success');

                    setTimeout(() => {
                        window.location.href = '/history/';
                    }, 1500);

                } else {
                    const errorData = await response.json();
                    showGlobalAlert(`Failed to place order: ${errorData.error}`, 'danger');
                }
            } catch (error) {
                console.error('Error placing order:', error);
                showGlobalAlert('An error occurred.', 'danger');
            }
        });
    }


    loadCartItems();


    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            bsClearCartModal.show();
        });
    }

    if (confirmClearCartBtn) {
        confirmClearCartBtn.addEventListener('click', async () => {
            bsClearCartModal.hide();

            try {
                const response = await fetch('/api/cart/', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({}) // ცარიელი ობიექტი
                });

                if (response.ok) {
                    const cartData = await response.json();
                    renderCart(cartData); // ვარენდერებ განულებულ კალათას
                    showGlobalAlert('Cart cleared successfully.', 'success');
                } else {
                    throw new Error('Failed to clear cart.');
                }
            } catch (error) {
                console.error('Error clearing cart:', error);
                showGlobalAlert(error.message, 'danger');
            }
        });
    }


    // კუპონის წაშლის ფუნქცია
    async function removeCoupon() {
        couponMessage.textContent = 'Removing coupon...';
        couponMessage.className = 'mt-2 text-info';

        try {
            const response = await fetch('/api/cart/remove-coupon/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                }
            });

            const data = await response.json();
            if (response.ok) {
                renderCart(data);
                couponMessage.textContent = 'Coupon removed.';
                setTimeout(() => { couponMessage.textContent = '' }, 3000);
            } else {
                couponMessage.textContent = data.error || 'Failed to remove coupon.';
                couponMessage.className = 'mt-2 text-danger';
            }
        } catch (error) {
            couponMessage.textContent = 'An error occurred while removing the coupon.';
            couponMessage.className = 'mt-2 text-danger';
        }
    }

    // Modal-ის დადასტურების ღილაკის ლოგიკა
    if (confirmRemoveCouponBtn) {
        confirmRemoveCouponBtn.addEventListener('click', () => {
            bsRemoveCouponModal.hide();
            removeCoupon();
        });
    }

    // კუპონის დამატების ლოგიკა
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponInput.value.trim();
            if (!code) return;

            applyCouponBtn.disabled = true;
            applyCouponBtn.textContent = 'Applying...';
            couponMessage.textContent = '';

            try {
                const response = await fetch('/api/cart/apply-coupon/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}`, 'X-CSRFToken': csrftoken },
                    body: JSON.stringify({ coupon_code: code })
                });

                const data = await response.json();

                if (response.ok) {
                    renderCart(data);
                    couponInput.value = '';
                    couponMessage.textContent = 'Coupon applied successfully!';
                    couponMessage.className = 'mt-2 text-success';
                    setTimeout(() => {
                        couponMessage.textContent = '';
                    }, 3000);
                } else {
                    if (response.status === 409) {
                        bsRemoveCouponModal.show();
                    } else {
                        couponMessage.textContent = data.error || 'Invalid coupon code.';
                        couponMessage.className = 'mt-2 text-danger';
                    }
                }
            } catch (error) {
                couponMessage.textContent = 'An error occurred.';
                couponMessage.className = 'mt-2 text-danger';
            } finally {
                applyCouponBtn.disabled = false;
                applyCouponBtn.textContent = 'Apply';
            }
        });
    }

});