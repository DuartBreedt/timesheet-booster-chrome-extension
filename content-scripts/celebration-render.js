(function () {
    'use strict';

    if (window.__CELEBRATION_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__CELEBRATION_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const FULL_DAY_HOURS = 8;
    const RAY_COUNT = 10;
    const CONFETTI_COUNT = 7;
    const FULL_DAY_CONFETTI_COUNT = 22;
    // muted warm and cool accents from the palette, so the confetti sits with the rest of the page
    const CONFETTI_COLORS = ['#eca65e', '#7cb677', '#7e95c8', '#c57791', '#cab072', '#72adb9'];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.addEventListener('tb:entry-captured', onEntryCaptured)

    function onEntryCaptured(event) {
        const { date, hours, dayHours, isLeave } = JSON.parse(event.detail)
        const day = document.querySelector(`.timeEntry[data-tb-date="${date}"]`)
        if (!day) return;

        const blocks = day.querySelectorAll('.timeEntry-capturedTime')
        const block = day.querySelector('.timeEntry-capturedTime[data-tb-fresh]') || blocks[blocks.length - 1]
        const isDayComplete = !isLeave && dayHours >= FULL_DAY_HOURS && dayHours - hours < FULL_DAY_HOURS

        // a frame later entry-render has applied the category's custom colour
        requestAnimationFrame(() => {
            if (block) settle(block)
            replayClass(day.querySelector('.timeEntry-totalHoursWorked'), 'tb-total-bump')
            if (isDayComplete) replayClass(day, 'tb-day-complete')
            if (!block || isLeave || reducedMotion.matches) return;

            const rect = block.getBoundingClientRect()
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;
            celebrate(rect.right, rect.top + rect.height / 2, getComputedStyle(block).backgroundColor, hours, isDayComplete)
        })
    }

    function settle(block) {
        block.dataset.tbFresh = ''
        setTimeout(() => delete block.dataset.tbFresh, 1200)
    }

    function replayClass(node, className) {
        if (!node) return;
        node.classList.remove(className)
        // forces a reflow so the animation restarts on back-to-back saves
        void node.offsetWidth
        node.classList.add(className)
        node.addEventListener('animationend', () => node.classList.remove(className), { once: true })
    }

    function celebrate(x, y, color, hours, isDayComplete) {
        const layer = document.createElement('div')
        layer.className = `tb-celebration${isDayComplete ? ' tb-celebration--day' : ''}`
        layer.setAttribute('aria-hidden', 'true')
        layer.style.setProperty('--tb-burst-x', `${x}px`)
        layer.style.setProperty('--tb-burst-y', `${y}px`)
        layer.style.setProperty('--tb-burst-color', color)

        for (let i = 0; i < RAY_COUNT; i++) {
            const ray = document.createElement('span')
            ray.className = 'tb-burst-ray'
            ray.style.setProperty('--tb-angle', `${(360 / RAY_COUNT) * i + 18}deg`)
            layer.append(ray)
        }

        const count = isDayComplete ? FULL_DAY_CONFETTI_COUNT : CONFETTI_COUNT
        const spread = isDayComplete ? 90 : 46
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('span')
            piece.className = `tb-confetti${i % 3 === 0 ? ' tb-confetti--dot' : ''}`
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
            const distance = spread * (0.55 + Math.random() * 0.45)
            piece.style.setProperty('--tb-dx', `${Math.cos(angle) * distance}px`)
            piece.style.setProperty('--tb-dy', `${Math.sin(angle) * distance}px`)
            piece.style.setProperty('--tb-spin', `${(Math.random() - 0.5) * 720}deg`)
            piece.style.setProperty('--tb-delay', `${Math.round(Math.random() * 90)}ms`)
            piece.style.setProperty('--tb-confetti-color', i === 0 ? color : CONFETTI_COLORS[i % CONFETTI_COLORS.length])
            layer.append(piece)
        }

        const label = document.createElement('span')
        label.className = 'tb-capture-label'
        if (isDayComplete) {
            label.innerHTML = tbIcon('check')
            label.append('Day complete')
        } else {
            label.textContent = `+${formatDuration(hours)}`
        }
        layer.append(label)

        document.body.append(layer)
        setTimeout(() => layer.remove(), isDayComplete ? 2400 : 1600)
    }

    function formatDuration(hours) {
        const whole = Math.floor(hours)
        const minutes = Math.round((hours - whole) * 60)
        if (!whole) return `${minutes}m`
        return minutes ? `${whole}h ${String(minutes).padStart(2, '0')}m` : `${whole}h`
    }
})();
