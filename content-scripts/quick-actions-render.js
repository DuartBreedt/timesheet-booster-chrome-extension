(function () {
    'use strict';

    if (window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__ = true;

    // ids match the timesheet's own values
    const LOCATIONS = [
        { id: 2, name: 'Home', icon: 'home' },
        { id: 3, name: 'Entelect', icon: 'building' },
        { id: 4, name: 'Client', icon: 'user' },
        { id: 5, name: 'Other', icon: 'dots' }
    ];
    const SENTIMENTS = [
        { id: 2, name: 'Happy', icon: 'smile', buttonClass: 'sentiment-happy' },
        { id: 1, name: 'Neutral', icon: 'meh', buttonClass: 'sentiment-neutral' },
        { id: 3, name: 'Sad', icon: 'frown', buttonClass: 'sentiment-sad' }
    ];

    // see redesign.css
    const VIEW_FORM = 'form';
    const VIEW_BULK = 'bulk';

    let templates = [];
    // home until changed in settings
    const DEFAULT_LOCATION_ID = 2;
    let defaultLocationId = DEFAULT_LOCATION_ID;
    const pendingCommands = new Map();

    onDataLoaded.push(() => {
        loadTemplates()
        loadSettings()
        renderHeaderActions()
        observeForms()

        document.addEventListener('tb:result', onCommandResult)
        document.addEventListener('tb:template-captured', onTemplateCaptured)
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes[STORAGE_KEY_TEMPLATES]) {
                templates = changes[STORAGE_KEY_TEMPLATES].newValue || []
                renderAllTemplateCards()
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

    function toast(message, isError) {
        const node = el('div', { class: `tb-toast${isError ? ' tb-toast--error' : ''}`, role: 'status', text: message })
        document.body.append(node)
        setTimeout(() => node.classList.add('tb-toast--leaving'), 3500)
        setTimeout(() => node.remove(), 4000)
    }

    function sendCommand(command) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        return new Promise((resolve) => {
            pendingCommands.set(id, resolve)
            document.dispatchEvent(new CustomEvent('tb:command', { detail: JSON.stringify(Object.assign({ id }, command)) }))
        })
    }

    function onCommandResult(event) {
        const result = JSON.parse(event.detail)
        const resolve = pendingCommands.get(result.id)
        if (!resolve) return;
        pendingCommands.delete(result.id)
        resolve(result)
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
            buildActionButton(VIEW_BULK, 'tb-action--bulk', 'pencil', 'Bulk Edit Day', 'Set from location + sentiment', toggleView)
        ])

        const templatesCard = el('div', { class: 'tb-card tb-templates' })
        templatesCard.tbDay = day
        templatesCard.tbRefreshTotal = refreshTotal
        renderTemplateCard(templatesCard)

        container.prepend(quick)
        container.append(
            el('div', { class: 'tb-or', 'aria-hidden': 'true' }, [el('span', { text: 'OR' })]),
            templatesCard,
            buildBulkCard(day, showForm, refreshTotal)
        )
        container.classList.add('tb-has-quick')
        container.dataset.tbView = VIEW_FORM

        const content = container.querySelector('.timeEntry-content')
        if (container.dataset.tbMode === 'new') {
            if (content) content.append(buildSaveTemplateRow())
            applyDefaultLocation(container)
        }
        if (content) groupFormButtons(content)
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

    // select it like a user would so the form's bindings pick it up
    function applyDefaultLocation(container) {
        const radio = container.querySelector(`input[type="radio"][value="${defaultLocationId}"]`)
        if (radio && !radio.checked) radio.click()
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

        const focusTarget = view === VIEW_FORM
            ? container.querySelector('.timeEntry-content textarea')
            : container.querySelector(`.tb-${view} button`)
        if (focusTarget) focusTarget.focus({ preventScroll: true })
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

    function buildBulkCard(day, close, refreshTotal) {
        const status = el('p', { class: 'tb-status', role: 'status' })
        const update = () => { applyButton.disabled = !locations.getValue() && !sentiments.getValue() }
        const locations = buildChoiceGroup('tb-locations', 'Worked from', LOCATIONS, update)
        const sentiments = buildChoiceGroup('tb-sentiments', 'Sentiment', SENTIMENTS, update)

        const applyButton = el('button', {
            type: 'button',
            class: 'tb-button tb-button--primary',
            disabled: true,
            html: `${tbIcon('check')}<span>Apply to Day</span>`,
            onclick: async () => {
                applyButton.disabled = true
                status.className = 'tb-status'
                status.textContent = 'Updating entries…'
                const result = await sendCommand({
                    type: 'bulkEdit',
                    date: day.dataset.tbDate,
                    locationId: locations.getValue(),
                    sentimentId: sentiments.getValue()
                })
                status.className = `tb-status ${result.ok ? 'tb-status--ok' : 'tb-status--error'}`
                status.textContent = result.message
                refreshTotal()
                update()
            }
        })

        const card = el('div', { class: 'tb-card tb-bulk' }, [
            el('h3', { class: 'tb-card-title', html: `${tbIcon('pencil')}<span>Bulk Edit Day</span>` }),
            el('p', { class: 'tb-card-subtitle', text: 'Apply the same details to all entries for this day.' }),
            el('div', { class: 'tb-field-label', text: 'From (Worked From)' }),
            locations.group,
            el('div', { class: 'tb-field-label', text: 'Sentiment' }),
            sentiments.group,
            el('div', { class: 'tb-card-buttons' }, [
                applyButton,
                el('button', { type: 'button', class: 'tb-button', text: 'Cancel', onclick: close })
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
                status.textContent = 'Adding entry…'
                const result = await sendCommand({ type: 'applyTemplate', date: day.dataset.tbDate, template })
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
            el('p', { class: 'tb-card-subtitle', text: 'Apply a saved template for this day (e.g. recurring meetings).' }),
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
                class: 'tb-header-button',
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
        chrome.storage.sync.get(STORAGE_KEY_DEFAULT_LOCATION, (stored) => {
            defaultLocationId = Number(stored[STORAGE_KEY_DEFAULT_LOCATION]) || DEFAULT_LOCATION_ID
        })
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes[STORAGE_KEY_DEFAULT_LOCATION]) {
                defaultLocationId = Number(changes[STORAGE_KEY_DEFAULT_LOCATION].newValue) || DEFAULT_LOCATION_ID
            }
        })
    }

    function renderSettingsCard(card) {
        const buttons = LOCATIONS.map((option) => el('button', {
            type: 'button',
            class: 'tb-choice',
            role: 'radio',
            'aria-checked': String(option.id === defaultLocationId),
            'data-value': String(option.id),
            html: tbIcon(option.icon),
            onclick: () => {
                defaultLocationId = option.id
                chrome.storage.sync.set({ [STORAGE_KEY_DEFAULT_LOCATION]: option.id })
                buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(option.id))))
            }
        }, [el('span', { text: option.name })]))

        card.replaceChildren(
            el('h3', { class: 'tb-card-title', html: `${tbIcon('settings')}<span>Settings</span>` }),
            el('p', { class: 'tb-card-subtitle', text: 'Saved to your browser profile and used on your next visits.' }),
            el('div', { class: 'tb-field-label', text: 'Default office' }),
            el('p', { class: 'tb-card-subtitle tb-field-help', text: 'Selected under “Worked From” whenever you create a new entry.' }),
            el('div', { class: 'tb-choices tb-locations', role: 'radiogroup', 'aria-label': 'Default office' }, buttons),
            el('div', { class: 'tb-card-buttons' }, [
                el('button', { type: 'button', class: 'tb-button', text: 'Done', onclick: card.tbClose })
            ])
        )
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
