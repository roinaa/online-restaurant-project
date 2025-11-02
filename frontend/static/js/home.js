document.addEventListener('DOMContentLoaded', () => {

    const featuredContainer = document.getElementById('featured-dishes-container');
    const API_FEATURED_URL = '/api/featured-dishes/';

    // რჩეული კერძების წამოღება
    async function fetchFeaturedDishes() {
            if (!featuredContainer) return;

            try {
                const response = await fetch(API_FEATURED_URL);
                if (!response.ok) throw new Error('Network response was not ok');

                let dishes = await response.json();

                renderFeaturedDishes(dishes);

                // ვამოწმებთ, რამდენი კერძია და ვმალავთ/ვაჩენთ ისრებს
                const carousel = document.getElementById('featuredDishCarousel');
                if (carousel) {
                    const prevButton = carousel.querySelector('.carousel-control-prev');
                    const nextButton = carousel.querySelector('.carousel-control-next');

                    if (dishes.length <= 3) {
                        prevButton.style.display = 'none';
                        nextButton.style.display = 'none';
                    } else {
                        prevButton.style.display = 'block';
                        nextButton.style.display = 'block';
                    }
                }

        } catch (error) {
            console.error('Error fetching featured dishes:', error);
            featuredContainer.innerHTML = '<p class="text-center text-danger">Could not load featured dishes.</p>';
        }
    }

    // რჩეული კერძების ჩატვირთვა
   function renderFeaturedDishes(dishes) {
            featuredContainer.innerHTML = '';

            if (dishes.length === 0) {
                featuredContainer.innerHTML = '<p class="text-center text-muted">No featured dishes available right now.</p>';
                return;
            }

            for (let i = 0; i < dishes.length; i += 3) {
                const dishesChunk = dishes.slice(i, i + 3);

                // ვქმნით Carousel Item-ს
                const carouselItem = document.createElement('div');
                carouselItem.className = 'carousel-item';
                if (i === 0) {
                    carouselItem.classList.add('active');
                }

                // ვქმნით Bootstrap-ის row-ს სლაიდის შიგნით
                const row = document.createElement('div');
                row.className = 'row justify-content-center';

                // ამ 3 კერძს ვამატებთ row-ში
                dishesChunk.forEach(dish => {
                    const dishCard = createDishCard(dish);
                    row.appendChild(dishCard);
                });

                // ვამატებთ ყველაფერს
                carouselItem.appendChild(row);
                featuredContainer.appendChild(carouselItem);
            }
        }

    function createDishCard(dish) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';

        const imageUrl = dish.image ? dish.image : 'https://via.placeholder.com/300x200.png?text=No+Image';
        const nutsIcon = dish.has_nuts ? '<i class="bi bi-check-circle-fill icon icon-true"></i>' : '<i class="bi bi-circle icon icon-false"></i>';
        const vegIcon = dish.is_vegetarian ? '<i class="bi bi-check-circle-fill icon icon-true"></i>' : '<i class="bi bi-circle icon icon-false"></i>';

        col.innerHTML = `
            <div class="dish-card">
                <img src="${imageUrl}" class="dish-card-img-top" alt="${dish.name}">
                <div class="dish-card-body">
                    <h5 class="dish-card-title">${dish.name}</h5>
                    <div class="dish-spiciness">
                        Spiciness: ${dish.spiciness_display || dish.spiciness}
                    </div>
                    <div class="dish-properties">
                        <span class="me-3">${nutsIcon} Nuts</span>
                        <span>${vegIcon} Vegetarian</span>
                    </div>
                    <div class="dish-card-footer">
                        <span class="dish-price">$${parseFloat(dish.price).toFixed(2)}</span>
                        <button class="btn btn-add-to-cart" data-dish-id="${dish.id}">Add to cart</button>
                    </div>
                </div>
            </div>
        `;
        return col;
    }

    const csrftoken = getCookie('csrftoken');
    const cartCountElement = document.getElementById('cart-count');

    featuredContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-add-to-cart')) {
            e.preventDefault();
            const token = localStorage.getItem('authToken');

            if (!token) {
                showGlobalAlert('Please log in to add items to your cart.', 'warning');
                setTimeout(() => { window.location.href = '/login/'; }, 1500);
                return;
            }

            const dishId = e.target.dataset.dishId;

            try {
                const response = await fetch('/api/cart/add/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({ dish_id: dishId, quantity: 1 })
                });

                if (response.ok) {
                    e.target.textContent = 'Added!';
                    setTimeout(() => { e.target.textContent = 'Add to cart'; }, 1000);
                    const cartData = await response.json();
                    const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
                    if (cartCountElement) {
                        cartCountElement.textContent = totalItems;
                    }
                } else {
                    showGlobalAlert('Failed to add item to cart.', 'danger');
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                showGlobalAlert('An error occurred.', 'danger');
            }
        }
    });

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


    fetchFeaturedDishes();
});