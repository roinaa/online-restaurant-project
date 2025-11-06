document.addEventListener('DOMContentLoaded', () => {

    const activeContainer = document.getElementById('active-reservations-container');
    const pastContainer = document.getElementById('past-reservations-container');
    const token = localStorage.getItem('authToken');
    const csrftoken = getCookie('csrftoken');

    const cancelModalElement = document.getElementById('cancelReservationModal');
    const bsCancelModal = new bootstrap.Modal(cancelModalElement);
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    let reservationToCancel = null;

    if (!token) {
        activeContainer.innerHTML = '<p class="text-center text-muted">Please <a href="/login/">log in</a> to view your reservations.</p>';
        pastContainer.innerHTML = '';
        return;
    }

    async function loadReservations() {
        activeContainer.innerHTML = '<p class="text-muted">Loading your active reservations...</p>';
        pastContainer.innerHTML = '<p class="text-muted">Loading your reservation history...</p>';

        try {
            const response = await fetch('/api/reservations/history/', {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load reservations.');
            }

            const data = await response.json();
            renderReservations(data.active, activeContainer, true);
            renderReservations(data.past, pastContainer, false);

        } catch (error) {
            activeContainer.innerHTML = `<p class="text-danger">${error.message}</p>`;
        }
    }

    function renderReservations(reservations, container, isActive) {
        if (reservations.length === 0) {
            container.innerHTML = `<p class="text-muted">${isActive ? 'You have no active reservations.' : 'You have no past reservations.'}</p>`;
            return;
        }

        container.innerHTML = '';
        reservations.forEach(res => {
            const card = document.createElement('div');
            card.className = 'card mb-3';

            let cancelButtonHtml = '';
            if (isActive && res.status === 'Confirmed') {
                cancelButtonHtml = `
                    <button class="btn btn-sm btn-outline-danger btn-cancel-reservation" data-id="${res.id}">
                        Cancel Reservation
                    </button>
                `;
            }

            let statusBadge = 'secondary';
            if (res.status === 'Confirmed') statusBadge = 'success';
            if (res.status === 'Cancelled') statusBadge = 'danger';

            card.innerHTML = `
                <div class="card-body d-flex justify-content-between align-items-center flex-wrap">
                    <div>
                        <h5 class="card-title">${res.table.name} (${res.party_size} Guests)</h5>
                        <p class="card-text mb-0">
                            <strong>Date:</strong> ${new Date(res.start_time_display).toLocaleDateString()}
                        </p>
                        <p class="card-text">
                            <strong>Time:</strong>
                            ${new Date(res.start_time_display).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            -
                            ${new Date(res.end_time_display).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                    <div class="text-center">
                        <span class="badge bg-${statusBadge} fs-6 mb-2 d-block" style="width: 100px;">${res.status}</span>
                        ${cancelButtonHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }



    activeContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-cancel-reservation')) {
            reservationToCancel = e.target.dataset.id;
            bsCancelModal.show();
        }
    });

    confirmCancelBtn.addEventListener('click', async () => {
        if (!reservationToCancel) return;

        bsCancelModal.hide();

        try {
            const response = await fetch(`/api/reservations/cancel/${reservationToCancel}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to cancel.');
            }

            loadReservations();
            showGlobalAlert('Reservation cancelled successfully.', 'success');

        } catch (error) {
            showGlobalAlert(error.message, 'danger');
        } finally {
            reservationToCancel = null;
        }
    });

    loadReservations();
});