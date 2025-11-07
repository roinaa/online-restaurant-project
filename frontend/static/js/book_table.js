document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('authToken');
    const csrftoken = getCookie('csrftoken');

    const wizardContainer = document.getElementById('booking-wizard');
    const partySizeInput = document.getElementById('party-size');
    const partySizeError = document.getElementById('party-size-error');
    const slotsContainer = document.getElementById('time-slots-container');
    const bookingActions = document.getElementById('booking-actions');
    const bookingSummary = document.getElementById('booking-summary');
    const bookingError = document.getElementById('booking-error');
    const bookNowBtn = document.getElementById('btn-book-now');

    if (!token) {
        wizardContainer.innerHTML = '<p class="text-center text-muted">Please <a href="/login/">log in</a> to make a reservation.</p>';
        return;
    }

    let selectedTableId = null;
    let selectedDate = null;
    let selectedStartTime = null;
    let selectedEndTime = null;
    let availableSlots = [];
    let closingTime = "23:00"; // Default

    function checkAndLoadSlots() {
        resetTimeStep();

        const partySize = parseInt(partySizeInput.value, 10);

        if (isNaN(partySize) || partySize < 1 || partySize > 12) {
            return;
        }

        if (!selectedDate) {
            return;
        }

        if (partySize <= 2) { selectedTableId = 1; }
        else if (partySize <= 4) { selectedTableId = 2; }
        else if (partySize <= 6) { selectedTableId = 3; }
        else if (partySize <= 8) { selectedTableId = 4; }
        else if (partySize <= 10) { selectedTableId = 5; }
        else if (partySize <= 12) { selectedTableId = 6; }

        loadAvailableSlots(selectedDate, selectedTableId);
    }

    partySizeInput.addEventListener('input', () => {
        const partySize = parseInt(partySizeInput.value, 10);
        partySizeError.textContent = '';

        if (partySize > 12) {
            partySizeError.textContent = 'For parties larger than 12, please contact the restaurant directly at +123 456 789.';
        } else if (partySize < 1 && partySizeInput.value !== '') {
             partySizeError.textContent = 'Party size must be at least 1.';
        }

        checkAndLoadSlots();
    });

    const datePicker = flatpickr("#datepicker", {
        theme: "dark",
        minDate: "today",
        maxDate: new Date().fp_incr(7),
        disableMobile: true,
        onChange: function(selectedDates, dateStr, instance) {
            selectedDate = dateStr;
            checkAndLoadSlots();
        }
    });

    function resetTimeStep() {

        bookingActions.style.display = 'none';
        selectedStartTime = null;
        selectedEndTime = null;
        bookNowBtn.disabled = true;
    }

    async function loadAvailableSlots(dateStr, tableId) {
        slotsContainer.innerHTML = '<p class="text-muted">Loading available times...</p>';

        try {
            const response = await fetch(`/api/reservations/availability/?date=${dateStr}&table_id=${tableId}`, {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load slots.');
            }

            availableSlots = await response.json();

            const lastSlot = [...availableSlots].reverse().find(s => s.available);
            if(lastSlot) {
                let [hours, minutes] = lastSlot.time.split(':').map(Number);
                let dt = new Date();
                dt.setHours(hours, minutes, 0);
                dt.setMinutes(dt.getMinutes() + 30);
                closingTime = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }

            renderTimeSlots();
        } catch (error) {
            slotsContainer.innerHTML = `<p class="text-danger">${error.message}</p>`;
        }
    }

    function renderTimeSlots() {
        slotsContainer.innerHTML = '';
        let availableSlotsFound = false;

        availableSlots.forEach((slot, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn time-slot-btn';
            btn.dataset.time = slot.time;
            btn.textContent = slot.time;

            btn.addEventListener('click', handleSlotClick);

            let isVisuallyAvailable = slot.available;

            if (!slot.available && index > 0) {
                const prevSlot = availableSlots[index - 1];
                if (prevSlot.available) {
                    isVisuallyAvailable = true;
                }
            }

            if (isVisuallyAvailable) {
                availableSlotsFound = true;
                btn.classList.add('btn-outline-danger');
            } else {
                btn.classList.add('btn-outline-secondary');
            }
            slotsContainer.appendChild(btn);
        });

        if (!availableSlotsFound && availableSlots.length > 0) {
            slotsContainer.innerHTML = '<p class="text-danger">Sorry, no available time slots for this table on the selected date.</p>';
        }
    }

    function handleSlotClick(e) {
        const clickedTime = e.target.dataset.time;
        const slot = availableSlots.find(s => s.time === clickedTime);

        if (!selectedStartTime) {
            if (!slot.available) {
                return;
            }
            selectedStartTime = clickedTime;
            e.target.classList.remove('btn-outline-secondary');
            e.target.classList.add('active');
            updateSlotAvailability(clickedTime);

        } else if (!selectedEndTime) {

            if (clickedTime === selectedStartTime) {
                resetSlotSelection();
                return;
            }

            if (clickedTime < selectedStartTime) {
                resetSlotSelection();
                if (slot.available) {
                    selectedStartTime = clickedTime;
                    e.target.classList.remove('btn-outline-secondary');
                    e.target.classList.add('active');
                    updateSlotAvailability(clickedTime);
                }
                return;
            }

            const slotsBetween = availableSlots.filter(s => s.time >= selectedStartTime && s.time < clickedTime);
            if (slotsBetween.some(s => !s.available)) {
                bookingActions.style.display = 'block';
                bookingError.textContent = 'Your selection includes an unavailable time slot. Please select a valid range.';
                bookNowBtn.disabled = true;
                return;
            }

            selectedEndTime = clickedTime;
            e.target.classList.remove('btn-outline-secondary');
            e.target.classList.add('active');
            highlightSlotRange();

        } else {
            const clickedIsStart = (clickedTime === selectedStartTime);
            const clickedIsEnd = (clickedTime === selectedEndTime);

            resetSlotSelection();

            if (!clickedIsStart && !clickedIsEnd && slot.available) {
                selectedStartTime = clickedTime;
                e.target.classList.remove('btn-outline-secondary');
                e.target.classList.add('active');
                updateSlotAvailability(clickedTime);
            }
        }
    }

    function resetSlotSelection() {
        selectedStartTime = null;
        selectedEndTime = null;
        bookingActions.style.display = 'none';
        bookNowBtn.disabled = true;
        bookingError.textContent = '';

        slotsContainer.querySelectorAll('.time-slot-btn').forEach(btn => {
            btn.classList.remove('active', 'selected-range');

            const slot = availableSlots.find(s => s.time === btn.dataset.time);
            if (!slot) return;

            const index = availableSlots.indexOf(slot);
            let isVisuallyAvailable = slot.available;
            if (!slot.available && index > 0 && availableSlots[index - 1].available) {
                isVisuallyAvailable = true;
            }

            if (isVisuallyAvailable) {
                btn.classList.add('btn-outline-danger');
                btn.classList.remove('btn-outline-secondary');
                btn.disabled = false;
            } else {
                btn.classList.add('btn-outline-secondary');
                btn.classList.remove('btn-outline-danger');
                btn.disabled = true;
            }
        });
    }

    function updateSlotAvailability(startTime) {

        let [startH, startM] = startTime.split(':').map(Number);
        let startDate = new Date();
        startDate.setHours(startH, startM, 0, 0);

        let maxEndDate = new Date(startDate.getTime() + (10 * 60 * 60 * 1000));

        let [closeH, closeM] = closingTime.split(':').map(Number);
        let closingDate = new Date();
        closingDate.setHours(closeH, closeM, 0, 0);

        if (closingDate <= startDate) {
            closingDate.setDate(closingDate.getDate() + 1);
        }

        slotsContainer.querySelectorAll('.time-slot-btn').forEach(btn => {
            const btnTime = btn.dataset.time;
            if (!btnTime) return;

            const slot = availableSlots.find(s => s.time === btnTime);
            let isVisuallyAvailable = slot.available;
            const index = availableSlots.indexOf(slot);
            if (!slot.available && index > 0 && availableSlots[index - 1].available) {
                isVisuallyAvailable = true;
            }

            if (isVisuallyAvailable) {
                btn.disabled = false;
            } else {
                btn.disabled = true;
                return;
            }

            if (btnTime === startTime) return;

            let [btnH, btnM] = btnTime.split(':').map(Number);
            let btnDate = new Date();
            btnDate.setHours(btnH, btnM, 0, 0);

            if (btnDate < startDate) {
                if (maxEndDate.getDate() > startDate.getDate() || closingDate.getDate() > startDate.getDate()) {
                    btnDate.setDate(btnDate.getDate() + 1);
                }
            }

            let isSelectable = true;

            if (btnDate > maxEndDate) {
                isSelectable = false;
            }

            if (btnDate > closingDate) {
                 isSelectable = false;
            }

            if (btnTime > startTime) {
                const slotsBetween = availableSlots.filter(s => s.time >= startTime && s.time < btnTime);
                if (slotsBetween.some(s => !s.available)) {
                    isSelectable = false;
                }
            }

            if (!isSelectable) {
                btn.disabled = true;
            }
        });
    }

    function highlightSlotRange() {
        let inRange = false;
        slotsContainer.querySelectorAll('.time-slot-btn').forEach(btn => {
            const btnTime = btn.dataset.time;
            if (btnTime === selectedStartTime) {
                inRange = true;
            }
            if (inRange) {
                btn.classList.add('selected-range');
            }
            if (btnTime === selectedEndTime) {
                inRange = false;
            }
        });

        bookingActions.style.display = 'block';
        bookingError.textContent = '';
        bookingSummary.textContent = `Confirm booking from ${selectedStartTime} to ${selectedEndTime}?`;
        bookNowBtn.disabled = false;
        bookNowBtn.textContent = 'Book Now';
    }

    bookNowBtn.addEventListener('click', async () => {
        bookNowBtn.disabled = true;
        bookNowBtn.textContent = 'Processing...';

        try {
            const response = await fetch('/api/reservations/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    party_size: parseInt(partySizeInput.value, 10),
                    date: selectedDate,
                    start_time_str: selectedStartTime,
                    end_time_str: selectedEndTime
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create reservation.');
            }

            wizardContainer.innerHTML = `
                <div class="alert alert-success text-center">
                    <h4 class="alert-heading">Reservation Confirmed!</h4>
                    <p>Your table for ${data.party_size} guests is booked successfully.</p>
                    <hr>
                    <p class="mb-0">
                        <strong>Table:</strong> ${data.table.name} <br>
                        <strong>Time:</strong> ${data.start_time_display} - ${data.end_time_display}
                    </p>
                    <a href="/my-reservations/" class="btn btn-success mt-3">View My Reservations</a>
                </div>
            `;

        } catch (error) {
            bookingError.textContent = error.message;
            bookNowBtn.disabled = false;
            bookNowBtn.textContent = 'Book Now';
        }
    });

    checkAndLoadSlots();

});