document.addEventListener('DOMContentLoaded', () => {

    const historyContainer = document.getElementById('order-history-container');
    const token = localStorage.getItem('authToken');

    // ცვლადები
    const reviewModalElement = document.getElementById('reviewModal');
    const bsReviewModal = new bootstrap.Modal(reviewModalElement);
    const reviewForm = document.getElementById('review-form');
    const reviewModalLabel = document.getElementById('reviewModalLabel');
    const reviewRating = document.getElementById('review-rating');
    const reviewComment = document.getElementById('review-comment');
    const reviewDishId = document.getElementById('review-dish-id');
    const reviewErrorMessage = document.getElementById('review-error-message');



    const csrftoken = getCookie('csrftoken');


    // შეკვეთების ისტორიის ჩატვირთვა
    async function loadOrderHistory() {
        if (!token) {
            historyContainer.innerHTML = '<p class="text-center p-4 text-muted">Please <a href="/login/">log in</a> to view your order history.</p>';
            return;
        }

        try {
            const response = await fetch('/api/orders/history/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                }
            });

            if (!response.ok) {
                // შეცდომის დამუშავება
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

    // ისტორიის ჩატვირთვა
    function renderOrderHistory(orders) {
        historyContainer.innerHTML = '';

        if (orders.length === 0) {
            historyContainer.innerHTML = '<p class="text-center p-4 text-muted">You have no completed orders yet.</p>';
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'cart-table-container mb-4';

            let itemsHtml = '';
            order.items.forEach(item => {
                const itemTotal = (item.price_at_order * item.quantity).toFixed(2);

                let reviewButtonHtml = '';

                if (item.is_reviewed) {
                    reviewButtonHtml = `
                        <button class="btn btn-outline-success btn-sm ms-2" disabled>
                            Reviewed
                        </button>`;
                } else {
                    reviewButtonHtml = `
                        <button class="btn btn-outline-danger btn-sm ms-2 btn-review"
                            data-dish-id="${item.dish}"
                            data-dish-name="${item.dish_name}">
                            Leave Review
                        </button>`;
                }

                itemsHtml += `
                    <div class="cart-item-row">
                        <div class="cart-col product">
                            <img src="${item.dish_image ? item.dish_image : 'https://via.placeholder.com/60x60'}" alt="${item.dish_name}">
                            <span>${item.dish_name}</span>
                        </div>
                        <div class="cart-col qty">x ${item.quantity}</div>
                        <div class="cart-col price">$${parseFloat(item.price_at_order).toFixed(2)}</div>
                        <div class="cart-col total">
                            <span>$${itemTotal}</span>
                            ${reviewButtonHtml} </div>
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


    // Review ღილაკზე დაჭერის ლოგიკა
    historyContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-review')) {
            const dishId = e.target.dataset.dishId;
            const dishName = e.target.dataset.dishName;

            reviewForm.reset();
            reviewErrorMessage.style.display = 'none';
            reviewModalLabel.textContent = `Leave a Review for: ${dishName}`;
            reviewDishId.value = dishId;

            bsReviewModal.show();
        }
    });

    // Review-ს გაგზავნის ლოგიკა
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const dishId = reviewDishId.value;
        const rating = reviewRating.value;
        const comment = reviewComment.value;

        if (!rating) {
            reviewErrorMessage.textContent = 'Please select a rating.';
            reviewErrorMessage.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/reviews/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    dish: dishId,
                    rating: parseInt(rating),
                    comment: comment
                })
            });

            if (response.ok) {
                bsReviewModal.hide();
                showGlobalAlert('Thank you! Your review has been submitted.', 'success');
                const reviewedButton = historyContainer.querySelector(`.btn-review[data-dish-id="${dishId}"]`);
                if (reviewedButton) {
                    reviewedButton.textContent = 'Reviewed';
                    reviewedButton.disabled = true;
                    reviewedButton.classList.remove('btn-review');
                    reviewedButton.classList.remove('btn-outline-danger');
                    reviewedButton.classList.add('btn-outline-success');
                }
            } else {
                const errorData = await response.json();
                let errorMsg = Object.values(errorData).join(' ');
                if (errorMsg.includes('already exists')) {
                    errorMsg = "You have already reviewed this dish.";
                }
                reviewErrorMessage.textContent = errorMsg;
                reviewErrorMessage.style.display = 'block';
            }

        } catch (error) {
            console.error('Error submitting review:', error);
            reviewErrorMessage.textContent = 'An error occurred. Please try again.';
            reviewErrorMessage.style.display = 'block';
        }
    });

    loadOrderHistory();
});