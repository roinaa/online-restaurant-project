document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('authToken');

    //პროფილის ფორმის ველები
    const profileForm = document.getElementById('profile-form');
    const emailField = document.getElementById('profile-email'); // ★ ახალი
    const usernameField = document.getElementById('profile-username');
    const phoneField = document.getElementById('profile-phone');
    const addressField = document.getElementById('profile-address');
    const cityField = document.getElementById('profile-city');
    const profileError = document.getElementById('profile-error');
    const profileSuccess = document.getElementById('profile-success');

    //პაროლის ფორმის ველები
    const passwordForm = document.getElementById('password-form');
    const oldPasswordField = document.getElementById('old-password');
    const newPasswordField = document.getElementById('new-password');
    const confirmPasswordField = document.getElementById('confirm-password');
    const passwordError = document.getElementById('password-error');
    const passwordSuccess = document.getElementById('password-success');

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

    // პროფილის მონაცემების ჩატვირთვა გვერდის გახსნისას
    async function loadProfile() {
        if (!token) {
            window.location.href = '/login/';
            return;
        }

        try {
            const response = await fetch('/api/profile/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch profile');

            const profileData = await response.json();

            // ვავსებთ ფორმის ველებს
            if (emailField) emailField.value = profileData.email || '';
            if (usernameField) usernameField.value = profileData.username || '';
            if (phoneField) phoneField.value = profileData.phone_number || '';
            if (addressField) addressField.value = profileData.address_line_1 || '';
            if (cityField) cityField.value = profileData.city || '';

        } catch (error) {
            console.error('Error loading profile:', error);
            showError(profileError, 'Could not load profile data.');
        }
    }

    // პროფილის განახლების ლოგიკა
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const updatedData = {
                user: {
                    username: usernameField.value
                },
                phone_number: phoneField.value,
                address_line_1: addressField.value,
                city: cityField.value
            };

            try {
                const response = await fetch('/api/profile/', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify(updatedData)
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('username', data.username);
                    showSuccess(profileSuccess, 'Profile updated successfully!');
                } else {
                    const errorData = await response.json();
                    showError(profileError, Object.values(errorData).join(' '));
                }

            } catch (error) {
                console.error('Error updating profile:', error);
                showError(profileError, 'An error occurred while updating.');
            }
        });
    }

    // პაროლის შეცვლის ლოგიკა
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const old_password = oldPasswordField.value;
            const new_password = newPasswordField.value;
            const new_password_confirm = confirmPasswordField.value;

            if (new_password !== new_password_confirm) {
                showError(passwordError, 'New passwords do not match.');
                return;
            }

            try {
                const response = await fetch('/api/profile/change-password/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({
                        old_password: old_password,
                        new_password: new_password,
                        new_password_confirm: new_password_confirm
                    })
                });

                if (response.ok) {
                    showSuccess(passwordSuccess, 'Password updated successfully!');
                    passwordForm.reset();
                } else {
                    const errorData = await response.json();
                    showError(passwordError, Object.values(errorData).join(' '));
                }
            } catch (error) {
                console.error('Error changing password:', error);
                showError(passwordError, 'An error occurred.');
            }
        });
    }

    function showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
        if (profileSuccess) profileSuccess.style.display = 'none';
        if (passwordSuccess) passwordSuccess.style.display = 'none';
    }

    function showSuccess(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
        if (profileError) profileError.style.display = 'none';
        if (passwordError) passwordError.style.display = 'none';
    }

    loadProfile();
});