(function () {
    'use strict';

    if (window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__ = true;

    // ids match timesheets' own values
    const LOCATIONS = [
        { id: 2, name: 'Home', icon: 'home' },
        { id: 3, name: 'Entelect', icon: 'building' },
        { id: 4, name: 'Client', icon: 'user' },
        { id: 5, name: 'Other', icon: 'dots' }
    ];
    const SENTIMENTS = [
        // same order as timesheets' own sentiment buttons
        { id: 3, name: 'Sad', icon: 'frown', buttonClass: 'sentiment-sad' },
        { id: 1, name: 'Neutral', icon: 'meh', buttonClass: 'sentiment-neutral' },
        { id: 2, name: 'Happy', icon: 'smile', buttonClass: 'sentiment-happy' }
    ];

    // see redesign.css
    const VIEW_FORM = 'form';
    const VIEW_BULK = 'bulk';
    const VIEW_MOVE = 'move';
    const VIEW_COPY = 'copy';

    let templates = [];
    let reminder = { enabled: false, time: DEFAULT_REMINDER_TIME };

    onDataLoaded.push(() => {
        loadTemplates()
        loadSettings()
        renderHeaderActions()
        observeForms()

        document.addEventListener('tb:template-captured', onTemplateCaptured)
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes[STORAGE_KEY_TEMPLATES]) {
                templates = changes[STORAGE_KEY_TEMPLATES].newValue || []
                renderAllTemplateCards()
            }
            // bulk, move and copy are only reachable from quick actions, so an open one would be stranded
            if (area === 'sync' && changes[STORAGE_KEY_QUICK_ACTIONS_ENABLED] && changes[STORAGE_KEY_QUICK_ACTIONS_ENABLED].newValue === false) {
                document.querySelectorAll(`.timeEntry-container.tb-has-quick:not([data-tb-view="${VIEW_FORM}"])`)
                    .forEach((container) => setView(container, VIEW_FORM))
            }
        })
    })

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag)
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === undefined || value === false) return;
            if (key === 'class') node.className = value
            else if (key === 'text') node.textContent = value
            else if (key === 'html') node.innerHTML = value // static markup only, never user data
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
            else node.setAttribute(key, value === true ? '' : value)
        })
        children.forEach((child) => child && node.append(child))
        return node
    }

    function formatDuration(hours) {
        const whole = Math.floor(hours)
        const minutes = Math.round((hours - whole) * 60)
        if (!whole) return `${minutes}m`
        return minutes ? `${whole}h ${String(minutes).padStart(2, '0')}m` : `${whole}h`
    }

    function toast(message, isError, duration = 3500) {
        const node = el('div', { class: `tb-toast${isError ? ' tb-toast--error' : ''}`, role: 'status', text: message })
        document.body.append(node)
        setTimeout(() => node.classList.add('tb-toast--leaving'), duration)
        setTimeout(() => node.remove(), duration + 500)
    }

    // local not sync: descriptions can push templates past sync's 8kb per-item quota
    function loadTemplates() {
        chrome.storage.local.get(STORAGE_KEY_TEMPLATES, (stored) => {
            templates = stored[STORAGE_KEY_TEMPLATES] || []
            renderAllTemplateCards()
        })
    }

    function saveTemplates(next) {
        templates = next
        chrome.storage.local.set({ [STORAGE_KEY_TEMPLATES]: next })
        renderAllTemplateCards()
    }

    function renderAllTemplateCards() {
        document.querySelectorAll('.tb-templates').forEach(renderTemplateCard)
        document.querySelectorAll('.tb-manage').forEach(renderManageCard)
    }

    function onTemplateCaptured(event) {
        const { name, entry } = JSON.parse(event.detail)
        const fallbackName = (entry.Description || '').trim().slice(0, 40) || entry.CategoryName
        const template = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: name || fallbackName,
            projectId: entry.ProjectId,
            projectName: entry.ProjectName,
            categoryId: entry.CategoryId,
            categoryName: entry.CategoryName,
            durationInHours: entry.DurationInHours,
            description: entry.Description || '',
            ticketNumber: entry.TicketReference || '',
            sentimentId: Number(entry.SentimentId) || 1,
            billable: !!entry.Billable,
            workedFromLocationId: Number(entry.WorkedFromLocationId),
            isLeave: !!entry.IsLeave
        }
        saveTemplates([...templates, template])
        toast(`Saved "${template.name}" as a template`)
    }

    function templateTitle(template) {
        return template.name === template.categoryName ? template.name : `${template.name} (${template.categoryName})`
    }

    function templateMeta(template) {
        const location = LOCATIONS.find((l) => l.id === template.workedFromLocationId)
        return [template.projectName, formatDuration(template.durationInHours), location && location.name].filter(Boolean).join(' • ')
    }

    function templateSummary(template) {
        const color = getColorFromData(template.projectName, template.categoryName) || '#8A8E93'
        return [
            el('span', { class: 'tb-template-avatar', 'aria-hidden': 'true', style: `--tb-color: ${color}`, text: (template.name[0] || '?').toUpperCase() }),
            el('span', { class: 'tb-template-text' }, [
                el('strong', { text: templateTitle(template) }),
                el('small', { text: templateMeta(template) })
            ])
        ]
    }

    function observeForms() {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => enhanceForm(mutation.target))
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-tb-mode'] })

        document.querySelectorAll('.timeEntry-container[data-tb-mode]').forEach(enhanceForm)
    }

    // bulk edit day replaces everything right of quick actions while open
    function enhanceForm(container) {
        if (!container.dataset.tbMode || container.querySelector('.tb-quick')) return;

        const day = container.closest('.timeEntry')
        const total = el('span', { text: getDayTotal(day) })
        const refreshTotal = () => { total.textContent = getDayTotal(day) }
        const toggleView = (view) => setView(container, container.dataset.tbView === view ? VIEW_FORM : view)
        const showForm = () => setView(container, VIEW_FORM)

        const quick = el('aside', { class: 'tb-quick', 'aria-label': 'Quick actions' }, [
            el('div', { class: 'tb-quick-date', text: getDayLabel(day) }),
            el('div', { class: 'tb-quick-total', html: tbIcon('clock') }, [total]),
            el('div', { class: 'tb-quick-heading', html: `${tbIcon('bolt')}<span>Quick Actions</span>` }),
            buildActionButton(VIEW_BULK, 'tb-action--bulk', 'pencil', 'Bulk Edit Day', 'Office, sentiment, move or delete', toggleView),
            buildActionButton(VIEW_MOVE, 'tb-action--move', 'move', 'Move Entry', 'Captured on the wrong day?', toggleView),
            buildActionButton(VIEW_COPY, 'tb-action--copy', 'duplicate', 'Copy to Other Days', 'Same entry on more days', toggleView)
        ])

        const templatesCard = el('div', { class: 'tb-card tb-templates' })
        templatesCard.tbDay = day
        templatesCard.tbRefreshTotal = refreshTotal
        renderTemplateCard(templatesCard)

        container.prepend(quick)
        container.append(
            el('div', { class: 'tb-or', 'aria-hidden': 'true' }, [el('span', { text: 'OR' })]),
            templatesCard,
            buildBulkCard(day, showForm, refreshTotal),
            buildMoveCard(day, container, showForm),
            buildCopyCard(day, container, showForm)
        )
        container.classList.add('tb-has-quick')
        container.dataset.tbView = VIEW_FORM

        const content = container.querySelector('.timeEntry-content')
        if (container.dataset.tbMode === 'new') {
            if (content) content.append(buildSaveTemplateRow())
        }
        if (content) groupFormButtons(content)
        makeTimeScrubbable(container)
        if (container.dataset.tbMode === 'new') revealEntryActionsOnDescription(container, quick, showForm)
    }

    // Time field: drag or scroll right/up for +15 minutes, left/down for -15 (arrow keys too). A plain click still
    // edits the text. Changes fire "change" so the form's knockout binding picks them up as if typed.
    const TIME_STEP_MINUTES = 15
    const TIME_STEP_PIXELS = 10
    // trackpad scroll distance per step; a mouse wheel click is always one step
    const TIME_WHEEL_PIXELS = 40
    // a page that was scrolling this recently keeps scrolling when the cursor passes over the field
    const TIME_WHEEL_SCROLL_GRACE_MS = 300
    let lastPageScroll = 0
    window.addEventListener('scroll', () => { lastPageScroll = Date.now() }, { capture: true, passive: true })
    const TIME_MIN_MINUTES = 15
    const TIME_MAX_MINUTES = 23 * 60 + 45

    function parseTime(value) {
        const match = /^\s*(\d{1,2})h(\d{1,2})\s*$/i.exec(value || '')
        return match ? Number(match[1]) * 60 + Number(match[2]) : 0
    }

    function setTime(input, minutes) {
        const clamped = Math.min(TIME_MAX_MINUTES, Math.max(TIME_MIN_MINUTES, minutes))
        const formatted = `${Math.floor(clamped / 60)}h${String(clamped % 60).padStart(2, '0')}`
        if (input.value === formatted) return;
        input.value = formatted
        input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // Steps from the nearest quarter hour, so 1h20 dragged up becomes 1h30, not 1h35
    function snapToStep(minutes) {
        return Math.round(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES
    }

    function makeTimeScrubbable(container) {
        const input = container.querySelector('.timeEntry-content-time input')
        if (!input || input.classList.contains('tb-time-scrub')) return;
        input.classList.add('tb-time-scrub')
        input.title = 'Drag, scroll or use the arrow keys to change by 15 minutes, or click to type'

        let drag // { x, y, minutes, steps, moved }

        input.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            // Stops the drag selecting text; a click without movement focuses the field below
            e.preventDefault()
            drag = { x: e.clientX, y: e.clientY, minutes: snapToStep(parseTime(input.value)), steps: 0, moved: false }
            // Keeps the drag going when the pointer leaves the field
            try { input.setPointerCapture(e.pointerId) } catch (err) { /* not a capturable pointer */ }
        })

        input.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x
            const dy = e.clientY - drag.y
            if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
            drag.moved = true
            document.documentElement.classList.add('tb-scrubbing')

            // Right and up increase, left and down decrease
            const steps = Math.trunc((dx - dy) / TIME_STEP_PIXELS)
            if (steps !== drag.steps) {
                drag.steps = steps
                setTime(input, drag.minutes + steps * TIME_STEP_MINUTES)
            }
        })

        const endDrag = () => {
            if (!drag) return;
            const wasDrag = drag.moved
            drag = undefined
            document.documentElement.classList.remove('tb-scrubbing')
            if (!wasDrag) {
                input.focus()
                input.select()
            }
        }
        input.addEventListener('pointerup', endDrag)
        input.addEventListener('pointercancel', endDrag)

        input.addEventListener('keydown', (e) => {
            const direction = { ArrowUp: 1, ArrowDown: -1 }[e.key]
            if (!direction) return;
            e.preventDefault()
            setTime(input, snapToStep(parseTime(input.value)) + direction * TIME_STEP_MINUTES)
        })

        let wheelDistance = 0
        input.addEventListener('wheel', (e) => {
            // ctrl is how trackpad pinch-zoom arrives
            if (e.ctrlKey || Date.now() - lastPageScroll < TIME_WHEEL_SCROLL_GRACE_MS) return;
            e.preventDefault()

            // Up and right increase, like dragging
            const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : -e.deltaX
            const isWheelClick = e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(delta) >= TIME_WHEEL_PIXELS
            wheelDistance = isWheelClick ? delta : wheelDistance + delta
            if (Math.abs(wheelDistance) < TIME_WHEEL_PIXELS && !isWheelClick) return;

            setTime(input, snapToStep(parseTime(input.value)) - Math.sign(wheelDistance) * TIME_STEP_MINUTES)
            wheelDistance = 0
        }, { passive: false })
    }

    // An unsaved entry can only be moved or copied once there is something to move: wait for a description
    function revealEntryActionsOnDescription(container, quick, showForm) {
        const description = container.querySelector('.timeEntry-content textarea')
        const actions = quick.querySelectorAll('.tb-action--move, .tb-action--copy')
        if (!description) return;

        const sync = () => {
            const hasDescription = description.value.trim().length > 0
            actions.forEach((action) => { action.hidden = !hasDescription })
            if (!hasDescription && [VIEW_MOVE, VIEW_COPY].includes(container.dataset.tbView)) showForm()
        }
        description.addEventListener('input', sync)
        sync()
    }

    // moving the elements keeps their knockout click bindings
    function groupFormButtons(content) {
        const save = content.querySelector('.timeEntry-content-buttons .save')
        const cancel = content.querySelector('.timeEntry-content-buttons .cancel')
        if (!save || !cancel) return;
        content.append(el('div', { class: 'tb-form-buttons' }, [
            save.closest('.timeEntry-content-buttons'),
            cancel.closest('.timeEntry-content-buttons')
        ]))
    }

    function buildActionButton(view, className, icon, title, subtitle, onSelect) {
        return el('button', {
            type: 'button',
            class: `tb-action ${className}`,
            'data-tb-view': view,
            'aria-pressed': 'false',
            onclick: () => onSelect(view)
        }, [
            el('span', { class: 'tb-action-icon', html: tbIcon(icon) }),
            el('span', { class: 'tb-action-text' }, [
                el('strong', { text: title }),
                el('small', { text: subtitle })
            ])
        ])
    }

    function setView(container, view) {
        container.dataset.tbView = view
        container.querySelectorAll('.tb-action').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.tbView === view))
        })

        if (view === VIEW_BULK) container.querySelector('.tb-bulk').tbPrefill()
        if (view === VIEW_MOVE) container.querySelector('.tb-move').tbPrefill()
        if (view === VIEW_COPY) container.querySelector('.tb-copy').tbPrefill()

        const focusTarget = view === VIEW_FORM
            ? container.querySelector('.timeEntry-content textarea')
            : container.querySelector(`.tb-${view} button`)
        if (focusTarget) focusTarget.focus({ preventScroll: true })
    }

    // Changes go through one entry at a time, so the page is locked until they finish: clicking around meanwhile
    // could edit an entry that is about to move, or close the form the panel lives in
    async function runLocked(label, unit, command) {
        const progressText = el('small', { class: 'tb-busy-progress' })
        const overlay = el('div', { class: 'tb-busy', role: 'status', 'aria-live': 'polite' }, [
            el('div', { class: 'tb-busy-card' }, [
                el('span', { class: 'tb-spinner', 'aria-hidden': 'true' }),
                el('div', { class: 'tb-busy-text' }, [el('strong', { text: label }), progressText]),
                el('span', { class: 'tb-busy-bar', 'aria-hidden': 'true' })
            ])
        ])
        const focused = document.activeElement
        const locked = Array.from(document.body.children).filter((node) => !node.inert)
        locked.forEach((node) => { node.inert = true })
        document.body.append(overlay)
        window.addEventListener('beforeunload', warnWhileBusy)

        try {
            return await sendBridgeCommand(command, ({ done, total }) => {
                overlay.dataset.tbDeterminate = ''
                overlay.style.setProperty('--tb-progress', String(total ? done / total : 0))
                progressText.textContent = `${done + 1} of ${total} ${unit}`
            })
        } finally {
            window.removeEventListener('beforeunload', warnWhileBusy)
            locked.forEach((node) => { node.inert = false })
            overlay.remove()
            if (focused && focused.isConnected) focused.focus({ preventScroll: true })
        }
    }

    function warnWhileBusy(event) {
        event.preventDefault()
        event.returnValue = ''
    }

    // A finished quick action closes its panel and returns to the entry form (if the form is still open,
    // moving or deleting closes it), so the outcome is shown as a toast. Failures stay in the panel.
    function showResult(result, status, close) {
        if (result.ok) {
            toast(result.message)
            close()
            return;
        }
        status.className = 'tb-status tb-status--error'
        status.textContent = result.message
    }

    function getDayLabel(day) {
        const date = day.querySelector('.timeEntry-date')
        return date && date.firstChild ? date.firstChild.textContent.trim() : ''
    }

    function getDayTotal(day) {
        const total = day.querySelector('.timeEntry-totalHoursWorked')
        return total ? total.textContent.trim() : ''
    }

    function buildSaveTemplateRow() {
        const nameInput = el('input', {
            type: 'text',
            class: 'tb-save-template-name',
            placeholder: 'Template name (e.g. Daily Standup)',
            maxlength: '60',
            'aria-label': 'Template name',
            hidden: true
        })
        const toggle = el('input', {
            type: 'checkbox',
            class: 'tb-save-template-toggle',
            onchange: () => {
                nameInput.hidden = !toggle.checked
                if (toggle.checked) nameInput.focus()
            }
        })
        return el('div', { class: 'tb-save-template' }, [
            el('label', { class: 'tb-check' }, [toggle, el('span', { text: 'Save as template' })]),
            nameInput
        ])
    }

    // clicking the selected one clears it since fields are optional
    function buildChoiceGroup(className, label, options, onChange) {
        let value
        const showNames = className === 'tb-locations'
        const buttons = options.map((option) => el('button', {
            type: 'button',
            class: 'tb-choice',
            'aria-pressed': 'false',
            'aria-label': showNames ? undefined : option.name,
            title: option.name,
            'data-value': String(option.id),
            html: tbIcon(option.icon),
            onclick: () => setValue(value === option.id ? undefined : option.id)
        }, showNames ? [el('span', { text: option.name })] : []))

        function setValue(next) {
            value = next
            buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.value === String(next))))
            onChange(next)
        }

        const group = el('div', { class: `tb-choices ${className}`, role: 'group', 'aria-label': label }, buttons)
        return { group, setValue, getValue: () => value }
    }

    // Every change applies to the whole day, so each is a row of the same shape: what | how | do it.
    // Signed-off entries are never changed.
    function buildBulkCard(day, close, refreshTotal) {
        const status = el('p', { class: 'tb-status', role: 'status' })

        const run = async (button, busyText, command) => {
            button.disabled = true
            status.className = 'tb-status'
            status.textContent = ''
            const result = await runLocked(busyText, 'entries', Object.assign({ date: day.dataset.tbDate }, command))
            refreshTotal()
            updateButtons()
            showResult(result, status, close)
        }

        const locations = buildChoiceGroup('tb-locations', 'Worked from', LOCATIONS, () => updateButtons())
        const sentiments = buildChoiceGroup('tb-sentiments', 'Sentiment', SENTIMENTS, () => updateButtons())
        const dateInput = el('input', {
            type: 'date',
            class: 'tb-date-input',
            id: `tb-move-all-${day.dataset.tbDate}`,
            'aria-label': 'Move all entries to',
            oninput: () => updateButtons()
        })

        const officeButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            html: `${tbIcon('check')}<span>Set office</span>`,
            onclick: () => run(officeButton, 'Updating entries', { type: 'bulkEdit', locationId: locations.getValue() })
        })
        const sentimentButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            html: `${tbIcon('check')}<span>Set sentiment</span>`,
            onclick: () => run(sentimentButton, 'Updating entries', { type: 'bulkEdit', sentimentId: sentiments.getValue() })
        })
        const moveButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            html: `${tbIcon('move')}<span>Move all</span>`,
            onclick: () => run(moveButton, 'Moving entries', {
                type: 'moveDay',
                targetDate: dateInput.value,
                targetLabel: formatDayLabel(dateInput.value)
            })
        })
        const deleteButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--danger',
            html: `${tbIcon('close')}<span>Delete all</span>`,
            onclick: () => {
                if (!confirm(`Delete all entries on ${getDayLabel(day)}? Signed-off entries are kept. This cannot be undone.`)) return;
                run(deleteButton, 'Deleting entries', { type: 'deleteDay' })
            }
        })

        function updateButtons() {
            officeButton.disabled = !locations.getValue()
            sentimentButton.disabled = !sentiments.getValue()
            moveButton.disabled = !dateInput.value || dateInput.value === day.dataset.tbDate
            deleteButton.disabled = false
        }

        const row = (title, help, control, button) => el('div', { class: 'tb-bulk-row' }, [
            el('div', { class: 'tb-bulk-row-label' }, [
                el('strong', { text: title }),
                el('small', { text: help })
            ]),
            el('div', { class: 'tb-bulk-row-control' }, [control]),
            button
        ])

        const card = el('div', { class: 'tb-card tb-bulk' }, [
            el('h3', { class: 'tb-card-title', html: `${tbIcon('pencil')}<span>Bulk Edit Day</span>` }),
            el('p', { class: 'tb-card-subtitle', text: 'Each change applies to every entry on this day. Signed-off entries are never changed.' }),
            row('Worked from', 'Office for every entry', locations.group, officeButton),
            row('Sentiment', 'Sentiment for every entry', sentiments.group, sentimentButton),
            row('Move entries', 'Captured on the wrong day?', dateInput, moveButton),
            row('Delete entries', 'Removes every entry on this day.', el('span'), deleteButton),
            el('div', { class: 'tb-card-buttons' }, [
                el('button', { type: 'button', class: 'tb-button', text: 'Close', onclick: close })
            ]),
            status
        ])

        // start from what the open entry form has selected
        card.tbPrefill = () => {
            status.textContent = ''
            const form = day.querySelector('.timeEntry-content')
            const radio = form && form.querySelector('input[type="radio"]:checked')
            const sentiment = form && SENTIMENTS.find((s) => form.querySelector(`.${s.buttonClass}.active`))
            locations.setValue(radio ? Number(radio.value) : locations.getValue())
            sentiments.setValue(sentiment ? sentiment.id : sentiments.getValue())
            dateInput.value = day.dataset.tbDate
            updateButtons()
        }

        return card
    }

    function isWeekday(dateKey) {
        const [year, month, date] = dateKey.split('-').map(Number)
        const weekday = new Date(year, month - 1, date).getDay()
        return weekday !== 0 && weekday !== 6
    }

    // Copies the saved entry to any number of other days: the days in view as toggle pills, plus any date
    function buildCopyCard(day, container, close) {
        const status = el('p', { class: 'tb-status', role: 'status' })
        const summary = el('div', { class: 'tb-move-summary' })
        const pills = el('div', { class: 'tb-choices tb-day-pills', role: 'group', 'aria-label': 'Days to copy to' })
        const selected = new Set()

        const syncSelection = () => {
            pills.querySelectorAll('.tb-choice').forEach((pill) => {
                pill.setAttribute('aria-pressed', String(selected.has(pill.dataset.date)))
            })
            copyButton.disabled = selected.size === 0
            copyButton.querySelector('span').textContent = selected.size
                ? `Copy to ${selected.size} ${selected.size === 1 ? 'day' : 'days'}`
                : 'Copy'
        }

        const addPill = (dateKey, label) => {
            if (dateKey === day.dataset.tbDate || pills.querySelector(`[data-date="${dateKey}"]`)) return;
            pills.append(el('button', {
                type: 'button',
                class: 'tb-choice',
                'data-date': dateKey,
                'aria-pressed': 'false',
                text: label,
                onclick: () => {
                    selected.has(dateKey) ? selected.delete(dateKey) : selected.add(dateKey)
                    syncSelection()
                }
            }))
        }

        const extraDate = el('input', {
            type: 'date',
            class: 'tb-date-input',
            id: `tb-copy-date-${day.dataset.tbDate}`,
            'aria-label': 'Another date'
        })
        const addDateButton = el('button', {
            type: 'button',
            class: 'tb-button',
            text: 'Add date',
            onclick: () => {
                const dateKey = extraDate.value
                if (!dateKey || dateKey === day.dataset.tbDate) return;
                addPill(dateKey, formatDayLabel(dateKey))
                selected.add(dateKey)
                syncSelection()
                extraDate.value = ''
            }
        })

        const copyButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            disabled: true,
            html: `${tbIcon('duplicate')}<span>Copy</span>`,
            onclick: async () => {
                copyButton.disabled = true
                status.className = 'tb-status'
                status.textContent = ''
                const targets = Array.from(selected).sort().map((dateKey) => ({
                    date: dateKey,
                    label: pills.querySelector(`[data-date="${dateKey}"]`).textContent
                }))
                const result = await runLocked('Copying entry', 'days', { type: 'copyEntry', date: day.dataset.tbDate, targets })
                if (result.ok) selected.clear()
                syncSelection()
                showResult(result, status, close)
            }
        })

        const card = el('div', { class: 'tb-card tb-copy' }, [
            el('h3', { class: 'tb-card-title', html: `${tbIcon('duplicate')}<span>Copy to Other Days</span>` }),
            container.dataset.tbMode === 'new' ? undefined : el('p', {
                class: 'tb-card-subtitle',
                text: 'Create the same entry on other days. This entry stays where it is. Unsaved changes in the form are not copied.'
            }),
            summary,
            el('div', { class: 'tb-field-label', text: 'Days' }),
            pills,
            el('div', { class: 'tb-copy-shortcuts' }, [
                el('button', {
                    type: 'button',
                    class: 'tb-small-button',
                    text: 'Weekdays',
                    onclick: () => {
                        pills.querySelectorAll('.tb-choice').forEach((pill) => {
                            if (isWeekday(pill.dataset.date)) selected.add(pill.dataset.date)
                        })
                        syncSelection()
                    }
                }),
                el('button', {
                    type: 'button',
                    class: 'tb-small-button',
                    text: 'Clear',
                    onclick: () => { selected.clear(); syncSelection() }
                })
            ]),
            el('label', { class: 'tb-field-label', for: extraDate.id, text: 'Another date' }),
            el('div', { class: 'tb-copy-extra' }, [extraDate, addDateButton]),
            el('div', { class: 'tb-card-buttons' }, [
                copyButton,
                el('button', { type: 'button', class: 'tb-button', text: 'Cancel', onclick: close })
            ]),
            status
        ])

        card.tbPrefill = () => {
            status.textContent = ''
            const banner = container.querySelector('.timeEntry-banner')
            const time = container.querySelector('.timeEntry-content-time input')
            summary.replaceChildren(
                el('strong', { text: banner ? banner.textContent.trim() : '' }),
                el('span', { text: `${getDayLabel(day)}${time && time.value ? ` • ${time.value}` : ''}` })
            )
            selected.clear()
            pills.replaceChildren()
            document.querySelectorAll('.timeEntry[data-tb-date]').forEach((other) => {
                addPill(other.dataset.tbDate, getDayLabel(other))
            })
            syncSelection()
        }

        return card
    }

    function formatDayLabel(dateKey) {
        const [year, month, date] = dateKey.split('-').map(Number)
        return new Date(year, month - 1, date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    }

    function buildMoveCard(day, container, close) {
        const status = el('p', { class: 'tb-status', role: 'status' })
        const summary = el('div', { class: 'tb-move-summary' })
        const dateInput = el('input', {
            type: 'date',
            class: 'tb-date-input',
            id: `tb-move-date-${day.dataset.tbDate}`,
            oninput: () => update()
        })
        const update = () => { moveButton.disabled = !dateInput.value || dateInput.value === day.dataset.tbDate }

        const moveButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            disabled: true,
            html: `${tbIcon('move')}<span>Move Entry</span>`,
            onclick: async () => {
                moveButton.disabled = true
                status.className = 'tb-status'
                status.textContent = ''
                const targetLabel = formatDayLabel(dateInput.value)
                const result = await runLocked('Moving entry', '', { type: 'moveEntry', date: day.dataset.tbDate, targetDate: dateInput.value, targetLabel })
                update()
                showResult(result, status, close)
            }
        })

        const card = el('div', { class: 'tb-card tb-move' }, [
            el('h3', { class: 'tb-card-title', html: `${tbIcon('move')}<span>Move Entry</span>` }),
            container.dataset.tbMode === 'new' ? undefined : el('p', {
                class: 'tb-card-subtitle',
                text: 'Move this entry to the day it should have been captured on. Unsaved changes in the form are not moved.'
            }),
            summary,
            el('label', { class: 'tb-field-label', for: dateInput.id, text: 'Move to' }),
            dateInput,
            el('div', { class: 'tb-card-buttons' }, [
                moveButton,
                el('button', { type: 'button', class: 'tb-button', text: 'Cancel', onclick: close })
            ]),
            status
        ])

        card.tbPrefill = () => {
            status.textContent = ''
            const banner = container.querySelector('.timeEntry-banner')
            const time = container.querySelector('.timeEntry-content-time input')
            summary.replaceChildren(
                el('strong', { text: banner ? banner.textContent.trim() : '' }),
                el('span', { text: `${getDayLabel(day)}${time && time.value ? ` • ${time.value}` : ''}` })
            )
            dateInput.value = day.dataset.tbDate
            update()
        }

        return card
    }

    function renderTemplateCard(card) {
        const day = card.tbDay
        let selectedId = templates.some((t) => t.id === card.dataset.tbSelected) ? card.dataset.tbSelected : ''
        const status = el('p', { class: 'tb-status', role: 'status' })

        const select = el('select', {
            class: 'tb-template-select',
            'aria-label': 'Template',
            onchange: () => setSelected(select.value)
        }, [
            new Option('Select a template…', ''),
            ...templates.map((t) => new Option(templateTitle(t), t.id))
        ])

        const addButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            html: `${tbIcon('check')}<span>Add to Day</span>`,
            onclick: async () => {
                const template = templates.find((t) => t.id === selectedId)
                if (!template) return;
                addButton.disabled = true
                status.className = 'tb-status'
                status.textContent = ''
                const result = await runLocked('Adding entry', '', { type: 'applyTemplate', date: day.dataset.tbDate, template })
                if (result.ok) toast(result.message)
                // on success the entry form closes and takes this card with it
                status.className = `tb-status ${result.ok ? 'tb-status--ok' : 'tb-status--error'}`
                status.textContent = result.message
                card.tbRefreshTotal()
                addButton.disabled = !selectedId
            }
        })

        const items = templates.map((template) => {
            const item = el('li', {
                class: 'tb-template',
                role: 'option',
                tabindex: '0',
                'data-id': template.id,
                onclick: () => setSelected(template.id),
                onkeydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(template.id)
                    }
                }
            }, templateSummary(template))
            return item
        })

        const list = templates.length
            ? el('ul', { class: 'tb-template-list', role: 'listbox', 'aria-label': 'Saved templates' }, items)
            : el('p', { class: 'tb-empty', text: 'No templates yet. Tick “Save as template” when you add an entry to save one here.' })

        function setSelected(id) {
            selectedId = id
            card.dataset.tbSelected = id
            select.value = id
            addButton.disabled = !id
            items.forEach((item) => item.setAttribute('aria-selected', String(item.dataset.id === id)))
        }

        card.replaceChildren(
            el('h3', { class: 'tb-card-title', html: `${tbIcon('copy')}<span>Templates</span>` }),
            select,
            list,
            el('div', { class: 'tb-card-buttons' }, [addButton]),
            status
        )
        setSelected(selectedId)
    }

    // templates aren't tied to a day, so they're managed from a dialog
    function renderHeaderActions() {
        const projectsParent = document.querySelector(PROJECT_PARENT_SELECTOR)
        const column = projectsParent && projectsParent.closest('.span9')
        const row = column && column.parentElement
        if (!row || row.querySelector('.tb-header-actions')) return;

        row.append(el('div', { class: 'tb-header-actions' }, [
            el('button', {
                type: 'button',
                class: 'tb-header-button tb-header-button--templates',
                'aria-haspopup': 'dialog',
                html: `${tbIcon('template')}<span>Manage Templates</span>`,
                onclick: () => openDialog('manage', 'Manage templates', renderManageCard)
            }),
            buildThemeToggle(),
            el('button', {
                type: 'button',
                class: 'tb-settings-button',
                'aria-haspopup': 'dialog',
                html: `${tbIcon('settings')}<span>Settings</span>`,
                onclick: () => openDialog('settings', 'Settings', renderSettingsCard)
            })
        ]))
    }

    // theme.js applies the saved choice on load, this only flips and saves it
    function buildThemeToggle() {
        const toggle = el('button', {
            type: 'button',
            class: 'tb-theme-toggle',
            role: 'switch',
            onclick: () => {
                const dark = !document.documentElement.classList.contains('tb-dark')
                document.documentElement.classList.toggle('tb-dark', dark)
                chrome.storage.sync.set({ [STORAGE_KEY_DARK_MODE]: dark })
                sync()
            }
        })

        function sync() {
            const dark = document.documentElement.classList.contains('tb-dark')
            toggle.setAttribute('aria-checked', String(dark))
            toggle.innerHTML = `${tbIcon(dark ? 'sun' : 'moon')}<span>Dark mode</span><span class="tb-switch" aria-hidden="true"></span>`
        }

        // also follows changes made in another tab
        new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        sync()
        return toggle
    }

    // created on first use
    function openDialog(name, label, render) {
        let dialog = document.querySelector(`.tb-dialog[data-tb-dialog="${name}"]`)
        if (!dialog) {
            const card = el('div', { class: `tb-card tb-${name}` })
            dialog = el('dialog', { class: 'tb-dialog', 'data-tb-dialog': name, 'aria-label': label }, [card])
            card.tbClose = () => dialog.close()
            dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
            document.body.append(dialog)
        }
        render(dialog.firstElementChild)
        dialog.showModal()
    }

    function loadSettings() {
        chrome.storage.sync.get([STORAGE_KEY_REMINDER_ENABLED, STORAGE_KEY_REMINDER_TIME], (stored) => {
            reminder = {
                enabled: stored[STORAGE_KEY_REMINDER_ENABLED] === true,
                time: stored[STORAGE_KEY_REMINDER_TIME] || DEFAULT_REMINDER_TIME
            }
        })
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes[STORAGE_KEY_REMINDER_ENABLED]) {
                reminder.enabled = changes[STORAGE_KEY_REMINDER_ENABLED].newValue === true
            }
            if (area === 'sync' && changes[STORAGE_KEY_REMINDER_TIME]) {
                reminder.time = changes[STORAGE_KEY_REMINDER_TIME].newValue || DEFAULT_REMINDER_TIME
            }
        })
    }

    function renderSettingsCard(card) {
        card.replaceChildren(
            el('h3', { class: 'tb-card-title', html: `${tbIcon('settings')}<span>Settings</span>` }),
            el('div', { class: 'tb-field-label', text: 'Features' }),
            el('div', { class: 'tb-features' }, [
                buildFeatureToggle(STORAGE_KEY_QUICK_ACTIONS_ENABLED, 'bolt', 'Quick Actions'),
                buildFeatureToggle(STORAGE_KEY_TEMPLATES_ENABLED, 'template', 'Templates')
            ]),
            ...buildReminderSettings(),
            el('div', { class: 'tb-card-buttons' }, [
                el('button', { type: 'button', class: 'tb-button', text: 'Done', onclick: card.tbClose })
            ])
        )
    }

    // notifications are shown by the operating system, so it's also where they get blocked
    function notificationHelp() {
        const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
        if (/mac/i.test(platform)) {
            return 'Allow your browser under System Settings > Notifications, and check Focus is off.'
        }
        if (/win/i.test(platform)) {
            return 'Turn on notifications for your browser under Settings > System > Notifications, and check Do not disturb is off.'
        }
        return 'Check that your system allows notifications from your browser.'
    }

    // theme.js owns the on/off classes, so they are the current state
    function buildFeatureToggle(key, icon, label) {
        const offClass = FEATURE_OFF_CLASSES[key]
        const toggle = el('button', {
            type: 'button',
            class: 'tb-feature-toggle',
            role: 'switch',
            onclick: () => {
                const enabled = document.documentElement.classList.contains(offClass)
                document.documentElement.classList.toggle(offClass, !enabled)
                chrome.storage.sync.set({ [key]: enabled })
                sync()
            }
        })

        function sync() {
            toggle.setAttribute('aria-checked', String(!document.documentElement.classList.contains(offClass)))
            toggle.innerHTML = `${tbIcon(icon)}<span>${label}</span><span class="tb-switch" aria-hidden="true"></span>`
        }
        sync()
        return toggle
    }

    function buildReminderSettings() {
        const timeInput = el('input', {
            type: 'time',
            class: 'tb-time-input',
            id: 'tb-reminder-time',
            value: reminder.time,
            'aria-label': 'Reminder time',
            onchange: () => {
                if (!/^\d{2}:\d{2}$/.test(timeInput.value)) return;
                reminder.time = timeInput.value
                chrome.storage.sync.set({ [STORAGE_KEY_REMINDER_TIME]: reminder.time })
            }
        })
        const toggle = el('button', {
            type: 'button',
            class: 'tb-reminder-toggle',
            role: 'switch',
            onclick: () => {
                reminder.enabled = !reminder.enabled
                chrome.storage.sync.set({ [STORAGE_KEY_REMINDER_ENABLED]: reminder.enabled })
                sync()
            }
        })
        const testButton = el('button', {
            type: 'button',
            class: 'tb-small-button',
            text: 'Send a test',
            onclick: async () => {
                testButton.disabled = true
                let result
                try {
                    result = await chrome.runtime.sendMessage({ type: 'tb:test-reminder' })
                } catch (e) {
                    result = { ok: false, error: e.message }
                }
                testButton.disabled = !reminder.enabled
                if (!result || !result.ok) {
                    toast(`The test reminder failed: ${(result && result.error) || 'no reply from the extension'}. Try reloading it at chrome://extensions.`, true, 9000)
                } else if (result.permission === 'denied') {
                    toast('Chrome is blocking notifications from Timesheet Booster. Allow them in its site settings at chrome://settings/content/notifications.', true, 9000)
                } else {
                    toast(`Test reminder sent. Not seeing it? ${notificationHelp()}`, false, 9000)
                }
            }
        })

        function sync() {
            toggle.setAttribute('aria-checked', String(reminder.enabled))
            toggle.innerHTML = `${tbIcon('clock')}<span>Remind me at</span><span class="tb-switch" aria-hidden="true"></span>`
            timeInput.disabled = !reminder.enabled
            testButton.disabled = !reminder.enabled
        }
        sync()

        return [
            el('div', { class: 'tb-field-label', text: 'Daily reminder' }),
            el('div', { class: 'tb-reminder' }, [toggle, timeInput, testButton])
        ]
    }

    function renderManageCard(card) {
        const items = templates.map((template) => el('li', { class: 'tb-template' }, [
            ...templateSummary(template),
            el('span', { class: 'tb-template-actions' }, [
                el('button', {
                    type: 'button',
                    class: 'tb-small-button',
                    text: 'Rename',
                    'aria-label': `Rename ${template.name}`,
                    onclick: () => {
                        const name = prompt('Template name', template.name)
                        if (name && name.trim()) {
                            saveTemplates(templates.map((t) => t.id === template.id ? Object.assign({}, t, { name: name.trim() }) : t))
                        }
                    }
                }),
                el('button', {
                    type: 'button',
                    class: 'tb-small-button tb-small-button--danger',
                    text: 'Delete',
                    'aria-label': `Delete ${template.name}`,
                    onclick: () => {
                        if (confirm(`Delete the template "${template.name}"?`)) {
                            saveTemplates(templates.filter((t) => t.id !== template.id))
                        }
                    }
                })
            ])
        ]))

        const list = templates.length
            ? el('ul', { class: 'tb-template-list', 'aria-label': 'Saved templates' }, items)
            : el('p', { class: 'tb-empty', text: 'No templates yet. Tick “Save as template” when you add an entry to save one here.' })

        card.replaceChildren(
            el('h3', { class: 'tb-card-title', html: `${tbIcon('template')}<span>Manage Templates</span>` }),
            el('p', { class: 'tb-card-subtitle', text: 'Templates are saved in this browser.' }),
            list,
            el('div', { class: 'tb-card-buttons' }, [
                el('button', { type: 'button', class: 'tb-button', text: 'Done', onclick: card.tbClose })
            ])
        )
    }
})();
