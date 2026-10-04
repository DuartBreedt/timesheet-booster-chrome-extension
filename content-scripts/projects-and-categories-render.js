(function () {
    'use strict';

    if (window.__RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__RENDER_SCRIPT_ALREADY_RUN__ = true;

    onDataLoaded.push(() => {
        layoutProjects();
        layoutCategories();
        restyleProjectsAndCategories();
        observeSelection();
    })

    onFillChanged.push((entity) => {
        restyleProjectsAndCategories()
    })

    function layoutProjects() {
        const projectNodes = getAllProjects();
        projects = Array.from(projectNodes);
        projects.forEach((entity) => {
            createFillButton(entity, (color) => {
                const data = {
                    project: entity.innerText.trim(),
                    color: color
                };
                storeData(data);
                onFillChanged.forEach((fn) => fn(entity))
            });
        });

        const selected = getSelectedItem(PROJECT_PARENT_SELECTOR)
        if (selected) setActiveProject(selected)
    }

    function setActiveProject(project) {
        activeProject = project
        onActiveProjectChanged.forEach((fn) => fn())
    }

    function setActiveCategory(category) {
        activeCategory = category
        onActiveCategoryChanged.forEach((fn) => fn())
    }

    function layoutCategories() {
        const categoryNodes = getAllCategories();
        categories = Array.from(categoryNodes);
        categories.forEach((entity) => {
            // re-selecting the same project makes knockout reuse the category nodes
            if (entity.dataset.tbBound) return;
            entity.dataset.tbBound = 'true';

            createFillButton(entity, (color) => {
                const data = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        color: color
                    }
                };
                storeData(data);
                onFillChanged.forEach((fn) => fn(entity))
            }, {
                canReset: () => {
                    const categoryData = getStoredCategoryData(activeProject.innerText.trim(), entity.innerText.trim())
                    return !!(categoryData && categoryData.color)
                },
                onReset: () => {
                    clearCategoryColor(activeProject.innerText.trim(), entity.innerText.trim())
                    onFillChanged.forEach((fn) => fn(entity))
                },
                getParentColor: () => {
                    const storedProject = getStoredProjectData(activeProject.innerText.trim())
                    // knockout gives categories the project's default color as their border
                    return (storedProject && storedProject.color) || entity.style.borderColor
                }
            });
        });

        const selected = getSelectedItem(CATEGORIES_PARENT_SELECTOR)
        if (selected) setActiveCategory(selected)

        return categories
    }

    // following knockout's selection also catches the "other" dropdowns and header selects
    function getSelectedItem(parentSelector) {
        const parent = document.querySelector(parentSelector)
        if (!parent) return undefined
        return Array.from(parent.querySelectorAll(LIST_ITEM_SELECTOR)).find(isSelectedListItem)
    }

    function observeSelection() {
        const parents = [PROJECT_PARENT_SELECTOR, CATEGORIES_PARENT_SELECTOR]
            .map((selector) => document.querySelector(selector))
            .filter(Boolean)

        const observer = new MutationObserver((mutations) => {
            // ignore our own style writes on wrappers (e.g. pin ordering)
            const relevant = mutations.some((m) => m.type === 'childList' || m.target.classList.contains('timesheetlistitem'))
            if (!relevant) return;

            const selectedProject = getSelectedItem(PROJECT_PARENT_SELECTOR)
            if (selectedProject && selectedProject !== activeProject) {
                setActiveProject(selectedProject)
            }
            layoutCategories()
            restyleProjectsAndCategories()
        });

        parents.forEach((parent) => observer.observe(parent, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        }));
    }

    function getItemColor(entity) {
        return entity.style.getPropertyValue('--tb-color') || entity.style.borderColor
    }

    function toHex(color) {
        if (!color) return ''
        const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!rgb) return color.trim().toLowerCase()
        return '#' + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
    }

    // reset (categories only) adds a "use project color" option
    function createFillButton(entity, onSave, reset) {
        const elem = document.createElement('button');
        elem.type = 'button';
        elem.className = 'color-picker';
        elem.title = 'Change color';
        elem.setAttribute('aria-label', 'Change color');
        elem.setAttribute('aria-haspopup', 'true');
        elem.setAttribute('aria-expanded', 'false');

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL("icons/paint-bucket.svg");
        img.style.width = '16px';
        img.style.height = '16px';

        elem.appendChild(img);
        entity.appendChild(elem);

        elem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (openSwatches && openSwatches.opener === elem) {
                closeSwatches();
            } else {
                openSwatchPopover(elem, entity, onSave, reset);
            }
        });
    }

    const SWATCH_COLUMNS = 6;
    let openSwatches; // { popover, opener }

    function openSwatchPopover(opener, entity, onSave, reset) {
        closeSwatches();
        const followsParent = !!reset && !reset.canReset();
        // while following the project, no swatch is the category's own color
        const current = followsParent ? '' : toHex(getItemColor(entity));
        const popover = document.createElement('div');
        popover.className = 'tb-swatches';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-label', `Color for ${entity.innerText.trim()}`);

        const grid = document.createElement('div');
        grid.className = 'tb-swatch-grid';
        const swatches = TB_PALETTE.map((color) => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'tb-swatch';
            swatch.title = color.name;
            swatch.setAttribute('aria-label', color.name);
            swatch.setAttribute('aria-pressed', String(color.hex === current));
            swatch.style.setProperty('--tb-swatch', color.hex);
            swatch.addEventListener('click', () => {
                closeSwatches(true);
                onSave(color.hex);
            });
            grid.appendChild(swatch);
            return swatch;
        });
        popover.appendChild(grid);

        if (reset) {
            const projectOption = document.createElement('button');
            projectOption.type = 'button';
            projectOption.className = 'tb-swatches-project';
            projectOption.setAttribute('aria-pressed', String(followsParent));
            projectOption.style.setProperty('--tb-swatch', reset.getParentColor());
            projectOption.textContent = 'Use project color';
            projectOption.addEventListener('click', () => {
                closeSwatches(true);
                if (!followsParent) reset.onReset();
            });
            popover.prepend(projectOption);
        }

        popover.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSwatches(true);
                return;
            }
            const index = swatches.indexOf(document.activeElement);
            const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SWATCH_COLUMNS, ArrowDown: SWATCH_COLUMNS }[e.key];
            if (index === -1 || !step) return;
            e.preventDefault();
            const next = swatches[index + step];
            if (next) next.focus();
        });

        document.body.appendChild(popover);
        positionPopover(popover, opener);
        opener.classList.add('is-open');
        opener.setAttribute('aria-expanded', 'true');
        openSwatches = { popover, opener };

        (popover.querySelector('[aria-pressed="true"]') || swatches[0]).focus();
    }

    function positionPopover(popover, opener) {
        const button = opener.getBoundingClientRect();
        const width = popover.offsetWidth;
        const height = popover.offsetHeight;
        const left = Math.max(8, Math.min(button.right - width, document.documentElement.clientWidth - width - 8));
        const fitsBelow = button.bottom + 6 + height <= window.innerHeight;
        const top = fitsBelow ? button.bottom + 6 : button.top - 6 - height;
        popover.style.left = `${left + window.scrollX}px`;
        popover.style.top = `${Math.max(8, top) + window.scrollY}px`;
    }

    function closeSwatches(returnFocus) {
        if (!openSwatches) return;
        const { popover, opener } = openSwatches;
        openSwatches = undefined;
        popover.remove();
        opener.classList.remove('is-open');
        opener.setAttribute('aria-expanded', 'false');
        if (returnFocus) opener.focus();
    }

    document.addEventListener('mousedown', (e) => {
        if (openSwatches && !openSwatches.popover.contains(e.target) && !openSwatches.opener.contains(e.target)) {
            closeSwatches();
        }
    });

    // knockout's inline styles still hold the default colors, so ours go through --tb-color
    function restyleProjectsAndCategories() {
        if (!data) return;

        projects.forEach((project) => {
            const stored = getStoredProjectData(project.innerText.trim())
            setItemColor(project, (stored && stored.color) || project.style.borderColor)
        });

        const activeProjectName = activeProject ? activeProject.innerText.trim() : undefined
        const storedProject = activeProjectName && getStoredProjectData(activeProjectName)
        categories.forEach((category) => {
            const stored = activeProjectName && getStoredCategoryData(activeProjectName, category.innerText.trim())
            // knockout gives categories the project's default color as their border
            const color = (stored && stored.color) || (storedProject && storedProject.color) || category.style.borderColor
            setItemColor(category, color)
        });

        document.querySelectorAll(`${PROJECT_PARENT_SELECTOR} ${LIST_ITEM_SELECTOR}, ${CATEGORIES_PARENT_SELECTOR} ${LIST_ITEM_SELECTOR}`)
            .forEach((item) => item.classList.toggle('tb-active', isSelectedListItem(item)));

        if (activeCategory) {
            setActiveColor(getItemColor(activeCategory))
        }
    }

    function setItemColor(element, color) {
        // only write on change since observeSelection watches these
        if (color && element.style.getPropertyValue('--tb-color') !== color) {
            element.style.setProperty('--tb-color', color);
            element.style.setProperty('--tb-on-item', prefersDarkText(color) ? 'var(--tb-on-light-item)' : 'var(--tb-on-accent)');
        }
    }

    // Light colors like Apricot or Sand need dark text when used as a fill (WCAG contrast comparison)
    function prefersDarkText(color) {
        const hex = toHex(color);
        if (!/^#[0-9a-f]{6}$/.test(hex)) return false;
        const channel = (i) => {
            const v = parseInt(hex.slice(i, i + 2), 16) / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
        // Contrast against off-white (~0.88 luminance) vs against near-black (~0.01)
        return (luminance + 0.05) / 0.06 > 0.93 / (luminance + 0.05);
    }
})();
