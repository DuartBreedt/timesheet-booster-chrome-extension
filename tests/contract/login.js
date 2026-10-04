const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')
const { TIMESHEET_URL, AUTH_STATE } = require('./fixtures')

;(async () => {
    const browser = await chromium.launch({ headless: false })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(TIMESHEET_URL)

    console.log('Sign in to the timesheet in the browser window. It closes once the timesheet has loaded.')
    await page.waitForSelector('.timeEntry .timeEntry-entry', { timeout: 5 * 60 * 1000 })

    fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true })
    await context.storageState({ path: AUTH_STATE })
    console.log(`Saved the session to ${path.relative(process.cwd(), AUTH_STATE)}`)
    await browser.close()
})().catch((error) => {
    console.error(error)
    process.exit(1)
})
