document.addEventListener('DOMContentLoaded', () => {

    // API მისამართები
    const API_BASE_URL = 'http://127.0.0.1:8000';
    const API_CATEGORIES_URL = `${API_BASE_URL}/api/categories/`;
    const API_DISHES_URL = `${API_BASE_URL}/api/dishes/`;

    // DOM ელემენტები
    const categoriesContainer = document.getElementById('category-links');
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
        categoriesContainer.innerHTML = '';
        const allLink = createCategoryLink('All', 'all', true);
        categoriesContainer.appendChild(allLink);
        categories.forEach(category => {
            const categoryLink = createCategoryLink(category.name, category.slug);
            categoriesContainer.appendChild(categoryLink);
        });
        addCategoryClickHandlers();
    }

    function createCategoryLink(name, slug, isActive = false) {
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'nav-link category-link';
        if (isActive) link.classList.add('active');
        link.textContent = name;
        link.dataset.slug = slug;
        return link;
    }

    function addCategoryClickHandlers() {
        categoriesContainer.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                categoriesContainer.querySelector('.category-link.active')?.classList.remove('active');
                link.classList.add('active');
                currentFilters.category = link.dataset.slug;
                fetchDishes();
            });
        });
    }

    // კერძების წამოღება და გამოჩენა
    async function fetchDishes() {
        const params = new URLSearchParams();
        if (currentFilters.category !== 'all') params.append('category', currentFilters.category);
        if (currentFilters.spiciness !== null) params.append('spiciness', currentFilters.spiciness);
        if (currentFilters.has_nuts === false) params.append('has_nuts', 'false');
        if (currentFilters.is_vegetarian === true) params.append('is_vegetarian', 'true');

        const url = `${API_DISHES_URL}?${params.toString()}`;
        console.log('Fetching dishes from:', url);

        try {
            dishesContainer.innerHTML = '<p>Loading dishes...</p>';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const dishes = await response.json();
            allDishes = dishes;
            renderDishes(dishes);
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

    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const spicinessValue = parseInt(spicinessSlider.value, 10);
        currentFilters.spiciness = spicinessValue === 0 ? null : spicinessValue - 1;
        currentFilters.has_nuts = nutsCheckbox.checked ? false : null;
        currentFilters.is_vegetarian = vegetarianCheckbox.checked ? true : null;
        fetchDishes();
    });

    resetButton.addEventListener('click', () => {
        currentFilters.spiciness = null;
        currentFilters.has_nuts = null;
        currentFilters.is_vegetarian = null;
        spicinessLabel.textContent = 'Spiciness: Not Chosen';
        fetchDishes();
    });

    // კალათის ლოგიკა

    function getCart() {
        return JSON.parse(localStorage.getItem('cart')) || [];
    }

    function saveCart(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCounter();
    }

    function addToCart(dish) {
        let cart = getCart();
        let existingItem = cart.find(item => item.id === dish.id);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({
                id: dish.id,
                name: dish.name,
                price: dish.price,
                image: dish.image,
                quantity: 1
            });
        }
        saveCart(cart);
        console.log('Cart updated:', cart);
    }

    function updateCartCounter() {
        let cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountElement) {
            cartCountElement.textContent = totalItems;
        }
    }

    // კალათაში დამატების ღილაკის ლოგიკა
    dishesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-add-to-cart')) {
            const dishId = e.target.dataset.dishId;
            const dishToAdd = allDishes.find(d => d.id == dishId); // ვპოულობთ კერძს
            if (dishToAdd) {
                addToCart(dishToAdd);
                e.target.textContent = 'Added!';
                setTimeout(() => { e.target.textContent = 'Add to cart'; }, 1000);
            }
        }
    });

    fetchCategories();
    fetchDishes();
    updateCartCounter();
});