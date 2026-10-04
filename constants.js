STORAGE_KEY_PROJECTS = 'projects'
STORAGE_KEY_TEMPLATES = 'templates'
STORAGE_KEY_DARK_MODE = 'darkMode'
STORAGE_KEY_DEFAULT_LOCATION = 'defaultLocation'
STORAGE_KEY_REMINDER_ENABLED = 'dailyReminderOn'
STORAGE_KEY_REMINDER_TIME = 'reminderTime'
// today's captured hours as last seen on timesheets, so the reminder can skip days that are done
STORAGE_KEY_TODAY_HOURS = 'todayHours'
DEFAULT_REMINDER_TIME = '16:30'
STORAGE_KEY_TEMPLATES_ENABLED = 'templatesEnabled'
STORAGE_KEY_QUICK_ACTIONS_ENABLED = 'quickActionsEnabled'
// html classes theme.js sets for features turned off in settings; everything is on unless stored as false
FEATURE_OFF_CLASSES = {
    [STORAGE_KEY_TEMPLATES_ENABLED]: 'tb-templates-off',
    [STORAGE_KEY_QUICK_ACTIONS_ENABLED]: 'tb-quick-actions-off'
}

PROJECT_PARENT_SELECTOR = "[data-bind='foreach: visibleProjects']";
CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']";
// "other" dropdowns are list items too but don't map to a single project/category
ITEM_SELECTOR = ".span2 .timesheetlistitem:not(.dropdown-toggle)";
LIST_ITEM_SELECTOR = ".timesheetlistitem";

SUPPORTED_TIMESHEETS_URLS = /https:\/\/.*employee\.entelect\.co\.za\/Timesheet.*/
TIMESHEETS_URL = 'https://employee.entelect.co.za/Timesheet'
