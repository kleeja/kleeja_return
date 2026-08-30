/*!
 * Kleeja Return — front-end behaviour
 * No dependencies. Every feature degrades gracefully when it is absent.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var THEME_KEY = 'kleeja-theme';

    /* ================================================================ *
     * Small helpers
     * ================================================================ */

    function $(sel, ctx) {
        return (ctx || document).querySelector(sel);
    }

    function $$(sel, ctx) {
        return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    }

    function store(key, value) {
        try {
            if (arguments.length === 1) return localStorage.getItem(key);
            localStorage.setItem(key, value);
        } catch (e) {
            /* private mode, blocked storage — behave as if nothing was saved */
        }
        return null;
    }

    function sprintf(template, values) {
        var out = String(template == null ? '' : template);
        values.forEach(function (value, index) {
            out = out
                .replace('%' + (index + 1) + '$s', value)
                .replace('%s', value);
        });
        return out;
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = 0;
        var value = bytes;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        return (i === 0 ? value : value.toFixed(value < 10 ? 2 : 1)) + ' ' + units[i];
    }

    /* ================================================================ *
     * Strings — Kleeja's language files cover most of them; the handful
     * that have no key fall back to this table.
     * ================================================================ */

    var STRINGS = {
        en: {
            skip: 'Skip to content',
            mainNav: 'Main navigation',
            theme: 'Switch theme',
            menu: 'Menu',
            dropHint: 'Drag & drop your files here',
            copy: 'Copy',
            copied: 'Copied to clipboard',
            copyFailed: 'Could not copy',
            remove: 'Remove',
            tooManyFiles: 'You reached the maximum number of files.'
        },
        ar: {
            skip: 'انتقل إلى المحتوى',
            mainNav: 'القائمة الرئيسية',
            theme: 'تبديل المظهر',
            menu: 'القائمة',
            dropHint: 'أفلِت ملفاتك هنا',
            copy: 'نسخ',
            copied: 'تم النسخ',
            copyFailed: 'تعذّر النسخ',
            remove: 'إزالة',
            tooManyFiles: 'لقد وصلت إلى الحد الأقصى لعدد الملفات.'
        }
    };

    var isArabic =
        (root.getAttribute('lang') || '').toLowerCase().indexOf('ar') === 0 ||
        root.getAttribute('dir') === 'rtl';
    var dict = isArabic ? STRINGS.ar : STRINGS.en;
    var lang = window.KLEEJA_LANG || {};

    function t(key) {
        return dict[key] || STRINGS.en[key] || key;
    }

    function applyStrings() {
        $$('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        $$('[data-i18n-label]').forEach(function (el) {
            el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label')));
        });
        $$('[data-i18n-title]').forEach(function (el) {
            el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
        });
    }

    /* ================================================================ *
     * Toasts
     * ================================================================ */

    function toast(message, tone) {
        var host = $('#k-toaster');
        if (!host || !message) return;

        var el = document.createElement('div');
        el.className = 'k-toast';
        el.setAttribute('data-tone', tone || 'info');

        var icon = document.createElement('i');
        icon.className =
            tone === 'success' ? 'icon-circle-check' : tone === 'error' ? 'icon-circle-alert' : 'icon-info';

        var text = document.createElement('span');
        text.textContent = message;

        el.appendChild(icon);
        el.appendChild(text);
        host.appendChild(el);

        window.setTimeout(function () {
            el.classList.add('is-leaving');
            window.setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        }, 3200);
    }

    /* ================================================================ *
     * Boot — reveal the page once Tailwind's runtime build has landed
     * ================================================================ */

    function unlockPaint() {
        root.classList.remove('k-boot');
    }

    function waitForTailwind() {
        var probe = document.createElement('div');
        probe.className = 'hidden';
        probe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(probe);

        var deadline = Date.now() + 1500;

        (function check() {
            var ready = getComputedStyle(probe).display === 'none';
            if (ready || Date.now() > deadline) {
                if (probe.parentNode) probe.parentNode.removeChild(probe);
                unlockPaint();
                return;
            }
            window.requestAnimationFrame(check);
        })();
    }

    /* ================================================================ *
     * Theme
     * ================================================================ */

    function setTheme(dark, persist) {
        root.classList.toggle('dark', dark);
        if (persist) store(THEME_KEY, dark ? 'dark' : 'light');

        var meta = $('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', dark ? '#070b14' : '#F45B69');
    }

    function initTheme() {
        var toggle = $('#k-theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                setTheme(!root.classList.contains('dark'), true);
            });
        }

        /* follow the OS while the visitor has not made an explicit choice */
        if (window.matchMedia) {
            var query = window.matchMedia('(prefers-color-scheme: dark)');
            var onChange = function (event) {
                if (!store(THEME_KEY)) setTheme(event.matches, false);
            };
            if (query.addEventListener) query.addEventListener('change', onChange);
            else if (query.addListener) query.addListener(onChange);
        }
    }

    /* ================================================================ *
     * Header — condensed state and reading progress
     * ================================================================ */

    function initScroll() {
        var header = $('#k-header');
        var progress = $('#k-progress');
        if (!header && !progress) return;

        var ticking = false;

        function update() {
            ticking = false;
            var top = window.pageYOffset || root.scrollTop;

            if (header) header.classList.toggle('is-scrolled', top > 8);

            if (progress) {
                var max = root.scrollHeight - window.innerHeight;
                var ratio = max > 0 ? Math.min(1, top / max) : 0;
                progress.style.setProperty('--k-progress', (ratio * 100).toFixed(2) + '%');
            }
        }

        window.addEventListener(
            'scroll',
            function () {
                if (ticking) return;
                ticking = true;
                window.requestAnimationFrame(update);
            },
            { passive: true }
        );

        update();
    }

    /* ================================================================ *
     * Dropdowns and the mobile menu
     * ================================================================ */

    function initDropdowns() {
        var open = null;

        function close(wrap) {
            if (!wrap) return;
            wrap.classList.remove('is-open');
            var panel = $('[data-dropdown-panel]', wrap);
            var trigger = $('[data-dropdown-trigger]', wrap);
            if (panel) panel.hidden = true;
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            if (open === wrap) open = null;
        }

        $$('[data-dropdown]').forEach(function (wrap) {
            var trigger = $('[data-dropdown-trigger]', wrap);
            var panel = $('[data-dropdown-panel]', wrap);
            if (!trigger || !panel) return;

            trigger.addEventListener('click', function (event) {
                event.stopPropagation();
                var willOpen = panel.hidden;
                if (open && open !== wrap) close(open);

                panel.hidden = !willOpen;
                wrap.classList.toggle('is-open', willOpen);
                trigger.setAttribute('aria-expanded', String(willOpen));
                open = willOpen ? wrap : null;
            });
        });

        document.addEventListener('click', function (event) {
            if (open && !open.contains(event.target)) close(open);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            close(open);
            closeMobileMenu();
        });
    }

    function closeMobileMenu() {
        var toggle = $('#k-menu-toggle');
        var menu = $('#k-mobile-menu');
        if (!toggle || !menu || menu.hidden) return;
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    function initMobileMenu() {
        var toggle = $('#k-menu-toggle');
        var menu = $('#k-mobile-menu');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', function () {
            var willOpen = menu.hidden;
            menu.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
        });
    }

    /* ================================================================ *
     * Pointer-tracked glow on cards and the drop zone
     * ================================================================ */

    function initSpotlight() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        $$('[data-spotlight], .k-drop').forEach(function (el) {
            el.addEventListener(
                'pointermove',
                function (event) {
                    var box = el.getBoundingClientRect();
                    el.style.setProperty('--k-mx', ((event.clientX - box.left) / box.width) * 100 + '%');
                    el.style.setProperty('--k-my', ((event.clientY - box.top) / box.height) * 100 + '%');
                },
                { passive: true }
            );
        });
    }

    /* ================================================================ *
     * Reveal on scroll
     * ================================================================ */

    function initReveal() {
        var items = $$('[data-reveal]');
        if (!items.length) return;

        if (!('IntersectionObserver' in window)) {
            items.forEach(function (el) {
                el.classList.add('is-visible');
            });
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
        );

        items.forEach(function (el, index) {
            el.style.transitionDelay = Math.min(index, 8) * 45 + 'ms';
            observer.observe(el);
        });
    }

    /* ================================================================ *
     * Copy to clipboard — [data-copy="#targetId"]
     * ================================================================ */

    function copyText(value) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(value);
        }

        return new Promise(function (resolve, reject) {
            var helper = document.createElement('textarea');
            helper.value = value;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            var ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (e) {
                ok = false;
            }
            document.body.removeChild(helper);
            ok ? resolve() : reject(new Error('copy failed'));
        });
    }

    function initCopy() {
        document.addEventListener('click', function (event) {
            var button = event.target.closest ? event.target.closest('[data-copy]') : null;
            if (!button) return;

            event.preventDefault();

            var selector = button.getAttribute('data-copy');
            var target = selector ? $(selector) : null;

            /* up_boxes repeats per file, so those buttons carry no id:
               fall back to the field inside the surrounding scope. */
            if (!target && button.closest) {
                var scope = button.closest('[data-copy-scope]');
                if (scope) target = $('[data-copy-source]', scope);
            }

            if (!target) return;

            var value = 'value' in target ? target.value : target.textContent;

            copyText(value).then(
                function () {
                    button.classList.add('is-copied');
                    window.setTimeout(function () {
                        button.classList.remove('is-copied');
                    }, 1600);
                    toast(t('copied'), 'success');
                },
                function () {
                    if (target.select) target.select();
                    toast(t('copyFailed'), 'error');
                }
            );
        });
    }

    /* ================================================================ *
     * Captcha refresh
     * ================================================================ */

    function refreshCaptcha(image) {
        var src = image.getAttribute('data-captcha-src') || image.src;
        var inputId = image.getAttribute('data-captcha-input');
        var input = inputId ? document.getElementById(inputId) : null;
        if (input) input.value = '';
        image.src = src + (src.indexOf('?') === -1 ? '?' : '&') + Math.random();
    }

    function initCaptcha() {
        document.addEventListener('click', function (event) {
            var image = event.target.closest ? event.target.closest('[data-captcha-src]') : null;
            if (image) refreshCaptcha(image);
        });
    }

    /* Kept global: plugins and older templates call it from inline onclick. */
    window.update_kleeja_captcha = function (captchaFile, inputId) {
        var input = document.getElementById(inputId);
        if (input) input.value = '';
        var image = document.getElementById('kleeja_img_captcha');
        if (image) image.src = captchaFile + '&' + Math.random();
    };

    /* ================================================================ *
     * Confirmation guards — [data-confirm] on forms and links
     * ================================================================ */

    function initConfirm() {
        $$('form[data-confirm]').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                var message = form.getAttribute('data-confirm') || lang.ARE_YOU_SURE;
                if (!window.confirm(message)) event.preventDefault();
            });
        });
    }

    /* ================================================================ *
     * Checkbox helpers — [data-check-all="rel"] toggles matching boxes
     * ================================================================ */

    function initCheckAll() {
        $$('[data-check-all]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();

                var rel = button.getAttribute('data-check-all');
                var boxes = $$('input[type="checkbox"][rel="' + rel + '"]');
                if (!boxes.length) return;

                var anyChecked = boxes.some(function (box) {
                    return box.checked;
                });

                boxes.forEach(function (box) {
                    box.checked = !anyChecked;
                });
            });
        });
    }

    /* Kept global for backwards compatibility with the older templates. */
    window.checkAll = function (form, rel) {
        if (!form) return;
        var boxes = Array.prototype.filter.call(form.elements, function (el) {
            return el.getAttribute && el.getAttribute('rel') === rel;
        });
        var anyChecked = boxes.some(function (box) {
            return box.checked;
        });
        boxes.forEach(function (box) {
            box.checked = !anyChecked;
        });
    };

    /* ================================================================ *
     * Upload zone
     * ================================================================ */

    function initUploader() {
        var form = $('#uploader');
        var zone = $('#k-drop');
        if (!form || !zone) return;

        var inputs = $$('.k-file-input', zone);
        if (!inputs.length) return;

        var list = $('#k-file-list');
        var loadbox = $('#loadbox');
        var allowedExts = window.KLEEJA_ALLOWED_EXTS || null;
        var allowedSizes = window.KLEEJA_ALLOWED_SIZES || null;
        var chosen = [];
        var supportsDataTransfer = typeof DataTransfer !== 'undefined';

        function validate(file) {
            var dot = file.name.lastIndexOf('.');

            if (dot === -1) {
                return sprintf(lang.WRONG_F_NAME || 'Invalid file name: %s', [file.name]);
            }

            if (!allowedExts) return null;

            var ext = file.name.substring(dot + 1).toLowerCase();
            var index = allowedExts.indexOf(ext);

            if (index === -1) {
                return sprintf(lang.FORBID_EXT || 'Extension not allowed: %s', [ext]);
            }

            if (allowedSizes && allowedSizes[index] && file.size > allowedSizes[index]) {
                return sprintf(lang.SIZE_F_BIG || 'File %1$s is larger than %2$s', [
                    file.name,
                    formatBytes(allowedSizes[index])
                ]);
            }

            return null;
        }

        function syncInputs() {
            if (!supportsDataTransfer) return;

            inputs.forEach(function (input, index) {
                var transfer = new DataTransfer();
                if (chosen[index]) transfer.items.add(chosen[index]);
                input.files = transfer.files;
            });
        }

        function render() {
            if (!list) return;

            list.textContent = '';
            list.hidden = chosen.length === 0;

            chosen.forEach(function (file, index) {
                var item = document.createElement('li');
                item.className = 'k-file-chip';

                var icon = document.createElement('span');
                icon.className = 'k-file-chip-icon';

                if (/^image\//.test(file.type) && window.URL && URL.createObjectURL) {
                    var preview = document.createElement('img');
                    preview.alt = '';
                    preview.src = URL.createObjectURL(file);
                    preview.addEventListener('load', function () {
                        URL.revokeObjectURL(preview.src);
                    });
                    icon.appendChild(preview);
                } else {
                    var glyph = document.createElement('i');
                    glyph.className = 'icon-file-text';
                    icon.appendChild(glyph);
                }

                var body = document.createElement('div');
                body.className = 'k-file-chip-body';

                var name = document.createElement('span');
                name.className = 'k-file-chip-name';
                name.textContent = file.name;

                var meta = document.createElement('span');
                meta.className = 'k-file-chip-meta';
                meta.textContent = formatBytes(file.size);

                body.appendChild(name);
                body.appendChild(meta);

                var remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'k-file-chip-remove';
                remove.setAttribute('aria-label', t('remove') + ': ' + file.name);
                remove.innerHTML = '<i class="icon-x"></i>';
                remove.addEventListener('click', function () {
                    chosen.splice(index, 1);
                    syncInputs();
                    render();
                });

                item.appendChild(icon);
                item.appendChild(body);
                item.appendChild(remove);
                list.appendChild(item);
            });
        }

        function add(files) {
            Array.prototype.forEach.call(files, function (file) {
                if (chosen.length >= inputs.length) {
                    toast(lang.MORE_F_FILES || t('tooManyFiles'), 'error');
                    return;
                }

                var problem = validate(file);
                if (problem) {
                    toast(problem, 'error');
                    return;
                }

                var duplicate = chosen.some(function (existing) {
                    return existing.name === file.name && existing.size === file.size;
                });
                if (!duplicate) chosen.push(file);
            });

            syncInputs();
            render();
        }

        /* files picked through the native dialog */
        inputs.forEach(function (input) {
            input.addEventListener('change', function () {
                if (!input.files || !input.files.length) return;

                if (!supportsDataTransfer) {
                    /* no programmatic FileList support: leave the input as-is */
                    render();
                    return;
                }

                var picked = Array.prototype.slice.call(input.files);
                input.value = '';
                add(picked);
            });
        });

        /* drag and drop */
        if (supportsDataTransfer) {
            ['dragenter', 'dragover'].forEach(function (type) {
                zone.addEventListener(type, function (event) {
                    event.preventDefault();
                    zone.classList.add('is-dragover');
                });
            });

            ['dragleave', 'drop'].forEach(function (type) {
                zone.addEventListener(type, function (event) {
                    event.preventDefault();
                    if (type === 'dragleave' && zone.contains(event.relatedTarget)) return;
                    zone.classList.remove('is-dragover');
                });
            });

            zone.addEventListener('drop', function (event) {
                event.preventDefault();
                if (event.dataTransfer && event.dataTransfer.files.length) {
                    add(event.dataTransfer.files);
                }
            });

            /* dropping anywhere else should not navigate away */
            ['dragover', 'drop'].forEach(function (type) {
                window.addEventListener(type, function (event) {
                    if (!zone.contains(event.target)) event.preventDefault();
                });
            });
        }

        form.addEventListener('submit', function (event) {
            var hasFile = supportsDataTransfer
                ? chosen.length > 0
                : inputs.some(function (input) {
                      return input.files && input.files.length;
                  });

            if (!hasFile) {
                event.preventDefault();
                toast(lang.NO_FILE_SELECTED || 'No file selected', 'error');
                return;
            }

            if (loadbox) {
                form.hidden = true;
                loadbox.hidden = false;
                loadbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    /* ================================================================ *
     * Password visibility — [data-toggle-password="inputId"]
     * ================================================================ */

    function initPasswordToggles() {
        $$('[data-toggle-password]').forEach(function (button) {
            var input = document.getElementById(button.getAttribute('data-toggle-password'));
            if (!input) return;

            button.addEventListener('click', function () {
                var reveal = input.type === 'password';
                input.type = reveal ? 'text' : 'password';
                button.classList.toggle('is-revealed', reveal);
                button.setAttribute('aria-pressed', String(reveal));
                input.focus();
            });
        });
    }

    /* ================================================================ *
     * Tabs — [data-tabs] with [data-tab-btn] / [data-tab-panel]
     * ================================================================ */

    function initTabs() {
        $$('[data-tabs]').forEach(function (group) {
            var buttons = $$('[data-tab-btn]', group);
            var panels = $$('[data-tab-panel]', group);
            if (!buttons.length) return;

            function select(name) {
                buttons.forEach(function (button) {
                    var active = button.getAttribute('data-tab-btn') === name;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-selected', String(active));
                });

                panels.forEach(function (panel) {
                    panel.hidden = panel.getAttribute('data-tab-panel') !== name;
                });
            }

            buttons.forEach(function (button, index) {
                button.addEventListener('click', function () {
                    select(button.getAttribute('data-tab-btn'));
                });

                button.addEventListener('keydown', function (event) {
                    var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                    if (!step) return;
                    event.preventDefault();

                    /* mirror the arrows when the page reads right to left */
                    if (root.getAttribute('dir') === 'rtl') step = -step;

                    var next = buttons[(index + step + buttons.length) % buttons.length];
                    next.focus();
                    next.click();
                });
            });

            /* a field with an error inside a hidden panel must be reachable */
            var invalid = $('.k-input[aria-invalid="true"]', group);
            if (invalid && invalid.closest) {
                var panel = invalid.closest('[data-tab-panel]');
                if (panel) select(panel.getAttribute('data-tab-panel'));
            }
        });
    }

    /* ================================================================ *
     * Download page countdown — [data-countdown]
     * ================================================================ */

    function initCountdown() {
        var box = $('[data-countdown]');
        if (!box) return;

        var seconds = parseInt(box.getAttribute('data-countdown'), 10);
        var counter = $('[data-countdown-value]', box);
        var waiting = $('[data-countdown-wait]', box);
        var ready = $('[data-countdown-ready]', box);
        var ring = $('[data-countdown-ring]', box);
        var total = seconds > 0 ? seconds : 0;

        function finish() {
            if (waiting) waiting.hidden = true;
            if (ready) ready.hidden = false;
        }

        if (!total) {
            finish();
            return;
        }

        if (counter) counter.textContent = String(total);

        var remaining = total;
        var timer = window.setInterval(function () {
            remaining -= 1;

            if (counter) counter.textContent = String(Math.max(remaining, 0));
            if (ring) ring.style.setProperty('--k-ring', ((total - remaining) / total) * 100 + '%');

            if (remaining <= 0) {
                window.clearInterval(timer);
                finish();
            }
        }, 1000);
    }

    /* ================================================================ *
     * Go
     * ================================================================ */

    function init() {
        root.classList.add('k-js');

        applyStrings();
        initTheme();
        initScroll();
        initDropdowns();
        initMobileMenu();
        initSpotlight();
        initReveal();
        initCopy();
        initCaptcha();
        initConfirm();
        initCheckAll();
        initPasswordToggles();
        initTabs();
        initUploader();
        initCountdown();

        waitForTailwind();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* never leave the page invisible, whatever happens above */
    window.addEventListener('load', unlockPaint);
    window.setTimeout(unlockPaint, 2500);
})();
