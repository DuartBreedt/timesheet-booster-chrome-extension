(function () {
    'use strict';

    if (window.__STATS_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__STATS_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const STORAGE_KEY_STATS_COLLAPSED = 'statsCollapsed';
    const FULL_DAY_HOURS = 8;
    const MAX_BAR_ROWS = 7;
    const LOCATION_NAMES = { 2: 'Home', 3: 'Entelect', 4: 'Client', 5: 'Other' };
    const SENTIMENTS = [
        { id: 3, name: 'Sad', className: 'tb-sentiment-sad' },
        { id: 1, name: 'Neutral', className: 'tb-sentiment-neutral' },
        { id: 2, name: 'Happy', className: 'tb-sentiment-happy' }
    ];

    let panel;
    let refreshTimer;

    onDataLoaded.push(() => {
        renderPanel()
        observeDays()
        // bulk edit only changes tooltips, so redraws alone would miss it
        document.addEventListener('tb:result', (event) => {
            if (JSON.parse(event.detail).type !== 'getStats') scheduleRefresh()
        })
    })

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag)
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === undefined || value === false) return;
            if (key === 'class') node.className = value
            else if (key === 'text') node.textContent = value
            else if (key === 'html') node.innerHTML = value
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
            else node.setAttribute(key, value === true ? '' : value)
        })
        children.forEach((child) => child && node.append(child))
        return node
    }

    function formatHours(hours) {
        const minutes = Math.round(hours * 60)
        const whole = Math.floor(minutes / 60)
        const rest = minutes % 60
        return `${whole}h ${String(rest).padStart(2, '0')}m`
    }

    function percent(part, whole) {
        return whole ? Math.round((part / whole) * 100) : 0
    }

    function todayKey() {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    function isWeekend(dateKey) {
        const [year, month, date] = dateKey.split('-').map(Number)
        const weekday = new Date(year, month - 1, date).getDay()
        return weekday === 0 || weekday === 6
    }

    function renderPanel() {
        const days = document.querySelector('[data-bind="foreach: timesheetDays"]')
        const row = days && days.closest('.row-fluid')
        if (!row || document.querySelector('.tb-stats')) return;

        panel = el('details', { class: 'tb-stats' }, [
            el('summary', { class: 'tb-stats-summary' }, [
                el('span', { class: 'tb-stats-title', html: `${tbIcon('chart')}<span>Stats</span>` }),
                el('span', { class: 'tb-stats-range' })
            ]),
            el('div', { class: 'tb-stats-body' })
        ])
        row.before(panel)

        chrome.storage.local.get(STORAGE_KEY_STATS_COLLAPSED, (stored) => {
            // collapsed unless the user has expanded it before
            if (stored[STORAGE_KEY_STATS_COLLAPSED] === false) panel.open = true
        })
        panel.addEventListener('toggle', () => {
            chrome.storage.local.set({ [STORAGE_KEY_STATS_COLLAPSED]: !panel.open })
        })
    }

    // week changes and entry changes both re-render the captured times, which the bridges then tag
    function observeDays() {
        const days = document.querySelector('[data-bind="foreach: timesheetDays"]')
        if (!days) return;
        new MutationObserver(scheduleRefresh).observe(days, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-tb-date', 'data-tb-category']
        })
        scheduleRefresh()
    }

    function scheduleRefresh() {
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(refresh, 250)
    }

    async function refresh() {
        if (!panel) return;
        const result = await sendBridgeCommand({ type: 'getStats' })
        if (!result.ok) return;
        render(summarise(result.days))
        recordToday(result.days)
    }

    // read by the reminder in background.js, which can't see timesheets itself
    function recordToday(days) {
        const today = days.find((day) => day.date === todayKey())
        if (!today) return;
        chrome.storage.local.set({
            [STORAGE_KEY_TODAY_HOURS]: {
                date: today.date,
                hours: today.entries.reduce((sum, e) => sum + e.hours, 0),
                isHoliday: today.isHoliday
            }
        })
    }

    function summarise(days) {
        const today = todayKey()
        const all = days.flatMap((day) => day.entries)
        const total = all.reduce((sum, e) => sum + e.hours, 0)
        const sumBy = (predicate) => all.filter(predicate).reduce((sum, e) => sum + e.hours, 0)

        // days that should have 8 hours: weekdays up to today that aren't public holidays
        const workingDays = days
            .filter((day) => day.date <= today && !isWeekend(day.date) && !day.isHoliday)
            .map((day) => ({ ...day, hours: day.entries.reduce((sum, e) => sum + e.hours, 0) }))

        const group = (keyOf, labelOf, colorOf, subOf) => {
            const map = new Map()
            all.forEach((entry) => {
                const key = keyOf(entry)
                if (key === undefined) return;
                const row = map.get(key) || { label: labelOf(entry), sub: subOf && subOf(entry), color: colorOf && colorOf(entry), hours: 0 }
                row.hours += entry.hours
                map.set(key, row)
            })
            return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
        }

        const projectColor = (entry) => {
            const stored = getStoredProjectData(entry.project)
            return (stored && stored.color) || entry.projectColor
        }

        return {
            range: days.length ? `${days[0].label} to ${days[days.length - 1].label}` : '',
            dayCount: days.length,
            total,
            entryCount: all.length,
            billable: sumBy((e) => e.billable),
            signedOff: sumBy((e) => e.signedOff),
            leave: sumBy((e) => e.leave),
            workingDays,
            completeDays: workingDays.filter((day) => day.hours >= FULL_DAY_HOURS).length,
            shortDays: workingDays.filter((day) => day.hours < FULL_DAY_HOURS),
            projects: group((e) => e.project, (e) => e.project, projectColor),
            categories: group(
                (e) => `${e.project}\u0000${e.category}`,
                (e) => e.category,
                (e) => getColorFromData(e.project, e.category) || e.projectColor,
                (e) => e.project
            ),
            locations: group((e) => LOCATION_NAMES[e.locationId] ? e.locationId : undefined, (e) => LOCATION_NAMES[e.locationId]),
            sentiments: SENTIMENTS.map((s) => ({ ...s, count: all.filter((e) => e.sentimentId === s.id).length }))
        }
    }

    function render(stats) {
        panel.querySelector('.tb-stats-range').textContent = stats.range
            ? `${stats.range} · ${stats.dayCount} ${stats.dayCount === 1 ? 'day' : 'days'}`
            : ''
        const body = panel.querySelector('.tb-stats-body')

        if (!stats.entryCount) {
            body.replaceChildren(el('p', { class: 'tb-empty', text: 'No time captured on the days shown yet.' }))
            return;
        }

        const expected = stats.workingDays.length * FULL_DAY_HOURS
        const completion = percent(stats.completeDays, stats.workingDays.length)

        const tiles = [
            tile('Hours logged', formatHours(stats.total),
                expected ? `${formatHours(expected)} expected so far` : 'No working days so far',
                stats.leave ? `incl. ${formatHours(stats.leave)} leave` : undefined),
            tile('Days complete', stats.workingDays.length ? `${completion}%` : 'n/a',
                `${stats.completeDays} of ${stats.workingDays.length} working days have ${FULL_DAY_HOURS}h+`,
                undefined, stats.workingDays.length ? completion : undefined),
            tile('Billable', `${percent(stats.billable, stats.total)}%`, `${formatHours(stats.billable)} billable`),
            tile('Signed off', `${percent(stats.signedOff, stats.total)}%`, `${formatHours(stats.signedOff)} signed off`),
            tile('Entries', String(stats.entryCount), `${formatHours(stats.total / stats.entryCount)} on average`)
        ]

        body.replaceChildren(
            el('div', { class: 'tb-kpis' }, tiles),
            el('div', { class: 'tb-stats-grid' }, [
                card('Time per project', barList(fold(stats.projects), stats.total), 'tb-stats-card--wide'),
                card('Time per category', barList(fold(stats.categories), stats.total), 'tb-stats-card--wide'),
                card('Worked from', barList(stats.locations, stats.total, 'var(--tb-blue)')),
                card('Sentiment', sentimentBar(stats.sentiments, stats.entryCount)),
                card('Short days', shortDays(stats.shortDays))
            ])
        )
    }

    function tile(label, value, detail, extra, meter) {
        return el('div', { class: 'tb-kpi' }, [
            el('div', { class: 'tb-kpi-label', text: label }),
            el('div', { class: 'tb-kpi-value', text: value }),
            meter === undefined ? null : el('div', {
                class: 'tb-meter',
                role: 'meter',
                'aria-valuenow': String(meter),
                'aria-valuemin': '0',
                'aria-valuemax': '100',
                'aria-label': label
            }, [el('span', { style: `width: ${meter}%` })]),
            el('div', { class: 'tb-kpi-detail', text: detail }),
            extra ? el('div', { class: 'tb-kpi-detail', text: extra }) : null
        ])
    }

    function card(title, content, modifier) {
        return el('section', { class: `tb-stats-card ${modifier || ''}` }, [el('h4', { text: title }), content])
    }

    // past MAX_BAR_ROWS the tail becomes one "Other" row rather than more colors
    function fold(rows) {
        if (rows.length <= MAX_BAR_ROWS) return rows
        const head = rows.slice(0, MAX_BAR_ROWS - 1)
        const rest = rows.slice(MAX_BAR_ROWS - 1)
        return [...head, {
            label: `Other (${rest.length})`,
            sub: rest.map((r) => r.label).join(', '),
            color: 'var(--tb-faint)',
            hours: rest.reduce((sum, r) => sum + r.hours, 0)
        }]
    }

    function barList(rows, total, fallbackColor) {
        if (!rows.length) return el('p', { class: 'tb-stats-note', text: 'Nothing captured.' })
        return el('ul', { class: 'tb-bar-list' }, rows.map((row) => {
            const share = percent(row.hours, total)
            const color = row.color || fallbackColor || 'var(--tb-faint)'
            return el('li', {
                class: 'tb-bar-row',
                title: `${row.label}${row.sub ? ` (${row.sub})` : ''}: ${formatHours(row.hours)}, ${share}% of time`
            }, [
                el('span', { class: 'tb-bar-label' }, [
                    el('span', { class: 'tb-bar-name', text: row.label }),
                    row.sub ? el('small', { text: row.sub }) : null
                ]),
                el('span', { class: 'tb-bar-track' }, [
                    el('span', { class: 'tb-bar-fill', style: `width: ${Math.max(share, 1)}%; --tb-bar: ${color}` })
                ]),
                el('span', { class: 'tb-bar-value' }, [
                    el('span', { text: formatHours(row.hours) }),
                    el('small', { text: `${share}%` })
                ])
            ])
        }))
    }

    function sentimentBar(sentiments, count) {
        const happy = sentiments.find((s) => s.id === 2).count
        const sad = sentiments.find((s) => s.id === 3).count
        // happy +1, neutral 0, sad -1, averaged per entry
        const score = count ? (happy - sad) / count : 0
        const mood = score > 0.5 ? 'Happy'
            : score > 0.15 ? 'Leaning happy'
            : score < -0.5 ? 'Sad'
            : score < -0.15 ? 'Leaning sad'
            : 'Neutral'

        return el('div', { class: 'tb-sentiment-stats' }, [
            el('div', { class: 'tb-stats-headline', text: mood }),
            el('div', { class: 'tb-stats-note', text: `Average of ${count} ${count === 1 ? 'entry' : 'entries'}` }),
            el('div', { class: 'tb-stacked', role: 'img', 'aria-label': sentiments.map((s) => `${s.name} ${percent(s.count, count)}%`).join(', ') },
                sentiments.filter((s) => s.count).map((s) => el('span', {
                    class: `tb-stacked-part ${s.className}`,
                    style: `flex-grow: ${s.count}`,
                    title: `${s.name}: ${s.count} ${s.count === 1 ? 'entry' : 'entries'}, ${percent(s.count, count)}%`
                }))),
            el('ul', { class: 'tb-legend' }, sentiments.map((s) => el('li', {}, [
                el('span', { class: `tb-legend-swatch ${s.className}`, 'aria-hidden': 'true' }),
                el('span', { text: s.name }),
                el('small', { text: `${s.count} · ${percent(s.count, count)}%` })
            ])))
        ])
    }

    function shortDays(days) {
        if (!days.length) {
            return el('p', { class: 'tb-stats-note', text: `Every working day so far has ${FULL_DAY_HOURS} hours or more.` })
        }
        return el('ul', { class: 'tb-short-days' }, days.map((day) => el('li', {}, [
            el('span', { text: day.label }),
            el('span', { class: 'tb-short-days-hours', text: `${formatHours(day.hours)}, ${formatHours(FULL_DAY_HOURS - day.hours)} short` })
        ])))
    }
})();
