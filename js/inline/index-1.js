/* Extracted from index.html so the page can run under a strict CSP (script-src 'self'). */
        (function () {
            var modal = document.getElementById('modalBookSession');
            if (!modal) return;
            var dateBlock = modal.querySelector('.kit-modal-date');
            if (!dateBlock) return;
            var list = dateBlock.querySelector('.kit-modal-dropdown-list-outer .kit-modal-dropdown-list');
            var label = dateBlock.querySelector('.kit-modal-dropdown-label');
            if (!list || !label) return;
            var dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            var monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            var today = new Date();
            var next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
            list.innerHTML = '';
            for (var i = 0; i < 15; i++) {
                var dateStr = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
                var labelText = dayNames[next.getDay()] + ', ' + next.getDate() + ' ' + monthNames[next.getMonth()];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'kit-modal-dropdown-option';
                btn.setAttribute('role', 'option');
                btn.setAttribute('data-value', dateStr);
                btn.setAttribute('data-label', labelText);
                btn.textContent = labelText;
                list.appendChild(btn);
                next.setDate(next.getDate() + 1);
                while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
            }
            var first = list.querySelector('.kit-modal-dropdown-option');
            if (first) {
                label.textContent = first.getAttribute('data-label');
                var dateInput = document.getElementById('bookingDate');
                if (dateInput) dateInput.value = first.getAttribute('data-value');
            }
        })();
    