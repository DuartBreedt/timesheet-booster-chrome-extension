// What the extension relies on in the timesheet itself. Runs without the extension and never saves anything.
const { test, expect, bridgeRequestKeys, extensionConstants } = require('./fixtures')

const C = extensionConstants()

test.use({ extension: false })

test.describe('timesheet page contract', () => {
    test('project and category lists', async ({ page }) => {
        const lists = await page.evaluate((c) => [c.PROJECT_PARENT_SELECTOR, c.CATEGORIES_PARENT_SELECTOR].map((selector) => {
            const parent = document.querySelector(selector)
            const items = parent ? Array.from(parent.querySelectorAll(c.ITEM_SELECTOR)) : []
            return {
                found: !!parent,
                insideSpan9: !!(parent && parent.closest('.span9')),
                items: items.length,
                wrappedInSpan2: items.every((item) => item.parentElement.parentElement.classList.contains('span2')),
                // knockout marks the selection with an inline `color: white`
                selected: parent ? Array.from(parent.querySelectorAll(c.LIST_ITEM_SELECTOR)).filter((i) => i.style.color === 'white').length : 0,
                hasBorderColor: items.every((item) => !!item.style.borderColor)
            }
        }), C)

        for (const list of lists) {
            expect(list.found).toBe(true)
            expect(list.insideSpan9).toBe(true)
            expect(list.items).toBeGreaterThan(0)
            expect(list.wrappedInSpan2).toBe(true)
            expect(list.selected).toBe(1)
            expect(list.hasBorderColor).toBe(true)
        }
    })

    test('"Other" overflow dropdowns', async ({ page }) => {
        const dropdowns = await page.evaluate((c) => [c.PROJECT_PARENT_SELECTOR, c.CATEGORIES_PARENT_SELECTOR].map((selector) => {
            const parent = document.querySelector(selector)
            const toggle = parent.querySelector('.dropdown-toggle.timesheetlistitem')
            return toggle ? { toggle: true, links: parent.querySelectorAll('.dropdown-menu li a').length } : { toggle: false }
        }), C)

        // only present when there are more items than fit, so check the shape when it is there
        for (const dropdown of dropdowns.filter((d) => d.toggle)) {
            expect(dropdown.links).toBeGreaterThan(0)
        }
    })

    test('header elements the redesign hooks into', async ({ page }) => {
        const header = await page.evaluate(() => ({
            navTitle: !!document.querySelector('#nav-title'),
            datepicker: !!document.querySelector('.row-fluid > .span3 #datepicker'),
            daysRow: !!document.querySelector('.row-fluid [data-bind="foreach: timesheetDays"]'),
            sectionHeadings: document.querySelectorAll('.span9 > .timesheet-sectionheading').length
        }))

        expect(header).toEqual({ navTitle: true, datepicker: true, daysRow: true, sectionHeadings: 2 })
    })

    test('day rows', async ({ page }) => {
        const days = await page.evaluate(() => Array.from(document.querySelectorAll('.timeEntry')).map((day) => ({
            date: !!(day.querySelector('.timeEntry-infoHeader .timeEntry-date') || {}).firstChild,
            total: /^\d+h \d{2}m$/.test((day.querySelector('.timeEntry-totalHoursWorked') || {}).textContent || ''),
            track: !!day.querySelector('.timeEntry-entry'),
            quarterHoursNumbered: Array.from(day.querySelectorAll('.timeEntry-quaterhour')).every((q) => /^\d+$/.test(q.getAttribute('item-number'))),
            quarterHoursInTrack: Array.from(day.querySelectorAll('.timeEntry-quaterhour')).every((q) => q.parentElement.classList.contains('timeEntry-entry'))
        })))

        expect(days.length).toBeGreaterThan(0)
        for (const day of days) {
            expect(day).toEqual({ date: true, total: true, track: true, quarterHoursNumbered: true, quarterHoursInTrack: true })
        }
    })

    test('page globals', async ({ page }) => {
        const globals = await page.evaluate(() => ({
            jQuery: typeof window.jQuery,
            knockout: typeof window.ko,
            moment: typeof window.moment,
            tooltipster: typeof (window.jQuery && window.jQuery.fn.tooltipster),
            timeEntry: typeof (window.jQuery && window.jQuery.fn.timeEntry),
            sentiment: typeof (window.jQuery && window.jQuery.fn.sentiment),
            timeEntryContent: typeof window.timeEntryContent
        }))

        expect(globals).toEqual({
            jQuery: 'function',
            knockout: 'object',
            moment: 'function',
            tooltipster: 'function',
            timeEntry: 'function',
            sentiment: 'function',
            timeEntryContent: 'function'
        })
    })

    test('day widget options and methods', async ({ page }) => {
        const widget = await page.evaluate(() => {
            const instance = window.jQuery(document.querySelector('.timeEntry')).timeEntry('instance')
            const o = instance.options
            return {
                date: window.moment(o.date).isValid(),
                entriesArray: Array.isArray(o.timesheetEntries),
                employeeId: !!o.employeeId,
                urls: [o.submitUrl, o.updateUrl, o.deleteUrl].every((url) => typeof url === 'string' && url.length > 0),
                colorDictionary: typeof o.colorDictionary === 'object',
                isHoliday: 'isHoliday' in o,
                methods: ['_addTimesheetEntry', '_refresh', 'refreshHourEntry', '_generateExitingTimeEntryTooltipContent']
                    .filter((name) => typeof instance[name] !== 'function'),
                existingItems: Array.isArray(instance.existingItems)
            }
        })

        expect(widget).toEqual({
            date: true,
            entriesArray: true,
            employeeId: true,
            urls: true,
            colorDictionary: true,
            isHoliday: true,
            methods: [],
            existingItems: true
        })
    })

    test('entry fields', async ({ page }) => {
        const entry = await page.evaluate(() => {
            const days = Array.from(document.querySelectorAll('.timeEntry'))
                .map((day) => window.jQuery(day).timeEntry('instance').options.timesheetEntries)
            return (days.find((entries) => entries.length) || [])[0]
        })
        test.skip(!entry, 'No captured entries in view to inspect')

        for (const field of ['EntryId', 'ProjectId', 'ProjectName', 'CategoryId', 'CategoryName', 'DurationInHours',
            'Description', 'TicketReference', 'SentimentId', 'Billable', 'WorkedFromLocationId', 'IsSignedOff']) {
            expect(entry, `entry field ${field}`).toHaveProperty(field)
        }
        expect(typeof entry.DurationInHours).toBe('number')
        expect([1, 2, 3]).toContain(Number(entry.SentimentId))
    })

    test('captured time tooltips list project then category', async ({ page }) => {
        const tooltips = await page.evaluate(() => {
            const $ = window.jQuery
            const results = []
            document.querySelectorAll('.timeEntry').forEach((day) => {
                const instance = $(day).timeEntry('instance')
                instance.existingItems.forEach((item, index) => {
                    const entry = instance.options.timesheetEntries[index]
                    const spans = $($(item[0]).tooltipster('content')).find('span')
                    results.push({
                        isCapturedTime: item[0].classList.contains('timeEntry-capturedTime'),
                        project: spans.eq(0).text() === entry.ProjectName,
                        category: spans.eq(1).text() === entry.CategoryName
                    })
                })
            })
            return results
        })
        test.skip(!tooltips.length, 'No captured entries in view to inspect')

        for (const tooltip of tooltips) {
            expect(tooltip).toEqual({ isCapturedTime: true, project: true, category: true })
        }
    })

    test('save requests take the fields the extension sends', async ({ page }) => {
        const keys = bridgeRequestKeys()
        expect(keys.length).toBeGreaterThan(10)

        const missing = await page.evaluate((expected) => {
            const source = String(window.timeEntryContent)
            return expected.filter((key) => !new RegExp(`\\b${key}\\s*:`).test(source))
        }, keys)
        expect(missing, 'fields the extension posts that the timesheet no longer sends').toEqual([])
    })

    test('save responses keep their shape', async ({ page }) => {
        const shape = await page.evaluate(() => {
            const content = String(window.timeEntryContent)
            return {
                success: /data\.success/.test(content),
                entryId: /data\.entryId/.test(content),
                errors: /data\.errors/.test(content)
            }
        })

        expect(shape).toEqual({ success: true, entryId: true, errors: true })
    })

    test('delete requests post the entry id as timesheetEntryId', async ({ page }) => {
        // $.widget wraps prototype methods, so their source can't be read; record the request instead
        const request = await page.evaluate(() => {
            const $ = window.jQuery
            const instance = $(document.querySelector('.timeEntry')).timeEntry('instance')
            const post = $.post
            let sent
            // a promise that never settles, so nothing reaches the server and no callbacks run
            $.post = (url, data) => {
                sent = { url, data }
                return $.Deferred().promise()
            }
            try {
                instance._removeTimesheetEntry({ EntryId: -1 })
            } finally {
                $.post = post
            }
            return { ...sent, deleteUrl: instance.options.deleteUrl }
        })

        expect(request.url).toBe(request.deleteUrl)
        expect(request.data).toEqual({ timesheetEntryId: -1 })
    })

    test('saved entries passed to onSuccess have the fields templates store', async ({ page }) => {
        const missing = await page.evaluate(() => {
            const source = String(window.timeEntryContent)
            const start = source.indexOf('getNewTimesheetEntry=function')
            const body = start === -1 ? source : source.slice(start, start + 1500)
            return ['CategoryId', 'DurationInHours', 'ProjectId', 'TicketReference', 'Description', 'SentimentId',
                'Billable', 'EntryId', 'ProjectName', 'CategoryName', 'WorkedFromLocationId', 'IsLeave']
                .filter((key) => !new RegExp(`\\b${key}\\s*:`).test(body))
        })

        expect(missing).toEqual([])
    })

    test('sentiment buttons map to ids 3, 1 and 2', async ({ page }) => {
        const ids = await page.evaluate(() => {
            const $ = window.jQuery
            const seen = []
            const element = $('<div>').appendTo(document.body)
            element.sentiment({ sentimentId: 1, onChange: (id) => seen.push(id) })
            for (const name of ['sad', 'neutral', 'happy']) element.find(`.sentiment-${name}`).trigger('click')
            element.sentiment('destroy').remove()
            return seen
        })

        expect(ids).toEqual([3, 1, 2])
    })

    test('entry form', async ({ page }) => {
        await page.locator('.timeEntry-quaterhour[item-number="4"]').first().click()
        const container = page.locator('.timeEntry-container').first()
        await expect(container.locator('.timeEntry-content')).toBeVisible()

        const form = await page.evaluate(() => {
            const day = document.querySelector('.timeEntry-container').closest('.timeEntry')
            const instance = window.jQuery(day).timeEntry('instance')
            const content = instance.entryContent
            const vm = content.viewModel
            const element = content.options.element
            return {
                elementIsContainer: element.classList.contains('timeEntry-container'),
                newEntryId: !content.options.entryId,
                names: typeof content.options.projectName === 'string' && typeof content.options.categoryName === 'string',
                callbacks: typeof content.options.onSuccess === 'function' && typeof content.options.onCancel === 'function',
                observables: ['time', 'description', 'ticketNumber', 'sentimentId', 'billable', 'categoryId', 'projectId',
                    'workedFromLocationId', 'workedFromLocationDefault'].filter((name) => !window.ko.isObservable(vm[name])),
                timeFormat: /^\d{1,2}h\d{2}$/.test(vm.time()),
                locations: vm.locations(),
                description: !!element.querySelector('.timeEntry-content textarea'),
                timeInput: !!element.querySelector('.timeEntry-content-time input'),
                banner: !!element.querySelector('.timeEntry-banner'),
                radios: Array.from(element.querySelectorAll('[data-bind="foreach: locations"] .timeEntry-radio-group input[type="radio"]'), (r) => r.value),
                sentimentButtons: ['sad', 'neutral', 'happy'].every((name) => element.querySelector(`.sentiment-${name}`)),
                save: !!element.querySelector('.timeEntry-content-buttons .save'),
                cancel: !!element.querySelector('.timeEntry-content-buttons .cancel'),
                workedFromBlock: !!element.querySelector('.timeEntry-content-input-block [data-bind="foreach: locations"]')
            }
        })

        expect(form).toEqual({
            elementIsContainer: true,
            newEntryId: true,
            names: true,
            callbacks: true,
            observables: [],
            timeFormat: true,
            locations: [
                { name: 'Home', value: 2 },
                { name: 'Entelect', value: 3 },
                { name: 'Client', value: 4 },
                { name: 'Other', value: 5 }
            ],
            description: true,
            timeInput: true,
            banner: true,
            radios: ['2', '3', '4', '5'],
            sentimentButtons: true,
            save: true,
            cancel: true,
            workedFromBlock: true
        })

        await container.locator('.timeEntry-content-buttons .cancel').click()
        await expect(page.locator('.timeEntry-container')).toHaveCount(0)
    })
})
