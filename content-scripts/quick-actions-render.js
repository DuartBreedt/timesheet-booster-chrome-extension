(function () {
    'use strict';

    if (window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__QUICK_ACTIONS_RENDER_SCRIPT_ALREADY_RUN__ = true;

    // Ids match the timesheet's own values
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

    // What an open entry shows next to Quick Actions (see redesign.css)
    const VIEW_FORM = 'form';
    const VIEW_BULK = 'bulk';

    let templates = [];
    const pendingCommands = new Map();

    onDataLoaded.push(() => {
        loadTemplates()
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

    // ---------- Helpers ----------

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

    // ---------- Templates storage ----------

    // Local rather than sync storage: descriptions can push a template list past sync's 8KB per-item quota
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

    // Avatar, title and details shared by the template lists
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

    // ---------- Entry forms ----------

    function observeForms() {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => enhanceForm(mutation.target))
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-tb-mode'] })

        document.querySelectorAll('.timeEntry-container[data-tb-mode]').forEach(enhanceForm)
    }

    // Lays an open entry out as: Quick Actions | entry form | OR | Templates.
    // Bulk Edit Day replaces everything right of Quick Actions while open.
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

        if (container.dataset.tbMode === 'new') {
            const content = container.querySelector('.timeEntry-content')
            if (content) content.append(buildSaveTemplateRow())
        }
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

    // ---------- Bulk Edit Day ----------

    // A group of toggle buttons where clicking the selected one clears it (fields are optional)
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

        // Start from what the open entry form has selected
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

    // ---------- Templates (apply) ----------

    // Re-renders a template card from `templates`, keeping its selection
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
                // On success the entry form closes and takes this card with it
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

    // ---------- Manage Templates ----------

    // Next to the calendar; opens the template list in a dialog since templates aren't tied to a day
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
                onclick: openManageDialog
            })
        ]))
    }

    function openManageDialog() {
        let dialog = document.querySelector('.tb-dialog')
        if (!dialog) {
            const card = el('div', { class: 'tb-card tb-manage' })
            dialog = el('dialog', { class: 'tb-dialog', 'aria-label': 'Manage templates' }, [card])
            card.tbClose = () => dialog.close()
            // Clicking the backdrop closes it
            dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
            document.body.append(dialog)
        }
        renderManageCard(dialog.querySelector('.tb-manage'))
        dialog.showModal()
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
