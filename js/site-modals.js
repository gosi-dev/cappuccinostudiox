/**
 * Site modals: Book A Session + Waitlist. Open/close overlay, init forms, submit to API.
 */
(function () {
    var overlay = document.getElementById('siteOverlay');
    var overlayBg = document.getElementById('siteOverlayBg');
    var modalBook = document.getElementById('modalBookSession');
    var modalWaitlist = document.getElementById('modalWaitlist');
    var availabilityData = { dates: [] };
    var SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    var WAITLIST_DEFAULT_DETAILS = 'You have been added to the waitlist, you will be notified when the Enter the Jungle pieces are live.';
    var WAITLIST_DUPLICATE_DETAILS = 'You are already on the waitlist. We will be in touch when the Enter the Jungle pieces are live.';

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

    function errorFromResponse(res, payload) {
        var err = new Error((payload && payload.error) || res.statusText || 'Request failed');
        err.status = res.status;
        err.code = payload && payload.code;
        return err;
    }

    function openModal(id) {
        if (!overlay) return;
        document.body.classList.add('site-modal-open');
        if (modalBook) modalBook.classList.remove('active');
        if (modalWaitlist) modalWaitlist.classList.remove('active');
        if (id === 'book-session' && modalBook) {
            modalBook.classList.add('active');
            var bookWrap = modalBook.querySelector('.kit-modal-wrap');
            if (bookWrap) bookWrap.classList.remove('booking-done');
            var bookingMessage = document.getElementById('bookingMessage');
            if (bookingMessage) {
                bookingMessage.textContent = '';
                bookingMessage.className = 'booking-message';
            }
            requestAnimationFrame(function () {
                ensureDateOptionsLoaded();
            });
        }
        if (id === 'waitlist' && modalWaitlist) {
            modalWaitlist.classList.add('active');
            var wrap = modalWaitlist.querySelector('.kit-modal-wrap');
            if (wrap) wrap.classList.remove('waitlist-done');
            var waitlistMessage = document.getElementById('waitlistMessage');
            if (waitlistMessage) {
                waitlistMessage.textContent = '';
                waitlistMessage.className = 'waitlist-message';
            }
            var successDetails = document.getElementById('waitlistSuccessCard');
            if (successDetails) {
                var details = successDetails.querySelector('.waitlist-success-details');
                if (details) details.textContent = WAITLIST_DEFAULT_DETAILS;
            }
        }
    }

    function closeModal() {
        document.body.classList.remove('site-modal-open');
        if (modalBook) modalBook.classList.remove('active');
        if (modalWaitlist) modalWaitlist.classList.remove('active');
    }

    window.openModal = openModal;
    window.closeModal = closeModal;

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target !== overlay && e.target !== overlayBg) return;
            var dropdownOpen = overlay.querySelector('.kit-modal-dropdown.open');
            if (dropdownOpen) return;
            closeModal();
        });
    }

    function entryForDate(dateStr) {
        return availabilityData.dates.find(function (d) { return d.date === dateStr; }) || null;
    }

    function timesForDate(dateStr) {
        var entry = entryForDate(dateStr);
        if (entry && Array.isArray(entry.times)) return entry.times.slice();
        // Before the API responds we show the full studio schedule.
        return SLOT_TIMES.slice();
    }

    function setTimeOptionsForDate(dateStr, preferredTime) {
        var bookModal = document.getElementById('modalBookSession');
        if (!bookModal) return;
        var timeBlock = bookModal.querySelector('.kit-modal-time');
        if (!timeBlock) return;
        var timeList = timeBlock.querySelector('.kit-modal-dropdown-list');
        var timeLabel = timeBlock.querySelector('.kit-modal-dropdown-label');
        var timeValueInput = document.getElementById('bookingTime');
        if (!timeList || !timeLabel) return;
        var times = timesForDate(dateStr);
        timeList.innerHTML = '';
        if (times.length === 0) {
            var unavailable = document.createElement('button');
            unavailable.setAttribute('type', 'button');
            unavailable.setAttribute('class', 'kit-modal-dropdown-option');
            unavailable.setAttribute('role', 'option');
            unavailable.setAttribute('data-disabled', 'true');
            unavailable.className = 'kit-modal-dropdown-option kit-modal-option-disabled';
            unavailable.textContent = 'FULLY BOOKED';
            timeList.appendChild(unavailable);
            timeLabel.textContent = 'FULLY BOOKED';
            if (timeValueInput) timeValueInput.value = '';
            return;
        }
        times.forEach(function (t) {
            var btn = document.createElement('button');
            btn.setAttribute('type', 'button');
            btn.setAttribute('class', 'kit-modal-dropdown-option');
            btn.setAttribute('role', 'option');
            btn.setAttribute('data-value', t);
            btn.setAttribute('data-label', t);
            btn.textContent = t;
            timeList.appendChild(btn);
        });
        var selected = preferredTime && times.indexOf(preferredTime) >= 0 ? preferredTime : times[0];
        timeLabel.textContent = selected;
        if (timeValueInput) timeValueInput.value = selected;
    }

    function buildFallbackDates() {
        var dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        var monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        var today = new Date();
        var y = today.getFullYear();
        var m = today.getMonth();
        var d = today.getDate();
        var next = new Date(y, m, d + 1);
        while (next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
        }
        var list = [];
        for (var i = 0; i < 15; i++) {
            var dateStr = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
            var label = dayNames[next.getDay()] + ', ' + next.getDate() + ' ' + monthNames[next.getMonth()];
            list.push({ date: dateStr, label: label, times: SLOT_TIMES.slice() });
            next.setDate(next.getDate() + 1);
            while (next.getDay() === 0 || next.getDay() === 6) {
                next.setDate(next.getDate() + 1);
            }
        }
        return list;
    }

    function hasTimes(entry) {
        return !!(entry && Array.isArray(entry.times) && entry.times.length > 0);
    }

    function applyAvailabilityDates(dates) {
        var bookModal = document.getElementById('modalBookSession');
        if (!bookModal) return;
        var dateBlock = bookModal.querySelector('.kit-modal-date');
        if (!dateBlock) return;
        var dateList = dateBlock.querySelector('.kit-modal-dropdown-list-outer .kit-modal-dropdown-list');
        var dateLabel = dateBlock.querySelector('.kit-modal-dropdown-label');
        var dateValueInput = document.getElementById('bookingDate');
        var timeValueInput = document.getElementById('bookingTime');
        if (!dateList || !dateLabel) return;
        var previousDate = dateValueInput ? dateValueInput.value : '';
        var previousTime = timeValueInput ? timeValueInput.value : '';
        availabilityData.dates = dates;
        dateList.innerHTML = '';
        dates.forEach(function (entry) {
            var fullyBooked = !hasTimes(entry);
            var btn = document.createElement('button');
            btn.setAttribute('type', 'button');
            btn.setAttribute('class', 'kit-modal-dropdown-option');
            btn.setAttribute('role', 'option');
            btn.setAttribute('data-value', entry.date);
            btn.setAttribute('data-label', entry.label);
            if (fullyBooked) {
                btn.setAttribute('data-disabled', 'true');
                btn.classList.add('kit-modal-option-disabled');
            }
            btn.textContent = entry.label + (fullyBooked ? ' — FULLY BOOKED' : '');
            dateList.appendChild(btn);
        });
        var selected = dates.find(function (entry) { return entry.date === previousDate && hasTimes(entry); }) ||
            dates.find(hasTimes);
        if (selected) {
            dateLabel.textContent = selected.label;
            if (dateValueInput) dateValueInput.value = selected.date;
            setTimeOptionsForDate(selected.date, previousTime);
        } else {
            dateLabel.textContent = dates.length ? 'No sessions available' : 'No dates available';
            if (dateValueInput) dateValueInput.value = '';
            if (timeValueInput) timeValueInput.value = '';
            var timeBlock = bookModal.querySelector('.kit-modal-time');
            if (timeBlock) {
                var timeList = timeBlock.querySelector('.kit-modal-dropdown-list');
                var timeLabel = timeBlock.querySelector('.kit-modal-dropdown-label');
                if (timeList) timeList.innerHTML = '';
                if (timeLabel) timeLabel.textContent = '—';
            }
        }
    }

    var availabilityFetchInFlight = false;
    function loadAvailabilityFromApi() {
        if (availabilityFetchInFlight) return Promise.resolve();
        availabilityFetchInFlight = true;
        return fetch(apiPath('/api/availability'))
            .then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && Array.isArray(data.dates) && data.dates.length > 0) applyAvailabilityDates(data.dates);
                return data;
            })
            .catch(function () {})
            .finally(function () { availabilityFetchInFlight = false; });
    }

    function ensureDateOptionsLoaded() {
        var bookModal = document.getElementById('modalBookSession');
        if (!bookModal) return;
        var dateBlock = bookModal.querySelector('.kit-modal-date');
        if (!dateBlock) return;
        var dateList = dateBlock.querySelector('.kit-modal-dropdown-list-outer .kit-modal-dropdown-list');
        var dateLabel = dateBlock.querySelector('.kit-modal-dropdown-label');
        if (!dateList || !dateLabel) return;
        if (availabilityData.dates.length === 0) applyAvailabilityDates(buildFallbackDates());
        // Refresh on every open so a slot booked in another tab/session is removed.
        loadAvailabilityFromApi();
    }

    (function initDateOptions() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                ensureDateOptionsLoaded();
            });
        } else {
            ensureDateOptionsLoaded();
        }
    })();

    document.querySelectorAll('.site-overlay .kit-modal-dropdown').forEach(function (dropdown) {
        var wrap = dropdown.closest('.kit-modal-wrap');
        var row = dropdown.closest('.kit-modal-row');
        var trigger = dropdown.querySelector('.kit-modal-dropdown-trigger');
        var list = dropdown.querySelector('.kit-modal-dropdown-list');
        var options = dropdown.querySelectorAll('.kit-modal-dropdown-option');
        var labelEl = dropdown.querySelector('.kit-modal-dropdown-label');
        var justOpened = false;
        var name = dropdown.getAttribute('data-name');
        var prefix = (wrap && wrap.getAttribute('data-modal-prefix')) || 'booking';
        var hiddenId = name ? (prefix + name.charAt(0).toUpperCase() + name.slice(1)) : null;

        function openDropdown() {
            if (!wrap || !row) return;
            justOpened = true;
            setTimeout(function () { justOpened = false; }, 300);
            wrap.classList.add('kit-dropdown-open');
            row.classList.add('kit-dropdown-active');
            if (dropdown.classList.contains('kit-modal-date')) {
                row.classList.remove('kit-dropdown-time', 'kit-dropdown-tier');
                row.classList.add('kit-dropdown-date');
            } else if (dropdown.classList.contains('kit-modal-time')) {
                row.classList.remove('kit-dropdown-date', 'kit-dropdown-tier');
                row.classList.add('kit-dropdown-time');
            } else if (dropdown.classList.contains('kit-modal-tier')) {
                row.classList.remove('kit-dropdown-date', 'kit-dropdown-time');
                row.classList.add('kit-dropdown-tier');
            }
            var opts = list.querySelectorAll('.kit-modal-dropdown-option');
            opts.forEach(function (opt, i) {
                opt.style.setProperty('--flash-delay', (i * 0.1) + 's');
            });
            dropdown.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            var outer = dropdown.querySelector('.kit-modal-dropdown-list-outer');
            var isDate = dropdown.classList.contains('kit-modal-date');
            if (outer) {
                function afterMeasure() {
                    if (typeof setListOuterHeightForThreeOptions === 'function') setListOuterHeightForThreeOptions(outer);
                    if (typeof updateCustomScrollbar === 'function') updateCustomScrollbar(outer);
                    if (dropdown.classList.contains('kit-modal-time')) {
                        var listEl = outer.querySelector('.kit-modal-dropdown-list');
                        if (listEl) listEl.scrollTop = listEl.scrollHeight - listEl.clientHeight;
                        if (typeof updateCustomScrollbar === 'function') updateCustomScrollbar(outer);
                    }
                }
                if (isDate) {
                    setTimeout(function () {
                        afterMeasure();
                        requestAnimationFrame(function () {
                            if (typeof updateCustomScrollbar === 'function') updateCustomScrollbar(outer);
                        });
                    }, 0);
                } else {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(afterMeasure);
                    });
                }
            } else if (dropdown.classList.contains('kit-modal-time') || dropdown.classList.contains('kit-modal-tier')) {
                var listEl = dropdown.querySelector('.kit-modal-dropdown-list');
                if (listEl) {
                    requestAnimationFrame(function () {
                        listEl.scrollTop = listEl.scrollHeight - listEl.clientHeight;
                    });
                }
            }
        }

        function closeDropdown() {
            if (!wrap) return;
            wrap.classList.remove('kit-dropdown-open');
            wrap.querySelectorAll('.kit-modal-row').forEach(function (r) {
                r.classList.remove('kit-dropdown-active', 'kit-dropdown-date', 'kit-dropdown-time', 'kit-dropdown-tier');
            });
            var outer = dropdown.querySelector('.kit-modal-dropdown-list-outer');
            var listEl = outer && outer.querySelector('.kit-modal-dropdown-list');
            if (listEl && dropdown.classList.contains('kit-modal-date')) {
                listEl.style.transform = '';
            }
            dropdown.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }

        trigger.addEventListener('click', function () {
            if (justOpened) return;
            if (dropdown.classList.contains('open')) {
                closeDropdown();
                return;
            }
            openDropdown();
        });

        list.addEventListener('click', function (e) {
            var opt = e.target && e.target.closest && e.target.closest('.kit-modal-dropdown-option');
            if (!opt || !list.contains(opt)) return;
            if (opt.getAttribute('data-disabled') === 'true') return;
            var label = opt.getAttribute('data-label');
            var value = opt.getAttribute('data-value');
            var price = opt.getAttribute('data-price');
            if (label != null && labelEl) labelEl.textContent = label;
            if (hiddenId && value != null) {
                var hid = document.getElementById(hiddenId);
                if (hid) hid.value = value;
            }
            if (dropdown.classList.contains('kit-modal-date') && value && typeof setTimeOptionsForDate === 'function') {
                setTimeOptionsForDate(value);
            }
            if (price != null && row) {
                var priceVal = row.querySelector('.kit-modal-price-value');
                if (priceVal) priceVal.textContent = price;
            }
            closeDropdown();
        });

        document.addEventListener('click', function (e) {
            if (dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
                closeDropdown();
            }
        });
    });

    (function initCustomScrollbars() {
        function setListOuterHeightForThreeOptions(outer) {
            var list = outer && outer.querySelector('.kit-modal-dropdown-list');
            var options = list && list.querySelectorAll('.kit-modal-dropdown-option');
            if (!list || !options || options.length < 3) return;
            var dropdown = outer.closest('.kit-modal-dropdown');
            var isDateRollup = dropdown && dropdown.classList.contains('kit-modal-date');
            if (isDateRollup) {
                list.style.transform = 'none';
            }
            outer.style.height = '999px';
            outer.style.maxHeight = '999px';
            list.offsetHeight;
            var listRect = list.getBoundingClientRect();
            var thirdRect = options[2].getBoundingClientRect();
            var h = Math.ceil(thirdRect.bottom - listRect.top);
            var minHeight = 120;
            if (h < minHeight) {
                var gap = parseFloat(getComputedStyle(list).gap) || 8;
                var firstH = options[0].offsetHeight;
                h = firstH > 0 ? (3 * firstH + 2 * gap) : 180;
            }
            outer.style.height = h + 'px';
            outer.style.maxHeight = h + 'px';
            if (isDateRollup) {
                requestAnimationFrame(function () {
                    list.style.transform = 'scaleY(0)';
                    requestAnimationFrame(function () {
                        list.style.transform = 'scaleY(1)';
                    });
                });
            }
        }
        function getScrollStep(list) {
            var opt = list.querySelector('.kit-modal-dropdown-option');
            if (!opt) return 62;
            var gap = parseFloat(getComputedStyle(list).gap) || 8;
            return opt.offsetHeight + gap;
        }
        function snapScrollToOptions(outer) {
            var list = outer && outer.querySelector('.kit-modal-dropdown-list');
            if (!list) return;
            var step = getScrollStep(list);
            var maxScroll = list.scrollHeight - list.clientHeight;
            if (maxScroll <= 0) return;
            var snapped = Math.round(list.scrollTop / step) * step;
            snapped = Math.max(0, Math.min(maxScroll, snapped));
            if (snapped !== list.scrollTop) list.scrollTop = snapped;
        }
        function updateCustomScrollbar(outer) {
            var list = outer && outer.querySelector('.kit-modal-dropdown-list');
            var track = outer && outer.querySelector('.kit-modal-scrollbar-track');
            var thumb = outer && outer.querySelector('.kit-modal-scrollbar-thumb');
            if (!list || !track || !thumb) return;
            var scrollbar = outer.querySelector('.kit-modal-custom-scrollbar');
            var canScroll = list.scrollHeight > list.clientHeight;
            scrollbar.style.display = canScroll ? 'block' : 'none';
            if (!canScroll) return;
            var trackHeight = track.clientHeight;
            var thumbSize = 6;
            var maxScroll = list.scrollHeight - list.clientHeight;
            if (maxScroll <= 0) {
                thumb.style.top = '0';
            } else {
                thumb.style.top = ((list.scrollTop / maxScroll) * (trackHeight - thumbSize)) + 'px';
            }
        }
        function onThumbDrag(outer, startY, startScrollTop) {
            var list = outer.querySelector('.kit-modal-dropdown-list');
            var track = outer.querySelector('.kit-modal-scrollbar-track');
            var thumb = outer.querySelector('.kit-modal-scrollbar-thumb');
            if (!list || !track || !thumb) return;
            var maxScroll = list.scrollHeight - list.clientHeight;
            if (maxScroll <= 0) return;
            var trackHeight = track.clientHeight;
            var thumbSize = 6;
            var step = getScrollStep(list);
            function move(e) {
                var y = e.touches ? e.touches[0].clientY : e.clientY;
                var trackRect = track.getBoundingClientRect();
                var rel = (trackRect.height - thumbSize) > 0 ? (y - trackRect.top - thumbSize / 2) / (trackRect.height - thumbSize) : 0;
                rel = Math.max(0, Math.min(1, rel));
                var target = rel * maxScroll;
                var snapped = Math.round(target / step) * step;
                list.scrollTop = Math.max(0, Math.min(maxScroll, snapped));
            }
            function end() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', end);
                document.removeEventListener('touchmove', move, { passive: false });
                document.removeEventListener('touchend', end);
                document.removeEventListener('touchcancel', end);
                snapScrollToOptions(outer);
                updateCustomScrollbar(outer);
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', end);
            document.addEventListener('touchmove', move, { passive: false });
            document.addEventListener('touchend', end);
            document.addEventListener('touchcancel', end);
        }
        document.querySelectorAll('.site-overlay .kit-modal-dropdown-list-outer').forEach(function (outer) {
            var list = outer.querySelector('.kit-modal-dropdown-list');
            var track = outer.querySelector('.kit-modal-scrollbar-track');
            var thumb = outer.querySelector('.kit-modal-scrollbar-thumb');
            if (!list || !track || !thumb) return;
            var scrollSnapTimeout;
            list.addEventListener('scroll', function () {
                updateCustomScrollbar(outer);
                clearTimeout(scrollSnapTimeout);
                scrollSnapTimeout = setTimeout(function () { snapScrollToOptions(outer); updateCustomScrollbar(outer); }, 80);
            });
            thumb.addEventListener('mousedown', function (e) {
                e.preventDefault();
                onThumbDrag(outer, e.clientY, list.scrollTop);
            });
            thumb.addEventListener('touchstart', function (e) {
                e.preventDefault();
                onThumbDrag(outer, e.touches[0].clientY, list.scrollTop);
            }, { passive: false });
            track.addEventListener('click', function (e) {
                if (e.target === thumb) return;
                var trackRect = track.getBoundingClientRect();
                var y = e.clientY - trackRect.top;
                var trackHeight = track.clientHeight;
                var thumbSize = 6;
                var maxScroll = list.scrollHeight - list.clientHeight;
                var maxThumbTop = trackHeight - thumbSize;
                var rel = maxThumbTop > 0 ? (y - thumbSize / 2) / maxThumbTop : 0;
                rel = Math.max(0, Math.min(1, rel));
                var step = getScrollStep(list);
                var target = Math.round((rel * maxScroll) / step) * step;
                list.scrollTop = Math.max(0, Math.min(maxScroll, target));
            });
        });
        window.setListOuterHeightForThreeOptions = setListOuterHeightForThreeOptions;
        window.updateCustomScrollbar = updateCustomScrollbar;
    })();

    (function initBookingSubmit() {
        var submitBtn = document.getElementById('bookingSubmit');
        var messageEl = document.getElementById('bookingMessage');
        if (!submitBtn || !messageEl) return;
        submitBtn.addEventListener('click', function () {
            var name = (document.getElementById('bookingName') && document.getElementById('bookingName').value || '').trim();
            var email = (document.getElementById('bookingEmail') && document.getElementById('bookingEmail').value || '').trim();
            var service = (document.getElementById('bookingService') && document.getElementById('bookingService').value || '').trim() || null;
            var dateVal = (document.getElementById('bookingDate') && document.getElementById('bookingDate').value || '').trim();
            var timeVal = (document.getElementById('bookingTime') && document.getElementById('bookingTime').value || '').trim();
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
                    service: service,
                    date: dateVal,
                    time: timeVal,
                    name: name,
                    email: email,
                    // Honeypot field — the server rejects filled-in submissions.
                    botField: (document.getElementById('bookingBotField') || {}).value || ''
                })
            })
                .then(function (res) {
                    return res.json().catch(function () { return {}; }).then(function (payload) {
                        if (!res.ok) throw errorFromResponse(res, payload);
                        return payload || {};
                    });
                })
                .then(function (payload) {
                    var booking = (payload && payload.booking) || {};
                    var bookedDate = booking.date || dateVal;
                    var bookedTime = booking.time || timeVal;
                    var reference = booking.reference || '';
                    var startUtc = booking.startUtc || booking.datetime || '';
                    var endUtc = booking.endUtc || '';
                    var bookModal = document.getElementById('modalBookSession');
                    var serviceLabelEl = bookModal && bookModal.querySelector('.kit-modal-select .kit-modal-dropdown-label');
                    var dateLabelEl = bookModal && bookModal.querySelector('.kit-modal-date .kit-modal-dropdown-label');
                    var serviceLabel = booking.serviceLabel || ((serviceLabelEl && serviceLabelEl.textContent) ? serviceLabelEl.textContent.trim() : service);
                    var dateLabel = (dateLabelEl && dateLabelEl.textContent) ? dateLabelEl.textContent.trim() : bookedDate;
                    messageEl.className = 'booking-message success';
                    var wrap = messageEl.closest('.kit-modal-wrap');
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
                    var addBtn = messageEl.querySelector('.booking-success-btn');
                    if (addBtn) {
                        addBtn.addEventListener('click', function () {
                            var d = addBtn.getAttribute('data-date');
                            var t = addBtn.getAttribute('data-time');
                            var startIso = addBtn.getAttribute('data-start');
                            var endIso = addBtn.getAttribute('data-end');
                            var summary = addBtn.getAttribute('data-summary') || 'Session';
                            var icsStart = '';
                            var icsEnd = '';
                            function toIcsUtc(value) {
                                var date = new Date(value);
                                if (isNaN(date.getTime())) return '';
                                return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
                            }
                            if (startIso) {
                                icsStart = toIcsUtc(startIso);
                                icsEnd = endIso ? toIcsUtc(endIso) : '';
                            }
                            if (!icsStart && d && t) {
                                icsStart = d.replace(/-/g, '') + 'T' + t.replace(':', '') + '0000Z';
                                var endHour = parseInt(t.slice(0, 2), 10) + 1;
                                icsEnd = d.replace(/-/g, '') + 'T' + (endHour < 10 ? '0' : '') + endHour + '0000Z';
                            }
                            if (!icsStart) return;
                            var ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:' + icsStart + '\r\n' + (icsEnd ? 'DTEND:' + icsEnd + '\r\n' : '') + 'SUMMARY:' + summary + '\r\nEND:VEVENT\r\nEND:VCALENDAR';
                            var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'booking.ics';
                            a.click();
                            URL.revokeObjectURL(url);
                        });
                    }
                    // The booked slot is gone now; refresh availability for the next open.
                    availabilityData.dates = [];
                    loadAvailabilityFromApi();
                })
                .catch(function (err) {
                    messageEl.textContent = (err && err.message) ? err.message : 'Something went wrong. Please try again.';
                    messageEl.className = 'booking-message error';
                    if (err && (err.status === 409 || err.code === 'SLOT_TAKEN')) {
                        availabilityData.dates = [];
                        loadAvailabilityFromApi();
                    }
                })
                .finally(function () { submitBtn.disabled = false; });
        });
    })();

    (function initWaitlistSubmit() {
        var submitBtn = document.getElementById('waitlistSubmit');
        var messageEl = document.getElementById('waitlistMessage');
        if (!submitBtn || !messageEl) return;
        submitBtn.addEventListener('click', function () {
            var name = (document.getElementById('waitlistName') && document.getElementById('waitlistName').value || '').trim() || null;
            var email = (document.getElementById('waitlistEmail') && document.getElementById('waitlistEmail').value || '').trim();
            var tier = (document.getElementById('waitlistTier') && document.getElementById('waitlistTier').value || '').trim() || null;
            messageEl.textContent = '';
            messageEl.className = 'waitlist-message';
            if (!email) {
                messageEl.textContent = 'Please enter your email.';
                messageEl.classList.add('error');
                return;
            }
            submitBtn.disabled = true;
            fetch(apiPath('/api/waitlist'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    tier: tier,
                    // Honeypot field — the server rejects filled-in submissions.
                    botField: (document.getElementById('waitlistBotField') || {}).value || ''
                })
            })
                .then(function (res) {
                    return res.json().catch(function () { return {}; }).then(function (payload) {
                        if (!res.ok) throw errorFromResponse(res, payload);
                        return payload || {};
                    });
                })
                .then(function (payload) {
                    var wrap = document.getElementById('modalWaitlist') && document.getElementById('modalWaitlist').querySelector('.kit-modal-wrap');
                    if (wrap) wrap.classList.add('waitlist-done');
                    var successDetails = document.querySelector('#waitlistSuccessCard .waitlist-success-details');
                    if (successDetails) {
                        successDetails.textContent = payload.duplicate ? WAITLIST_DUPLICATE_DETAILS : WAITLIST_DEFAULT_DETAILS;
                    }
                    var continueBtn = document.getElementById('waitlistContinueBtn');
                    if (continueBtn && !continueBtn._waitlistContinueBound) {
                        continueBtn._waitlistContinueBound = true;
                        continueBtn.addEventListener('click', function () { if (typeof closeModal === 'function') closeModal(); });
                    }
                })
                .catch(function (err) {
                    messageEl.textContent = (err && err.message) ? err.message : 'Something went wrong. Please try again.';
                    messageEl.className = 'waitlist-message error';
                })
                .finally(function () { submitBtn.disabled = false; });
        });
    })();
})();
