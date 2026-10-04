// Creates, edits, copies, moves and deletes a throwaway entry on the real timesheet.
// Opt-in only (TB_ALLOW_WRITES=1). It uses two empty days in view and always clears them afterwards.
const { test, expect, bridge } = require('./fixtures')

const DESCRIPTION = 'Timesheet Booster contract test, safe to delete'

function isWeekend(dateKey) {
    const day = new Date(`${dateKey}T12:00:00`).getDay()
    return day === 0 || day === 6
}

async function entriesOn(page, date) {
    const stats = await bridge(page, { type: 'getStats' })
    return stats.days.find((day) => day.date === date).entries
}

async function openSavedEntry(page, date) {
    const day = page.locator(`.timeEntry[data-tb-date="${date}"]`)
    await day.locator('.timeEntry-capturedTime').first().click()
    await expect(day.locator('.timeEntry-container[data-tb-mode="edit"]')).toBeVisible()
}

test.describe('writes', () => {
    test.skip(!process.env.TB_ALLOW_WRITES, 'Writes to the real timesheet. Set TB_ALLOW_WRITES=1 to run.')

    let usedDays = []

    test.afterEach(async ({ page }) => {
        for (const date of usedDays) {
            await bridge(page, { type: 'deleteDay', date }).catch(() => {})
        }
    })

    test('create, bulk edit, copy, move and delete', async ({ page }) => {
        const { days } = await bridge(page, { type: 'getStats' })
        const empty = days.filter((day) => !day.entries.length)
        // weekends first: least likely to clash with real time
        const picks = [...empty.filter((d) => isWeekend(d.date)), ...empty.filter((d) => !isWeekend(d.date))].slice(0, 2)
        test.skip(picks.length < 2, 'Needs two days in view with no entries')

        const [a, b] = picks.map((day) => day.date)
        usedDays = [a, b]
        const dayA = page.locator(`.timeEntry[data-tb-date="${a}"]`)

        // created through the timesheet's own form, like a user would
        await dayA.locator('.timeEntry-quaterhour[item-number="4"]').click()
        const form = dayA.locator('.timeEntry-container')
        await form.locator('.timeEntry-content textarea').fill(DESCRIPTION)
        await form.locator('.tb-form-buttons .save').click()
        await expect(dayA.locator('.timeEntry-capturedTime')).toHaveCount(1)
        expect((await entriesOn(page, a)).map((e) => e.hours)).toEqual([1])

        let result = await bridge(page, { type: 'bulkEdit', date: a, sentimentId: 2, locationId: 4 })
        expect(result.ok, result.message).toBe(true)
        const [edited] = await entriesOn(page, a)
        expect([edited.sentimentId, edited.locationId]).toEqual([2, 4])

        await openSavedEntry(page, a)
        result = await bridge(page, { type: 'copyEntry', date: a, targets: [{ date: b, label: b }] })
        expect(result.ok, result.message).toBe(true)
        expect(await entriesOn(page, b)).toHaveLength(1)
        await dayA.locator('.tb-form-buttons .cancel').click()

        await openSavedEntry(page, b)
        result = await bridge(page, { type: 'moveEntry', date: b, targetDate: a, targetLabel: a })
        expect(result.ok, result.message).toBe(true)
        expect(await entriesOn(page, b)).toHaveLength(0)
        expect(await entriesOn(page, a)).toHaveLength(2)

        result = await bridge(page, { type: 'deleteDay', date: a })
        expect(result.ok, result.message).toBe(true)
        expect(await entriesOn(page, a)).toHaveLength(0)
    })
})
