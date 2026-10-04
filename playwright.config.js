const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
    testDir: 'tests/contract',
    // one live account: keep runs sequential so tests never see each other's changes
    workers: 1,
    fullyParallel: false,
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    }
})
