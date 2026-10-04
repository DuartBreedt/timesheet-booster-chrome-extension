const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { test: base, expect, chromium } = require('@playwright/test')

const ROOT = path.resolve(__dirname, '../..')
const AUTH_STATE = path.join(ROOT, '.auth/state.json')
const TIMESHEET_URL = process.env.TB_TIMESHEET_URL || 'https://employee.entelect.co.za/Timesheet'

const test = base.extend({
    // false runs the bare timesheet, which the page contract needs
    extension: [true, { option: true }],

    context: async ({ extension }, use) => {
        if (!fs.existsSync(AUTH_STATE)) {
            throw new Error('No saved login. Run `npm run test:login` first.')
        }
        const args = extension ? [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`] : []
        // extensions only load into a persistent context
        const context = await chromium.launchPersistentContext('', {
            channel: 'chromium',
            headless: !process.env.HEADED,
            viewport: { width: 1840, height: 1100 },
            args
        })
        // session cookies don't survive in a profile, so they come from the saved state instead
        await context.addCookies(JSON.parse(fs.readFileSync(AUTH_STATE, 'utf8')).cookies)
        await use(context)
        await context.close()
    },

    page: async ({ context, extension }, use) => {
        const page = context.pages()[0] || await context.newPage()
        await page.goto(TIMESHEET_URL)
        if (new URL(page.url()).pathname.toLowerCase().indexOf('/timesheet') !== 0) {
            throw new Error(`Redirected to ${page.url()}. The saved login has probably expired: run \`npm run test:login\`.`)
        }
        await page.waitForSelector('.timeEntry .timeEntry-entry')
        if (extension) await page.waitForSelector('.tb-title')
        await use(page)
    }
})

// sends a command to the extension's MAIN-world bridge and waits for its tb:result
async function bridge(page, command) {
    return page.evaluate((cmd) => new Promise((resolve, reject) => {
        const id = `contract-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const timer = setTimeout(() => reject(new Error(`No bridge reply to ${cmd.type}`)), 30_000)
        document.addEventListener('tb:result', function onResult(event) {
            const result = JSON.parse(event.detail)
            if (result.id !== id) return
            document.removeEventListener('tb:result', onResult)
            clearTimeout(timer)
            resolve(result)
        })
        document.dispatchEvent(new CustomEvent('tb:command', { detail: JSON.stringify({ id, ...cmd }) }))
    }), command)
}

// keys of the object returned by toRequest in the bridge, so the contract follows the code
function bridgeRequestKeys() {
    const source = fs.readFileSync(path.join(ROOT, 'content-scripts/day-actions-bridge.js'), 'utf8')
    const body = source.slice(source.indexOf('function toRequest'))
    const object = body.slice(body.indexOf('return {') + 8, body.indexOf('};'))
    return Array.from(object.matchAll(/^\s*(\w+):/gm), (match) => match[1])
}

// selectors and keys straight from constants.js, so a renamed selector there is tested too
function extensionConstants() {
    const sandbox = {}
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'constants.js'), 'utf8'), sandbox)
    return sandbox
}

module.exports = { test, expect, bridge, bridgeRequestKeys, extensionConstants, TIMESHEET_URL, AUTH_STATE }
