// main world so it can drive the timesheet's own $.fn.timeEntry widgets and jquery
(function () {
    'use strict';

    if (window.__DAY_ACTIONS_BRIDGE_ALREADY_RUN__) {
        return;
    }
    window.__DAY_ACTIONS_BRIDGE_ALREADY_RUN__ = true;

    const LOCATION_HOME = 2;
    // mirrors the options the timesheet's own entry form posts
    const LOCATIONS = [
        { name: "Home", value: 2 },
        { name: "Entelect", value: 3 },
        { name: "Client", value: 4 },
        { name: "Other", value: 5 }
    ];
    // see $.custom.sentiment
    const SENTIMENT_BUTTON_CLASSES = { 1: 'sentiment-neutral', 2: 'sentiment-happy', 3: 'sentiment-sad' };

    function getWidget(timeEntryElement) {
        try {
            return window.jQuery(timeEntryElement).timeEntry('instance');
        } catch (e) {
            return undefined;
        }
    }

    function getDayWidget(date) {
        const element = document.querySelector(`.timeEntry[data-tb-date="${date}"]`);
        return element && getWidget(element);
    }

    function formatDate(date) {
        return window.moment(date).format("YYYY-MM-DD");
    }

    function tagDaysAndForms() {
        if (!window.jQuery || !window.jQuery.fn.timeEntry || !window.moment) return;

        document.querySelectorAll('.timeEntry:not([data-tb-date])').forEach((element) => {
            const widget = getWidget(element);
            if (widget) element.dataset.tbDate = formatDate(widget.options.date);
        });

        document.querySelectorAll('.timeEntry-container:not([data-tb-mode])').forEach((container) => {
            const widget = getWidget(container.closest('.timeEntry'));
            const entryContent = widget && widget.entryContent;
            if (!entryContent || entryContent.options.element !== container) return;

            const isNew = !entryContent.options.entryId;
            if (isNew) captureTemplateOnSave(entryContent, container);
            container.dataset.tbMode = isNew ? 'new' : 'edit';
        });
    }

    // hand the entry over once the timesheet confirms it, if "save as template" was ticked
    function captureTemplateOnSave(entryContent, container) {
        const onSuccess = entryContent.options.onSuccess;
        entryContent.options.onSuccess = function (entry) {
            const toggle = container.querySelector('.tb-save-template-toggle');
            if (toggle && toggle.checked) {
                const nameInput = container.querySelector('.tb-save-template-name');
                emit('tb:template-captured', { name: nameInput ? nameInput.value.trim() : '', entry: entry });
            }
            return onSuccess.apply(this, arguments);
        };
    }

    function post(url, payload) {
        return new Promise((resolve) => {
            window.jQuery.post(url, payload)
                .done((response) => resolve(response || { success: false }))
                .fail((xhr) => resolve({ success: false, errors: [xhr.statusText || 'Request failed'] }));
        });
    }

    // same shape as timeEntryContent's getData()
    // date (YYYY-MM-DD) defaults to the widget's own day
    function toRequest(widget, entry, entryId, date) {
        const hours = Math.floor(entry.DurationInHours);
        const locationId = entry.WorkedFromLocationId;
        return {
            TimesheetEntryId: entryId,
            EmployeeId: widget.options.employeeId,
            Date: date || formatDate(widget.options.date),
            CategoryId: entry.CategoryId,
            Hours: hours,
            Minutes: Math.round((entry.DurationInHours - hours) * 60),
            TicketNumber: entry.TicketReference || '',
            Description: entry.Description || '',
            SentimentId: entry.SentimentId,
            Billable: entry.Billable,
            WorkedFromHome: locationId === LOCATION_HOME,
            WorkedFromLocationDefault: locationId,
            Locations: LOCATIONS,
            WorkedFromLocationId: locationId
        };
    }

    function errorText(response) {
        return (response.errors && response.errors.length) ? response.errors.join(' ') : 'The timesheet rejected the change.';
    }

    // mimic user input so the form's own bindings stay in sync
    function applyToOpenForm(widget, locationId, sentimentId) {
        const entryContent = widget.entryContent;
        if (!entryContent) return;
        const form = entryContent.options.element;

        if (locationId) {
            const radio = form.querySelector(`input[type="radio"][value="${locationId}"]`);
            if (radio && !radio.checked) radio.click();
        }
        if (sentimentId) {
            const button = form.querySelector(`.${SENTIMENT_BUTTON_CLASSES[sentimentId]}`);
            if (button) button.click();
        }
    }

    async function bulkEdit(command) {
        const widget = getDayWidget(command.date);
        if (!widget) return { ok: false, message: 'Could not find that day on the timesheet.' };

        const locationId = command.locationId ? Number(command.locationId) : undefined;
        const sentimentId = command.sentimentId ? Number(command.sentimentId) : undefined;
        const entries = widget.options.timesheetEntries;
        const editable = entries.filter((entry) => !entry.IsSignedOff);
        const failures = [];
        let updated = 0;

        // one at a time, like a user saving each entry
        for (const entry of editable) {
            const changed = Object.assign({}, entry);
            if (locationId) {
                changed.WorkedFromLocationId = locationId;
                changed.WorkedFromHome = locationId === LOCATION_HOME;
            }
            if (sentimentId) changed.SentimentId = sentimentId;

            const response = await post(widget.options.updateUrl, toRequest(widget, changed, entry.EntryId));
            if (response.success) {
                Object.assign(entry, changed);
                updated++;
            } else {
                failures.push(`${entry.CategoryName}: ${errorText(response)}`);
            }
        }

        // only tooltips changed, and a re-render would drop a captured entry's highlight
        (widget.existingItems || []).forEach((item, index) => {
            if (entries[index]) item.tooltipster('content', widget._generateExitingTimeEntryTooltipContent(entries[index]));
        });

        applyToOpenForm(widget, locationId, sentimentId);

        const skipped = entries.length - editable.length;
        let message = `Updated ${updated} of ${editable.length} ${editable.length === 1 ? 'entry' : 'entries'}.`;
        if (skipped) message += ` ${skipped} signed-off ${skipped === 1 ? 'entry was' : 'entries were'} left as is.`;
        if (failures.length) message += ` Failed: ${failures.join('; ')}`;
        return { ok: failures.length === 0, message: message };
    }

    async function applyTemplate(command) {
        const widget = getDayWidget(command.date);
        if (!widget) return { ok: false, message: 'Could not find that day on the timesheet.' };

        const template = command.template;
        const locationId = Number(template.workedFromLocationId);
        const entry = {
            CategoryId: template.categoryId,
            DurationInHours: template.durationInHours,
            ProjectId: template.projectId,
            TicketReference: template.ticketNumber || '',
            Description: template.description || '',
            SentimentId: template.sentimentId || 1,
            Billable: template.billable,
            ProjectName: template.projectName,
            CategoryName: template.categoryName,
            WorkedFromHome: locationId === LOCATION_HOME,
            Locations: LOCATIONS,
            WorkedFromLocationDefault: locationId,
            WorkedFromLocationId: locationId,
            IsLeave: template.isLeave
        };

        const response = await post(widget.options.submitUrl, toRequest(widget, entry, 0));
        if (!response.success) {
            if (response.RedirectUrl) window.open(response.RedirectUrl);
            return { ok: false, message: errorText(response) };
        }

        entry.EntryId = response.entryId;
        // this panel lives inside the open form, so close it first
        if (widget.entryContent) widget.entryContent.options.onCancel();
        widget._addTimesheetEntry(entry);
        return { ok: true, message: `Added "${template.name}" to the day.` };
    }

    // There is no reliable "change date" request, so a move is: create a copy on the target day, then delete
    // the original. The original is only deleted once the copy exists, so a failure leaves a duplicate
    // rather than losing the entry.
    async function moveEntry(command) {
        const widget = getDayWidget(command.date);
        const entryContent = widget && widget.entryContent;
        const entryId = entryContent && entryContent.options.entryId;
        const entry = entryId && widget.options.timesheetEntries.find((e) => e.EntryId === entryId);
        if (!entry) return { ok: false, message: 'Could not find the entry being edited.' };
        if (!command.targetDate || command.targetDate === command.date) {
            return { ok: false, message: 'Pick a different day to move the entry to.' };
        }

        const created = await post(widget.options.submitUrl, toRequest(widget, entry, 0, command.targetDate));
        if (!created.success) {
            if (created.RedirectUrl) window.open(created.RedirectUrl);
            return { ok: false, message: `Could not create the entry on ${command.targetLabel}: ${errorText(created)}` };
        }

        const removed = await post(widget.options.deleteUrl, { timesheetEntryId: entry.EntryId });

        // Close the edit form (this panel lives inside it), then redraw both days
        entryContent.options.onCancel();
        if (removed.success) {
            widget.options.timesheetEntries = widget.options.timesheetEntries.filter((e) => e !== entry);
            widget._refresh();
            widget.refreshHourEntry();
        }
        const target = getDayWidget(command.targetDate);
        if (target) target._addTimesheetEntry(Object.assign({}, entry, { EntryId: created.entryId }));

        if (!removed.success) {
            return {
                ok: false,
                message: `Copied to ${command.targetLabel}, but the original could not be deleted (${errorText(removed)}). ` +
                    'Delete it yourself so the time is not counted twice.'
            };
        }
        return { ok: true, message: `Moved "${entry.CategoryName}" to ${command.targetLabel}.` };
    }

    function emit(type, detail) {
        document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
    }

    function redraw(widget) {
        widget._refresh();
        widget.refreshHourEntry();
    }

    function countEntries(count) {
        return `${count} ${count === 1 ? 'entry' : 'entries'}`;
    }

    // Moves every entry that isn't signed off, each one copy-then-delete like moveEntry
    async function moveDay(command) {
        const widget = getDayWidget(command.date);
        if (!widget) return { ok: false, message: 'Could not find that day on the timesheet.' };
        if (!command.targetDate || command.targetDate === command.date) {
            return { ok: false, message: 'Pick a different day to move the entries to.' };
        }
        const movable = widget.options.timesheetEntries.filter((entry) => !entry.IsSignedOff);
        if (!movable.length) return { ok: false, message: 'There are no entries on this day that can be moved.' };

        // Any open form (this panel lives inside it) would point at entries that are about to move
        if (widget.entryContent) widget.entryContent.options.onCancel();
        const target = getDayWidget(command.targetDate);
        const notCopied = [];
        const notDeleted = [];
        let moved = 0;

        for (const entry of movable) {
            const created = await post(widget.options.submitUrl, toRequest(widget, entry, 0, command.targetDate));
            if (!created.success) {
                notCopied.push(`${entry.CategoryName} (${errorText(created)})`);
                continue;
            }
            if (target) target.options.timesheetEntries.push(Object.assign({}, entry, { EntryId: created.entryId }));

            const removed = await post(widget.options.deleteUrl, { timesheetEntryId: entry.EntryId });
            if (removed.success) {
                widget.options.timesheetEntries = widget.options.timesheetEntries.filter((e) => e !== entry);
                moved++;
            } else {
                notDeleted.push(entry.CategoryName);
            }
        }

        redraw(widget);
        if (target) redraw(target);

        let message = `Moved ${countEntries(moved)} to ${command.targetLabel}.`;
        if (notCopied.length) message += ` Not moved: ${notCopied.join('; ')}.`;
        if (notDeleted.length) {
            message += ` Copied but the original could not be deleted, so delete it yourself: ${notDeleted.join(', ')}.`;
        }
        return { ok: !notCopied.length && !notDeleted.length, message: message };
    }

    async function deleteDay(command) {
        const widget = getDayWidget(command.date);
        if (!widget) return { ok: false, message: 'Could not find that day on the timesheet.' };
        const deletable = widget.options.timesheetEntries.filter((entry) => !entry.IsSignedOff);
        if (!deletable.length) return { ok: false, message: 'There are no entries on this day that can be deleted.' };

        if (widget.entryContent) widget.entryContent.options.onCancel();
        const failures = [];
        let deleted = 0;

        for (const entry of deletable) {
            const removed = await post(widget.options.deleteUrl, { timesheetEntryId: entry.EntryId });
            if (removed.success) {
                widget.options.timesheetEntries = widget.options.timesheetEntries.filter((e) => e !== entry);
                deleted++;
            } else {
                failures.push(`${entry.CategoryName} (${errorText(removed)})`);
            }
        }

        redraw(widget);
        const skipped = widget.options.timesheetEntries.length - failures.length;
        let message = `Deleted ${deleted} of ${countEntries(deletable.length)}.`;
        if (skipped) message += ` ${skipped} signed-off ${skipped === 1 ? 'entry was' : 'entries were'} kept.`;
        if (failures.length) message += ` Failed: ${failures.join('; ')}.`;
        return { ok: !failures.length, message: message };
    }

    const handlers = { bulkEdit: bulkEdit, applyTemplate: applyTemplate, moveEntry: moveEntry, moveDay: moveDay, deleteDay: deleteDay };

    document.addEventListener('tb:command', async (event) => {
        let command;
        try {
            command = JSON.parse(event.detail);
        } catch (e) {
            return;
        }
        const handler = handlers[command.type];
        if (!handler) return;

        let result;
        try {
            result = await handler(command);
        } catch (e) {
            result = { ok: false, message: e.message || String(e) };
        }
        emit('tb:result', Object.assign({ id: command.id }, result));
    });

    new MutationObserver(tagDaysAndForms).observe(document.body, { childList: true, subtree: true });
    tagDaysAndForms();
})();
