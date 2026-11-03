/* Extracted from booking.html so the page can run under a strict CSP (script-src 'self'). */
        var availabilityData = { dates: [] };
        var SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
        function setTimeOptionsForDate(dateStr, preferredTime) {
            var timeList = document.querySelector('.kit-modal-dropdown.kit-modal-time .kit-modal-dropdown-list');
            var timeLabel = document.querySelector('.kit-modal-dropdown.kit-modal-time .kit-modal-dropdown-label');
            var timeValueInput = document.getElementById('bookingTime');
            if (!timeList || !timeLabel) return;
            var entry = availabilityData.dates.find(function (d) { return d.date === dateStr; });
            var times = entry && Array.isArray(entry.times) ? entry.times.slice() : SLOT_TIMES.slice();
            timeList.innerHTML = '';
            if (!times.length) {
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
        function applyAvailabilityDates(dates) {
            var dateList = document.querySelector('.kit-modal-dropdown.kit-modal-date .kit-modal-dropdown-list-outer .kit-modal-dropdown-list');
            var dateLabel = document.querySelector('.kit-modal-dropdown.kit-modal-date .kit-modal-dropdown-label');
            var dateValueInput = document.getElementById('bookingDate');
            var timeValueInput = document.getElementById('bookingTime');
            if (!dateList || !dateLabel) return;
            var previousDate = dateValueInput ? dateValueInput.value : '';
            var previousTime = timeValueInput ? timeValueInput.value : '';
            availabilityData.dates = dates;
            dateList.innerHTML = '';
            dates.forEach(function (entry) {
                var fullyBooked = !entry.times || !entry.times.length;
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
            var selected = dates.find(function (entry) {
                return entry.date === previousDate && entry.times && entry.times.length;
            }) || dates.find(function (entry) { return entry.times && entry.times.length; });
            if (selected) {
                dateLabel.textContent = selected.label;
                if (dateValueInput) dateValueInput.value = selected.date;
                setTimeOptionsForDate(selected.date, previousTime);
            } else {
                dateLabel.textContent = dates.length ? 'No sessions available' : 'No dates available';
                if (dateValueInput) dateValueInput.value = '';
                if (timeValueInput) timeValueInput.value = '';
                var timeList = document.querySelector('.kit-modal-dropdown.kit-modal-time .kit-modal-dropdown-list');
                var timeLabel = document.querySelector('.kit-modal-dropdown.kit-modal-time .kit-modal-dropdown-label');
                if (timeList) timeList.innerHTML = '';
                if (timeLabel) timeLabel.textContent = '—';
            }
        }
        (function initDateOptions() {
            var dateList = document.querySelector('.kit-modal-dropdown.kit-modal-date .kit-modal-dropdown-list-outer .kit-modal-dropdown-list');
            var dateLabel = document.querySelector('.kit-modal-dropdown.kit-modal-date .kit-modal-dropdown-label');
            if (!dateList || !dateLabel) return;
            applyAvailabilityDates(buildFallbackDates());
            var url = (window.__apiUrl || function (p) { return p; })('/api/availability');
            fetch(url)
                .then(function (res) {
                    if (!res.ok) throw new Error(res.status);
                    return res.json();
                })
                .then(function (data) {
                    if (data && Array.isArray(data.dates) && data.dates.length) applyAvailabilityDates(data.dates);
                })
                .catch(function () {});
        })();
        document.querySelectorAll('.kit-modal-dropdown').forEach(function (dropdown) {
            var wrap = dropdown.closest('.kit-modal-wrap');
            var row = dropdown.closest('.kit-modal-row');
            var trigger = dropdown.querySelector('.kit-modal-dropdown-trigger');
            var list = dropdown.querySelector('.kit-modal-dropdown-list');
            var options = dropdown.querySelectorAll('.kit-modal-dropdown-option');
            var labelEl = dropdown.querySelector('.kit-modal-dropdown-label');
            var justOpened = false;
            var name = dropdown.getAttribute('data-name');
            var hiddenId = name ? 'booking' + name.charAt(0).toUpperCase() + name.slice(1) : null;

            function openDropdown() {
                if (!wrap || !row) return;
                justOpened = true;
                setTimeout(function () { justOpened = false; }, 300);
                wrap.classList.add('kit-dropdown-open');
                row.classList.add('kit-dropdown-active');
                if (dropdown.classList.contains('kit-modal-date')) {
                    row.classList.remove('kit-dropdown-time');
                    row.classList.add('kit-dropdown-date');
                } else if (dropdown.classList.contains('kit-modal-time')) {
                    row.classList.remove('kit-dropdown-date');
                    row.classList.add('kit-dropdown-time');
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
                } else if (dropdown.classList.contains('kit-modal-time')) {
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
                    r.classList.remove('kit-dropdown-active', 'kit-dropdown-date', 'kit-dropdown-time');
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
                var label = opt.getAttribute('data-label');
                var value = opt.getAttribute('data-value');
                if (label != null && labelEl) labelEl.textContent = label;
                if (hiddenId && value != null) {
                    var hid = document.getElementById(hiddenId);
                    if (hid) hid.value = value;
                }
                if (dropdown.classList.contains('kit-modal-date') && value && typeof setTimeOptionsForDate === 'function') {
                    setTimeOptionsForDate(value);
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

            document.querySelectorAll('.kit-modal-dropdown-list-outer').forEach(function (outer) {
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

        // ?offer=edit-sprint preselects the matching offer from the offers page.
        // The value is never interpolated into a selector — it is compared against
        // each option's data-value so a crafted ?offer= cannot break out of the query.
        (function preselectOfferFromUrl() {
            var match = (location.search || '').match(/[?&]offer=([^&]+)/);
            if (!match) return;
            var wanted = '';
            try { wanted = decodeURIComponent(match[1]); } catch (e) { return; }
            if (!/^[A-Za-z0-9_-]{1,40}$/.test(wanted)) return;
            var options = document.querySelectorAll('.kit-modal-select .kit-modal-dropdown-option');
            for (var i = 0; i < options.length; i++) {
                if (options[i].getAttribute('data-value') === wanted) {
                    options[i].click();
                    break;
                }
            }
        })();
    