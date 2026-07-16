/**
 * DCU 共用頁首導覽列 - 手機版漢堡選單開關
 */

'use strict';

(() => {
    const toggle = document.querySelector('.dcu-nav-toggle');
    const nav = document.querySelector('.dcu-nav');
    if (!toggle || !nav) return;

    function setOpen(isOpen) {
        nav.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.textContent = isOpen ? '✕' : '☰';
    }

    toggle.addEventListener('click', () => {
        setOpen(!nav.classList.contains('open'));
    });

    nav.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') setOpen(false);
    });
})();
