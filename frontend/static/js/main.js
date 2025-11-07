document.addEventListener('DOMContentLoaded', () => {

    // API მისამართები
    const API_CATEGORIES_URL = '/api/categories/';
    const API_DISHES_URL = '/api/dishes/';

    // DOM ელემენტები
    const categoriesContainer = document.getElementById('category-filter-list');
    const dishesContainer = document.getElementById('dishes-container');
    const filterForm = document.getElementById('filter-form');
    const spicinessSlider = document.getElementById('filter-spiciness');
    const spicinessLabel = document.getElementById('spiciness-label');
    const nutsCheckbox = document.getElementById('filter-nuts');
    const vegetarianCheckbox = document.getElementById('filter-vegetarian');
    const resetButton = document.getElementById('reset-filter');
    const cartCountElement = document.getElementById('cart-count');

    // გლობალური ცვლადები
    let allDishes = [];
    let currentFilters = {
        category: 'all',
        spiciness: null,
        has_nuts: null,
        is_vegetarian: null
    };

    const spicinessMap = {
        0: 'Not Chosen', 1: 'Not Spicy (0)', 2: 'Mild (1)',
        3: 'Medium (2)', 4: 'Hot (3)', 5: 'Very Hot (4)'
    };

    async function fetchCategories() {
        try {
            const response = await fetch(API_CATEGORIES_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const categories = await response.json();
            renderCategories(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            categoriesContainer.innerHTML = '<p class="text-danger">Failed to load categories.</p>';
        }
    }

    function renderCategories(categories) {
        if (!categoriesContainer) return;
        categoriesContainer.innerHTML = '';

        const allOption = document.createElement('div');
        allOption.className = 'form-check';
        allOption.innerHTML = `
            <input class="form-check-input" type="radio" name="category-filter" id="cat-all" value="all" checked>
            <label class="form-check-label" for="cat-all">
                All
            </label>
        `;
        categoriesContainer.appendChild(allOption);

        categories.forEach(category => {
            const option = document.createElement('div');
            option.className = 'form-check';
            option.innerHTML = `
                <input class="form-check-input" type="radio" name="category-filter" id="cat-${category.slug}" value="${category.slug}">
                <label class="form-check-label" for="cat-${category.slug}">
                    ${category.name}
                </label>
            `;
            categoriesContainer.appendChild(option);
        });

        addCategoryClickHandlers();
    }

    function addCategoryClickHandlers() {
        if (!categoriesContainer) return;

        categoriesContainer.querySelectorAll('input[name="category-filter"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                currentFilters.category = e.target.value;
            });
        });
    }

    // კერძების წამოღება და გამოჩენა
    async function fetchDishes(url = null) {

        let finalUrl = url;
        let baseUrlForPagination;

        if (!url) {
            const params = new URLSearchParams();
            if (currentFilters.category !== 'all') params.append('category', currentFilters.category);
            if (currentFilters.spiciness !== null) params.append('spiciness', currentFilters.spiciness);
            if (currentFilters.has_nuts === false) params.append('has_nuts', 'false');
            if (currentFilters.is_vegetarian === true) params.append('is_vegetarian', 'true');

            finalUrl = `${API_DISHES_URL}?${params.toString()}`;
            baseUrlForPagination = finalUrl;
        } else {
            let parsedUrl = new URL(url, window.location.origin);
            parsedUrl.searchParams.delete('page');
            baseUrlForPagination = parsedUrl.pathname + parsedUrl.search;
        }

        console.log('Fetching dishes from:', finalUrl);

        try {
            dishesContainer.innerHTML = '<p>Loading dishes...</p>';
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            allDishes = data.results;
            renderDishes(data.results);

            renderPagination(data, baseUrlForPagination);

        } catch (error) {
            console.error('Error fetching dishes:', error);
            dishesContainer.innerHTML = '<p class="text-danger">Failed to load dishes. Please try again.</p>';
        }
    }

    function renderDishes(dishes) {
        dishesContainer.innerHTML = '';
        if (dishes.length === 0) {
            dishesContainer.innerHTML = '<p class="text-muted">No dishes match the current filters.</p>';
            return;
        }
        dishes.forEach(dish => {
            const dishCard = createDishCard(dish);
            dishesContainer.appendChild(dishCard);
        });
    }

    function createDishCard(dish) {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-lg-4 mb-4';
        const imageUrl = dish.image ? dish.image : 'https://via.placeholder.com/300x200.png?text=No+Image';
        const nutsIcon = dish.has_nuts ? '<i class="bi bi-check-circle-fill icon icon-true"></i>' : '<i class="bi bi-circle icon icon-false"></i>';
        const vegIcon = dish.is_vegetarian ? '<i class="bi bi-check-circle-fill icon icon-true"></i>' : '<i class="bi bi-circle icon icon-false"></i>';

        col.innerHTML = `
            <div class="dish-card">
                <img src="${imageUrl}" class="dish-card-img-top" alt="${dish.name}">
                <div class="dish-card-body">
                    <h5 class="dish-card-title">${dish.name}</h5>
                    <div class="dish-rating mb-2">
                        <i class="bi bi-star-fill text-warning"></i>
                        <strong>${dish.average_rating} / 5.0</strong>
                        <span class="text-muted" style="font-size: 0.9rem;">(${dish.review_count} reviews)</span>
                    </div>
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

    // ფილტრების ლოგიკა
    spicinessSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        spicinessLabel.textContent = `Spiciness: ${spicinessMap[value]}`;
    });

    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const selectedCategory = document.querySelector('input[name="category-filter"]:checked');
            currentFilters.category = selectedCategory ? selectedCategory.value : 'all';

            const spicinessValue = parseInt(spicinessSlider.value, 10);
            currentFilters.spiciness = spicinessValue === 0 ? null : spicinessValue - 1;
            currentFilters.has_nuts = nutsCheckbox.checked ? false : null;
            currentFilters.is_vegetarian = vegetarianCheckbox.checked ? true : null;

            fetchDishes();
        });
    }

    filterForm.addEventListener('reset', () => {

        currentFilters.spiciness = null;
        currentFilters.has_nuts = null;
        currentFilters.is_vegetarian = null;
        currentFilters.category = 'all';

        if (spicinessLabel) spicinessLabel.textContent = 'Spiciness: Not Chosen';

        if (categoriesContainer) {
            const allRadio = document.getElementById('cat-all');
            if (allRadio) allRadio.checked = true;
        }

        setTimeout(() => {
            fetchDishes();
        }, 0);
    });


    const csrftoken = getCookie('csrftoken');

    async function updateCartCounter() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            if (cartCountElement) cartCountElement.textContent = '0';
            return;
        }

        try {
            const response = await fetch('/api/cart/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                }
            });

            if (response.ok) {
                const cartData = await response.json();
                const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
                if (cartCountElement) {
                    cartCountElement.textContent = totalItems;
                }
            } else {
                if (cartCountElement) cartCountElement.textContent = '0';
            }
        } catch (error) {
            console.error('Error fetching cart count:', error);
            if (cartCountElement) cartCountElement.textContent = '0';
        }
    }

    dishesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-add-to-cart')) {
            e.preventDefault();
            const token = localStorage.getItem('authToken');

            if (!token) {
                showGlobalAlert('Please log in to add items to your cart.', 'warning');
                window.location.href = '/login/';
                return;
            }

            const dishId = e.target.dataset.dishId;

            try {
                const response = await fetch('/api/cart/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({
                        dish_id: dishId,
                        quantity: 1
                    })
                });

                if (response.ok) {
                    const cartData = await response.json();
                    const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
                    if (cartCountElement) {
                        cartCountElement.textContent = totalItems;
                    }

                    e.target.textContent = 'Added!';
                    setTimeout(() => { e.target.textContent = 'Add to cart'; }, 1000);
                } else {
                    showGlobalAlert('Failed to add item to cart.', 'danger');
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                showGlobalAlert('An error occurred.', 'danger');
            }
        }
    });


    fetchCategories();
    fetchDishes();
    updateCartCounter();

    function renderPagination(data, baseUrl) {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';
        const pageSize = 9;
        const totalPages = Math.ceil(data.count / pageSize);

        if (totalPages <= 1) return;

        let currentPage = 1;
        if (data.previous) {
            try {
                let prevUrl = new URL(data.previous);
                currentPage = parseInt(prevUrl.searchParams.get('page') || '1', 10) + 1;
            } catch (e) {
                currentPage = 2;
            }
        } else if (data.next) {
            try {
                let nextUrl = new URL(data.next);
                currentPage = parseInt(nextUrl.searchParams.get('page'), 10) - 1;
            } catch (e) {
                currentPage = 1;
            }
        } else if (data.count > 0) {
            currentPage = 1;
        }

        let paginationHtml = '<nav><ul class="pagination">';

        paginationHtml += data.previous
            ? `<li class="page-item"><a class="page-link" href="#" data-url="${data.previous}">&laquo; Previous</a></li>`
            : `<li class="page-item disabled"><a class="page-link" href="#">&laquo; Previous</a></li>`;

        const linkSeparator = baseUrl.includes('?') ? '&' : '?';

        for (let i = 1; i <= totalPages; i++) {
            const pageUrl = `${baseUrl}${linkSeparator}page=${i}`;
            if (i === currentPage) {
                paginationHtml += `<li class="page-item active"><a class="page-link" href="#">${i}</a></li>`;
            } else {
                paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-url="${pageUrl}">${i}</a></li>`;
            }
        }

        paginationHtml += data.next
            ? `<li class="page-item"><a class="page-link" href="#" data-url="${data.next}">Next &raquo;</a></li>`
            : `<li class="page-item disabled"><a class="page-link" href="#">Next &raquo;</a></li>`;

        paginationHtml += '</ul></nav>';

        paginationContainer.innerHTML = paginationHtml;

        paginationContainer.querySelectorAll('a[data-url]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                fetchDishes(e.target.closest('[data-url]').dataset.url);
                window.scrollTo(0, 0);
            });
        });
    }

});