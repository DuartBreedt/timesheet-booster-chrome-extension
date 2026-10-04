// The extension's read-only features on the live timesheet. Nothing here saves or deletes entries.
const { test, expect, bridge, extensionConstants } = require('./fixtures')

const C = extensionConstants()

async function openNewEntry(page) {
    await page.locator('.timeEntry-quaterhour[item-number="4"]').first().click()
    const container = page.locator('.timeEntry-container.tb-has-quick').first()
    await expect(container.locator('.tb-quick')).toBeVisible()
    return container
}

test.describe('extension on the live timesheet', () => {
    test('header and chips', async ({ page }) => {
        await expect(page.locator('#nav-title')).toBeHidden()
        await expect(page.locator('.tb-header .tb-title')).toHaveText('Timesheet Capture')

        const chips = await page.evaluate((c) => [c.PROJECT_PARENT_SELECTOR, c.CATEGORIES_PARENT_SELECTOR].map((selector) => {
            const items = Array.from(document.querySelectorAll(`${selector} ${c.ITEM_SELECTOR}`))
            return {
                initials: items.every((item) => item.dataset.tbInitial),
                colors: items.every((item) => item.style.getPropertyValue('--tb-color')),
                fillButtons: items.every((item) => item.querySelector(':scope > .color-picker')),
                active: document.querySelectorAll(`${selector} .tb-active`).length
            }
        }), C)

        for (const list of chips) {
            expect(list).toEqual({ initials: true, colors: true, fillButtons: true, active: 1 })
        }
        const pins = await page.locator(`${C.CATEGORIES_PARENT_SELECTOR} ${C.ITEM_SELECTOR} > .pin`).count()
        expect(pins).toBeGreaterThan(0)
    })

    test('colour popover', async ({ page }) => {
        const chip = page.locator(`${C.PROJECT_PARENT_SELECTOR} ${C.ITEM_SELECTOR}`).first()
        await chip.hover()
        await chip.locator('.color-picker').click()

        const popover = page.locator('.tb-swatches')
        await expect(popover).toBeVisible()
        await expect(popover.locator('.tb-swatch')).toHaveCount(24)
        await page.keyboard.press('Escape')
        await expect(popover).toHaveCount(0)
    })

    test('captured times are tagged with project and category', async ({ page }) => {
        const captured = await page.locator('.timeEntry-capturedTime').count()
        test.skip(!captured, 'No captured entries in view')

        await expect(page.locator('.timeEntry-capturedTime:not([data-tb-category])')).toHaveCount(0)
        const mismatches = await page.evaluate(() => {
            const $ = window.jQuery
            const wrong = []
            document.querySelectorAll('.timeEntry').forEach((day) => {
                const instance = $(day).timeEntry('instance')
                instance.existingItems.forEach((item, index) => {
                    const entry = instance.options.timesheetEntries[index]
                    if (item[0].dataset.tbProject !== entry.ProjectName || item[0].dataset.tbCategory !== entry.CategoryName) {
                        wrong.push(entry.EntryId)
                    }
                })
            })
            return wrong
        })
        expect(mismatches).toEqual([])
    })

    test('stats', async ({ page }) => {
        const stats = await bridge(page, { type: 'getStats' })
        expect(stats.ok).toBe(true)
        expect(stats.days.length).toBe(await page.locator('.timeEntry').count())

        const panel = page.locator('details.tb-stats')
        await panel.locator('summary').click()
        await expect(panel.locator('.tb-kpi, .tb-empty').first()).toBeVisible()
        await panel.locator('summary').click()
    })

    test('entry form layout', async ({ page }) => {
        const container = await openNewEntry(page)

        await expect(container.locator('.tb-templates')).toBeVisible()
        await expect(container.locator('.tb-or')).toBeVisible()
        await expect(container.locator('.tb-save-template-toggle')).toBeVisible()
        await expect(container.locator('.tb-form-buttons .save')).toBeVisible()
        await expect(container.locator('.tb-form-buttons .cancel')).toBeVisible()
        // the default office is Home until changed in Settings
        await expect(container.locator('.timeEntry-radio-group input[value="2"]')).toBeChecked()

        await container.locator('.tb-form-buttons .cancel').click()
        await expect(page.locator('.timeEntry-container')).toHaveCount(0)
    })

    test('quick actions views', async ({ page }) => {
        const container = await openNewEntry(page)
        const move = container.locator('.tb-action--move')
        const copy = container.locator('.tb-action--copy')

        await expect(move).toBeHidden()
        await expect(copy).toBeHidden()
        await container.locator('.timeEntry-content textarea').fill('Timesheet Booster contract test')
        await expect(move).toBeVisible()
        await expect(copy).toBeVisible()

        await container.locator('.tb-action--bulk').click()
        await expect(container.locator('.tb-bulk')).toBeVisible()
        await expect(container.locator('.timeEntry-content')).toBeHidden()
        await expect(container.locator('.tb-templates')).toBeHidden()
        await container.locator('.tb-bulk .tb-button', { hasText: 'Close' }).click()
        await expect(container.locator('.timeEntry-content')).toBeVisible()

        await copy.click()
        await expect(container.locator('.tb-copy .tb-day-pills .tb-choice').first()).toBeVisible()
        await copy.click()

        await move.click()
        await expect(container.locator('.tb-move .tb-date-input')).toBeVisible()
        await move.click()

        await container.locator('.tb-form-buttons .cancel').click()
        await expect(page.locator('.timeEntry-container')).toHaveCount(0)
    })

    test('time field drags in 15 minute steps', async ({ page }) => {
        const container = await openNewEntry(page)
        const time = container.locator('.tb-time-scrub')
        await time.fill('1h00')
        await time.dispatchEvent('change')

        const box = await time.boundingBox()
        await page.mouse.move(box.x + 10, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + 45, box.y + box.height / 2, { steps: 5 })
        await page.mouse.up()
        await expect(time).toHaveValue('1h45')

        await time.focus()
        await page.keyboard.press('ArrowDown')
        await expect(time).toHaveValue('1h30')
        // the form's own view model must see the new value, not just the input
        const modelTime = await page.evaluate(() => {
            const day = document.querySelector('.timeEntry-container').closest('.timeEntry')
            return window.jQuery(day).timeEntry('instance').entryContent.viewModel.time()
        })
        expect(modelTime).toBe('1h30')

        await container.locator('.tb-form-buttons .cancel').click()
    })

    test('dark mode, settings and templates dialogs', async ({ page }) => {
        const html = page.locator('html')
        const wasDark = await html.evaluate((el) => el.classList.contains('tb-dark'))
        await page.locator('.tb-theme-toggle').click()
        await expect(html).toHaveClass(wasDark ? /^(?!.*\btb-dark\b)/ : /\btb-dark\b/)
        await page.locator('.tb-theme-toggle').click()

        await page.locator('.tb-settings-button').click()
        const settings = page.locator('dialog[data-tb-dialog="settings"]')
        await expect(settings).toBeVisible()
        await expect(settings.locator('.tb-choice[aria-checked="true"]')).toHaveCount(1)
        await settings.locator('.tb-button', { hasText: 'Done' }).click()
        await expect(settings).toBeHidden()

        await page.locator('.tb-header-button', { hasText: 'Manage Templates' }).click()
        const templates = page.locator('dialog[data-tb-dialog="manage"]')
        await expect(templates).toBeVisible()
        await templates.locator('.tb-button', { hasText: 'Done' }).click()
        await expect(templates).toBeHidden()
    })
})
