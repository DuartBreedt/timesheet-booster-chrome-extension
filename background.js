// the only part that runs outside timesheets, so the daily reminder reaches whichever tab is open
importScripts('constants.js')

const REMINDER_ALARM = 'tb-reminder'
const SNOOZE_ALARM = 'tb-reminder-snooze'
const NOTIFICATION_ID = 'tb-reminder'
const SNOOZE_MINUTES = 30
const FULL_DAY_HOURS = 8
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isWeekend(date) {
    return date.getDay() === 0 || date.getDay() === 6
}

function formatHours(hours) {
    const minutes = Math.round(hours * 60)
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

async function getSettings() {
    const stored = await chrome.storage.sync.get([STORAGE_KEY_REMINDER_ENABLED, STORAGE_KEY_REMINDER_TIME])
    const time = stored[STORAGE_KEY_REMINDER_TIME]
    return {
        enabled: stored[STORAGE_KEY_REMINDER_ENABLED] === true,
        time: TIME_PATTERN.test(time) ? time : DEFAULT_REMINDER_TIME
    }
}

function nextReminderTime(time) {
    const [hours, minutes] = time.split(':').map(Number)
    const next = new Date()
    next.setHours(hours, minutes, 0, 0)
    while (next <= new Date() || isWeekend(next)) next.setDate(next.getDate() + 1)
    return next.getTime()
}

// one-shot alarms rescheduled after each run, so daylight saving and time changes never drift the time
async function scheduleReminder() {
    const { enabled, time } = await getSettings()
    await chrome.alarms.clear(REMINDER_ALARM)
    if (enabled) {
        await chrome.alarms.create(REMINDER_ALARM, { when: nextReminderTime(time) })
    } else {
        await chrome.alarms.clear(SNOOZE_ALARM)
        await chrome.notifications.clear(NOTIFICATION_ID)
    }
}

async function remind(isTest) {
    const stored = await chrome.storage.local.get(STORAGE_KEY_TODAY_HOURS)
    const today = stored[STORAGE_KEY_TODAY_HOURS]
    const seenToday = today && today.date === dateKey(new Date())
    if (!isTest && seenToday && (today.isHoliday || today.hours >= FULL_DAY_HOURS)) return { ok: true, skipped: true };

    const message = seenToday && today.hours > 0
        ? `You have ${formatHours(today.hours)} captured today. Capture the rest before you log off.`
        : 'Capture today\'s hours before you log off.'

    await chrome.notifications.clear(NOTIFICATION_ID)
    try {
        // no requireInteraction: on macOS that routes through chrome's separate "alerts" app, which is often not allowed
        await chrome.notifications.create(NOTIFICATION_ID, {
            type: 'basic',
            iconUrl: 'images/ic_icon.png',
            title: 'Time to capture your timesheet',
            message: message,
            buttons: [{ title: 'Open timesheets' }, { title: `Remind me in ${SNOOZE_MINUTES} minutes` }],
            priority: 2
        })
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
    return { ok: true, permission: await chrome.notifications.getPermissionLevel() }
}

async function openTimesheets() {
    chrome.notifications.clear(NOTIFICATION_ID)
    const [tab] = await chrome.tabs.query({ url: `${TIMESHEETS_URL}*` })
    if (tab) {
        await chrome.tabs.update(tab.id, { active: true })
        await chrome.windows.update(tab.windowId, { focused: true })
    } else {
        await chrome.tabs.create({ url: TIMESHEETS_URL })
    }
}

chrome.runtime.onInstalled.addListener(scheduleReminder)
chrome.runtime.onStartup.addListener(scheduleReminder)

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes[STORAGE_KEY_REMINDER_ENABLED] || changes[STORAGE_KEY_REMINDER_TIME])) {
        scheduleReminder()
    }
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SNOOZE_ALARM) {
        if ((await getSettings()).enabled) remind(false)
        return;
    }
    if (alarm.name !== REMINDER_ALARM) return;

    await scheduleReminder()
    // chrome fires missed alarms when the computer wakes, so a reminder from an earlier day is dropped
    if (dateKey(new Date(alarm.scheduledTime)) === dateKey(new Date())) remind(false)
})

chrome.notifications.onClicked.addListener((id) => {
    if (id === NOTIFICATION_ID) openTimesheets()
})

chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    if (id !== NOTIFICATION_ID) return;
    if (buttonIndex === 0) {
        openTimesheets()
    } else {
        chrome.notifications.clear(NOTIFICATION_ID)
        chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: SNOOZE_MINUTES })
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'tb:test-reminder') return;
    remind(true).then(sendResponse)
    // keeps the message port open for the async reply
    return true
})
