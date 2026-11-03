/* Extracted from ui-kit/index.html so the page can run under a strict CSP (script-src 'self'). */
        (function () {
            var dateLists = document.querySelectorAll('.kit-modal-dropdown.kit-modal-date .kit-modal-dropdown-list');
            var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            function formatDateLabel(d) {
                return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
            }
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            dateLists.forEach(function (dateList) {
                var dateDropdown = dateList.closest('.kit-modal-date');
                var dateLabel = dateDropdown ? dateDropdown.querySelector('.kit-modal-dropdown-label') : null;
                dateList.innerHTML = '';
                for (var i = 0; i < 15; i++) {
                    var d = new Date(today);
                    d.setDate(d.getDate() + i);
                    var label = formatDateLabel(d);
                    var value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    var btn = document.createElement('button');
                    btn.setAttribute('type', 'button');
                    btn.setAttribute('class', 'kit-modal-dropdown-option');
                    btn.setAttribute('role', 'option');
                    btn.setAttribute('data-value', value);
                    btn.setAttribute('data-label', label);
                    btn.textContent = label;
                    dateList.appendChild(btn);
                }
                if (dateLabel) dateLabel.textContent = formatDateLabel(today);
            });
        })();
        (function () {
            var componentDropdown = document.querySelector('.kit-component-dropdown');
            var trigger = document.querySelector('.kit-component-dropdown-trigger');
            var labelEl = document.querySelector('.kit-component-dropdown-label');
            var options = document.querySelectorAll('.kit-component-dropdown-option');
            var componentLabels = { 'join-waitlist': 'JOIN WAITLIST' };
            function setCurrentComponent(id) {
                document.body.setAttribute('data-kit-component', id);
                if (labelEl) labelEl.textContent = componentLabels[id] || id;
                document.querySelectorAll('.kit-component').forEach(function (el) {
                    var show = el.getAttribute('data-component') === id;
                    if (show) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
                });
            }
            trigger.addEventListener('click', function () {
                componentDropdown.classList.toggle('open');
                trigger.setAttribute('aria-expanded', componentDropdown.classList.contains('open'));
            });
            options.forEach(function (opt) {
                opt.addEventListener('click', function () {
                    setCurrentComponent(this.getAttribute('data-component'));
                    componentDropdown.classList.remove('open');
                    trigger.setAttribute('aria-expanded', 'false');
                });
            });
            document.addEventListener('click', function (e) {
                if (componentDropdown.classList.contains('open') && !componentDropdown.contains(e.target)) {
                    componentDropdown.classList.remove('open');
                    trigger.setAttribute('aria-expanded', 'false');
                }
            });
            setCurrentComponent('join-waitlist');
        })();
        document.querySelectorAll('.kit-modal-dropdown').forEach(function (dropdown) {
            var wrap = dropdown.closest('.kit-modal-wrap');
            var row = dropdown.closest('.kit-modal-row');
            var trigger = dropdown.querySelector('.kit-modal-dropdown-trigger');
            var list = dropdown.querySelector('.kit-modal-dropdown-list');
            var options = dropdown.querySelectorAll('.kit-modal-dropdown-option');
            var labelEl = dropdown.querySelector('.kit-modal-dropdown-label');
            var justOpened = false;

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
                options.forEach(function (opt, i) {
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
                            var list = outer.querySelector('.kit-modal-dropdown-list');
                            if (list) list.scrollTop = list.scrollHeight - list.clientHeight;
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
                    var list = dropdown.querySelector('.kit-modal-dropdown-list');
                    if (list) {
                        requestAnimationFrame(function () {
                            list.scrollTop = list.scrollHeight - list.clientHeight;
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
                var list = outer && outer.querySelector('.kit-modal-dropdown-list');
                if (list && dropdown.classList.contains('kit-modal-date')) {
                    list.style.transform = '';
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

            options.forEach(function (opt) {
                opt.addEventListener('click', function () {
                    var label = this.getAttribute('data-label');
                    if (label != null && labelEl) labelEl.textContent = label;
                    var price = this.getAttribute('data-price');
                    if (price != null && row) {
                        var priceVal = row.querySelector('.kit-modal-price-value');
                        if (priceVal) priceVal.textContent = price;
                    }
                    closeDropdown();
                });
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
            window.updateCustomScrollbar = updateCustomScrollbar;
            window.setListOuterHeightForThreeOptions = setListOuterHeightForThreeOptions;
        })();
    