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
    const BIRTHDAY_CONFETTI_COUNT = 44;
    // muted warm and cool accents from the palette, so the confetti sits with the rest of the page
    const CONFETTI_COLORS = ['#eca65e', '#7cb677', '#7e95c8', '#c57791', '#cab072', '#72adb9'];
    // seasonal palettes while theme.js has a holiday season on
    const SEASON_CONFETTI_COLORS = {
        'tb-festive': ['#c94a4a', '#2f8a57', '#d9a93f', '#e07a6a', '#7cb677', '#b8323a'],
        'tb-halloween': ['#e07b24', '#7b4bb3', '#8fb339', '#f0a64a', '#5e3a87', '#c8611d']
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.addEventListener('tb:entry-captured', onEntryCaptured)
    document.addEventListener('tb:birthday-shown', onBirthdayShown)

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
            celebrate(rect.right, rect.top + rect.height / 2, getComputedStyle(block).backgroundColor, isDayComplete
                ? { variant: 'day', icon: 'check', text: 'Day complete' }
                : { variant: 'entry', text: `+${formatDuration(hours)}` })
        })
    }

    // bursts the first time each birthday scrolls into view
    function onBirthdayShown(event) {
        const { date } = JSON.parse(event.detail)
        const day = date ? document.querySelector(`.timeEntry[data-tb-date="${date}"]`) : undefined
        const block = (day || document).querySelector('.timeEntry-capturedTime[data-tb-special="birthday"]')
        if (!block || reducedMotion.matches) return;

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect()
            const dayElement = block.closest('.timeEntry')
            const birthday = dayElement ? dayElement.dataset.tbDate : ''

            chrome.storage.local.get(STORAGE_KEY_BIRTHDAY_CELEBRATED, (stored) => {
                if (birthday && stored[STORAGE_KEY_BIRTHDAY_CELEBRATED] === birthday) return;
                chrome.storage.local.set({ [STORAGE_KEY_BIRTHDAY_CELEBRATED]: birthday })
                burstFromBirthday(block)
            })
        }, { threshold: 0.6 })
        observer.observe(block)
    }

    function burstFromBirthday(block) {
        const rect = block.getBoundingClientRect()
        celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFETTI_COLORS[0], {
            variant: 'birthday',
            icon: 'cake',
            text: 'Happy birthday!'
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

    // variant: "entry" for a saved entry, "day" for reaching 8 hours, "birthday" for birthday leave
    function celebrate(x, y, color, { variant, icon, text }) {
        const layer = document.createElement('div')
        layer.className = `tb-celebration${variant === 'entry' ? '' : ` tb-celebration--${variant}`}`
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

        const season = Object.keys(SEASON_CONFETTI_COLORS).find((name) => document.documentElement.classList.contains(name))
        const colors = season ? SEASON_CONFETTI_COLORS[season] : CONFETTI_COLORS
        const count = { entry: CONFETTI_COUNT, day: FULL_DAY_CONFETTI_COUNT, birthday: BIRTHDAY_CONFETTI_COUNT }[variant]
        const spread = { entry: 46, day: 90, birthday: 160 }[variant]
        // a birthday bursts all the way round, the rest fan upwards
        const arc = variant === 'birthday' ? Math.PI * 2 : Math.PI * 1.1
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('span')
            piece.className = `tb-confetti${i % 3 === 0 ? ' tb-confetti--dot' : ''}`
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * arc
            const distance = spread * (0.55 + Math.random() * 0.45)
            piece.style.setProperty('--tb-dx', `${Math.cos(angle) * distance}px`)
            piece.style.setProperty('--tb-dy', `${Math.sin(angle) * distance}px`)
            piece.style.setProperty('--tb-spin', `${(Math.random() - 0.5) * 720}deg`)
            piece.style.setProperty('--tb-delay', `${Math.round(Math.random() * 90)}ms`)
            piece.style.setProperty('--tb-confetti-color', i === 0 ? color : colors[i % colors.length])
            layer.append(piece)
        }

        const label = document.createElement('span')
        label.className = 'tb-capture-label'
        if (icon) label.innerHTML = tbIcon(icon)
        label.append(text)
        layer.append(label)

        document.body.append(layer)
        setTimeout(() => layer.remove(), { entry: 1600, day: 2400, birthday: 3200 }[variant])
    }

    function formatDuration(hours) {
        const whole = Math.floor(hours)
        const minutes = Math.round((hours - whole) * 60)
        if (!whole) return `${minutes}m`
        return minutes ? `${whole}h ${String(minutes).padStart(2, '0')}m` : `${whole}h`
    }
})();
