STORAGE_KEY_PROJECTS = 'projects'
STORAGE_KEY_TEMPLATES = 'templates'
STORAGE_KEY_DARK_MODE = 'darkMode'

PROJECT_PARENT_SELECTOR = "[data-bind='foreach: visibleProjects']";
CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']";
// The "Other" overflow dropdowns are list items too, but they don't represent a single project/category
ITEM_SELECTOR = ".span2 .timesheetlistitem:not(.dropdown-toggle)";
LIST_ITEM_SELECTOR = ".timesheetlistitem";

SUPPORTED_TIMESHEETS_URLS = /https:\/\/.*employee\.entelect\.co\.za\/Timesheet.*/