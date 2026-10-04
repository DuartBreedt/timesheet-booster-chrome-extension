TB_ICON_PATHS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    template: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>',
    kebab: '<path d="M12 6h.01M12 12h.01M12 18h.01" stroke-width="3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5"/>',
    meh: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/><path d="M8.5 15h7"/>',
    frown: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/><path d="M8 16.5s1.5-2.5 4-2.5 4 2.5 4 2.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    move: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15.5h6M13 13l2.5 2.5L13 18"/>',
    duplicate: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
}

function tbIcon(name) {
    return `<svg class="tb-icon tb-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${TB_ICON_PATHS[name]}</svg>`
}
