/**
 * Booking form: single-screen UI (Book A Session kit). POST /api/bookings.
 */
function apiPath(path) {
    return (window.__apiUrl || function (p) { return p; })(path);
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function init() {
    const nameEl = document.getElementById('bookingName');
    const emailEl = document.getElementById('bookingEmail');
    const serviceEl = document.getElementById('bookingService');
    const dateEl = document.getElementById('bookingDate');
    const timeEl = document.getElementById('bookingTime');
    const submitBtn = document.getElementById('bookingSubmit');
    const messageEl = document.getElementById('bookingMessage');

    if (!submitBtn || !messageEl) return;

    submitBtn.addEventListener('click', () => {
        const name = (nameEl?.value ?? '').trim();
        const email = (emailEl?.value ?? '').trim();
        const service = (serviceEl?.value ?? '').trim() || null;
        const dateVal = (dateEl?.value ?? '').trim();
        const timeVal = (timeEl?.value ?? '').trim();

        messageEl.textContent = '';
        messageEl.className = 'booking-message';

        if (!name || !email) {
            messageEl.textContent = 'Please enter name and email.';
            messageEl.classList.add('error');
            return;
        }
        if (!dateVal || !timeVal) {
            messageEl.textContent = 'Please choose a date and time.';
            messageEl.classList.add('error');
            return;
        }
        if (!service) {
            messageEl.textContent = 'Please choose a service.';
            messageEl.classList.add('error');
            return;
        }

        submitBtn.disabled = true;
        fetch(apiPath('/api/bookings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service,
                date: dateVal,
                time: timeVal,
                name,
                email,
                // Honeypot: humans never see this field. The server rejects any
                // submission that fills it in (see netlify/functions/api.js).
                botField: (document.getElementById('bookingBotField') || {}).value || ''
            })
        })
            .then(res => res.json().catch(() => ({})).then(payload => {
                if (!res.ok) {
                    const err = new Error(payload?.error || res.statusText || 'Booking failed');
                    err.status = res.status;
                    err.code = payload?.code;
                    throw err;
                }
                return payload || {};
            }))
            .then(payload => {
                const booking = payload.booking || {};
                const bookedDate = booking.date || dateVal;
                const bookedTime = booking.time || timeVal;
                const reference = booking.reference || '';
                const startUtc = booking.startUtc || booking.datetime || '';
                const endUtc = booking.endUtc || '';
                const serviceLabelEl = document.querySelector('.kit-modal-select .kit-modal-dropdown-label');
                const dateLabelEl = document.querySelector('.kit-modal-date .kit-modal-dropdown-label');
                const serviceLabel = booking.serviceLabel || serviceLabelEl?.textContent?.trim() || service;
                const dateLabel = dateLabelEl?.textContent?.trim() || bookedDate;
                messageEl.className = 'booking-message success';
                const wrap = messageEl.closest('.kit-modal-wrap');
                if (wrap) wrap.classList.add('booking-done');
                messageEl.innerHTML = '<div class="booking-success-card">' +
                    '<div class="booking-success-title">Booking successful</div>' +
                    '<div class="booking-success-details">' +
                    (serviceLabel ? 'Service: ' + escapeHtml(serviceLabel) + '<br>' : '') +
                    'Date: ' + escapeHtml(dateLabel) + '<br>Time: ' + escapeHtml(bookedTime) +
                    (reference ? '<br>Reference: ' + escapeHtml(reference) : '') +
                    '</div>' +
                    '<div class="booking-success-actions">' +
                    '<a href="kitchen.html">Continue to kitchen</a>' +
                    '<button type="button" class="booking-success-btn" data-date="' + escapeHtml(bookedDate) + '" data-time="' + escapeHtml(bookedTime) + '" data-start="' + escapeHtml(startUtc) + '" data-end="' + escapeHtml(endUtc) + '" data-summary="' + escapeHtml(serviceLabel || 'Session') + '">Add to calendar</button>' +
                    '</div></div>';
                const addBtn = messageEl.querySelector('.booking-success-btn');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        const d = addBtn.getAttribute('data-date');
                        const t = addBtn.getAttribute('data-time');
                        const startIso = addBtn.getAttribute('data-start');
                        const endIso = addBtn.getAttribute('data-end');
                        const summary = addBtn.getAttribute('data-summary') || 'Session';
                        const toIcsUtc = value => {
                            const date = new Date(value);
                            return isNaN(date.getTime()) ? '' : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
                        };
                        let icsStart = startIso ? toIcsUtc(startIso) : '';
                        let icsEnd = endIso ? toIcsUtc(endIso) : '';
                        if (!icsStart && d && t) {
                            icsStart = d.replace(/-/g, '') + 'T' + t.replace(':', '') + '0000Z';
                            const endHour = parseInt(t.slice(0, 2), 10) + 1;
                            icsEnd = d.replace(/-/g, '') + 'T' + (endHour < 10 ? '0' : '') + endHour + '0000Z';
                        }
                        if (!icsStart) return;
                        const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:' + icsStart + '\r\n' + (icsEnd ? 'DTEND:' + icsEnd + '\r\n' : '') + 'SUMMARY:' + summary + '\r\nEND:VEVENT\r\nEND:VCALENDAR';
                        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'booking.ics';
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                }
            })
            .catch(err => {
                messageEl.textContent = err?.message || 'Something went wrong. Please try again.';
                messageEl.className = 'booking-message error';
                if (err && (err.status === 409 || err.code === 'SLOT_TAKEN') && typeof window.applyAvailabilityDates === 'function') {
                    fetch(apiPath('/api/availability'))
                        .then(res => res.ok ? res.json() : null)
                        .then(data => { if (data?.dates) window.applyAvailabilityDates(data.dates); })
                        .catch(() => {});
                }
            })
            .finally(() => { submitBtn.disabled = false; });
    });
}

init();
