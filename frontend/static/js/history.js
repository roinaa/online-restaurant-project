document.addEventListener('DOMContentLoaded', () => {

    const historyContainer = document.getElementById('order-history-container');
    const token = localStorage.getItem('authToken');

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');

    // შეკვეთების ისტორიის ჩატვირთვა
    async function loadOrderHistory() {
        if (!token) {
            historyContainer.innerHTML = '<p class="text-center p-4 text-muted">Please <a href="/login/">log in</a> to view your order history.</p>';
            return;
        }

        try {
            //  ვიძახებთ ახალ API ენდფოინთს
            const response = await fetch('/api/orders/history/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    historyContainer.innerHTML = '<p class="text-center p-4 text-muted">Your session expired. Please <a href="/login/">log in</a> again.</p>';
                    localStorage.removeItem('authToken');
                } else {
                    throw new Error('Failed to fetch history');
                }
                return;
            }

            const orders = await response.json();
            renderOrderHistory(orders);

        } catch (error) {
            console.error('Error loading order history:', error);
            historyContainer.innerHTML = '<p class="text-center p-4 text-danger">Could not load your history. Please try again later.</p>';
        }
    }

    function renderOrderHistory(orders) {
        historyContainer.innerHTML = '';

        if (orders.length === 0) {
            historyContainer.innerHTML = '<p class="text-center p-4 text-muted">You have no completed orders yet.</p>';
            return;
        }

        // ვქმნით თითოეული შეკვეთის ბარათს
        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'cart-table-container mb-4';

            let itemsHtml = '';
            order.items.forEach(item => {
                const itemTotal = (item.price_at_order * item.quantity).toFixed(2);
                itemsHtml += `
                    <div class="cart-item-row">
                        <div class="cart-col product">
                            <img src="${item.dish_image ? item.dish_image : 'https://via.placeholder.com/60x60'}" alt="${item.dish_name}">
                            <span>${item.dish_name}</span>
                        </div>
                        <div class="cart-col qty">x ${item.quantity}</div>
                        <div class="cart-col price">$${parseFloat(item.price_at_order).toFixed(2)}</div>
                        <div class="cart-col total">$${itemTotal}</div>
                    </div>
                `;
            });

            orderCard.innerHTML = `
                <div class="cart-header-row d-flex justify-content-between flex-wrap">
                    <span><strong>Order ID:</strong> #${order.id}</span>
                    <span><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</span>
                    <span class="fs-5 mt-2 mt-md-0"><strong>Total: <span class="text-danger">$${parseFloat(order.total_price).toFixed(2)}</span></strong></span>
                </div>
                <div class="cart-body">
                    ${itemsHtml}
                </div>
            `;
            historyContainer.appendChild(orderCard);
        });
    }

    loadOrderHistory();
});