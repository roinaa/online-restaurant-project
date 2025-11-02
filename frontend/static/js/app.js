document.addEventListener('DOMContentLoaded', () => {

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


    const alertModalElement = document.getElementById('globalAlertModal');
    const bsAlertModal = new bootstrap.Modal(alertModalElement);
    const alertModalTitle = document.getElementById('globalAlertModalLabel');
    const alertModalBody = document.getElementById('globalAlertModalBody');
    //ნავიგაციის მართვა
    const token = localStorage.getItem('authToken');
    const authLinks = document.querySelectorAll('.auth-links');
    const userLinks = document.querySelectorAll('.user-links');

    if (token) {
        // მომხმარებელი დალოგინებულია
        authLinks.forEach(link => link.style.display = 'none');
        userLinks.forEach(link => link.style.display = 'block');
    } else {
        // მომხმარებელი სტუმარია
        authLinks.forEach(link => link.style.display = 'block');
        userLinks.forEach(link => link.style.display = 'none');
    }

    // ლოგაუთის ლოგიკა
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                await fetch('/api/logout/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                        'X-CSRFToken': csrftoken
                    }
                });
            } catch (error) {
                console.error('Logout API failed:', error);
            }

            localStorage.removeItem('authToken');
            localStorage.removeItem('username');

            window.location.href = '/';
        });
    }

    window.showGlobalAlert = (message, type = 'danger') => {
        alertModalBody.textContent = message;

        const header = alertModalElement.querySelector('.modal-header');
        header.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'text-white');
        alertModalTitle.textContent = 'Error';

        if (type === 'success') {
            alertModalTitle.textContent = 'Success';
            header.classList.add('bg-success', 'text-white');
        } else if (type === 'warning') {
            alertModalTitle.textContent = 'Warning';
            header.classList.add('bg-warning');
        } else {
             header.classList.add('bg-danger', 'text-white');
        }

        bsAlertModal.show();
    }


});