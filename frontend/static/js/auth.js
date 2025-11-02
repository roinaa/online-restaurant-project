document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Django-ს CSRF Token-ის წამოსაღები ფუნქცია
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


    // რეგისტრაციის ლოგიკა
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password-confirm').value;

            // პაროლების შემოწმება
            if (password !== passwordConfirm) {
                showError("Passwords do not match.");
                return;
            }

            try {
                const response = await fetch('/api/register/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showGlobalAlert('Registration successful! Please log in.', 'success');
                    window.location.href = '/login/'; //
                } else {
                    let errorMsg = 'Registration failed.';
                    if (typeof data === 'object' && data !== null) {
                        errorMsg = Object.values(data).join('\n');
                    }
                    showError(errorMsg);
                }
            } catch (error) {
                showError("An error occurred. Please try again.");
                console.error('Registration error:', error);
            }
        });
    }

    // ლოგინის ლოგიკა
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('username', data.username);
                    window.location.href = '/menu/';
                } else {
                    showError(data.detail || "Invalid credentials.");
                }
            } catch (error) {
                showError("An error occurred. Please try again.");
                console.error('Login error:', error);
            }
        });
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }
});