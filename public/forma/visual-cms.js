/* Forma connector v3. Install with data-editor="https://your-cms.vercel.app". */
(() => {
  'use strict';
  const script = document.currentScript;
  let editorOrigin = script?.dataset.editor
    ? new URL(script.dataset.editor).origin
    : location.origin;
  const contentUrl = script?.dataset.content;
  const liveUrl = script?.dataset.live;
  let liveRevision = null;
  const editing = window.parent !== window;
  let publishedState = null;
  let contentReady = !contentUrl && !liveUrl;
  let contentPathname = location.pathname;
  const channel = 'forma-cms-v1';
  // Anonymous pageview beacon for the Stats panel. Only fires on the live
  // site (never inside the editor frame); no cookies or identifiers.
  if (liveUrl && !editing && navigator.sendBeacon) {
    try {
      const statsSite = new URL(liveUrl, location.href).searchParams.get(
        'site',
      );
      if (statsSite)
        navigator.sendBeacon(
          `${editorOrigin}/api/stats`,
          new Blob(
            [
              JSON.stringify({
                site: statsSite,
                path: location.pathname,
                ref: document.referrer,
                lang: navigator.language,
              }),
            ],
            { type: 'text/plain' },
          ),
        );
    } catch {}
  }
  let active = false,
    preview = false,
    selected = null;
  const properties = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'color',
    'backgroundColor',
    'backgroundSize',
    'backgroundPosition',
    'backgroundRepeat',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'borderWidth',
    'borderStyle',
    'borderColor',
    'borderRadius',
    'width',
    'boxSizing',
    'maxWidth',
    'minHeight',
    'height',
    'display',
    'gap',
    'gridTemplateColumns',
    'alignItems',
    'justifyContent',
    'flexDirection',
    'opacity',
    'objectFit',
    'position',
    'top',
    'left',
  ];
  const records = new Map();
  let domObserver = null;
  const selector =
    'header,nav,main,section,article,footer,div,h1,h2,h3,h4,p,a,button,img,span,ul,li,figure,figcaption,svg';
  const send = (type, payload = {}) => {
    if (editing && active)
      parent.postMessage({ channel, type, ...payload }, editorOrigin);
  };
  const safeUrl = (value, image = false) => {
    try {
      const u = new URL(value, location.href);
      return (
        ['https:', 'http:'].includes(u.protocol) ||
        (!image && ['mailto:', 'tel:'].includes(u.protocol)) ||
        (!image && value.startsWith('#')) ||
        (image && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value))
      );
    } catch {
      return false;
    }
  };
  const leaf = (el) =>
    el.tagName.toLowerCase() !== 'svg' &&
    !el.children.length &&
    !['IMG', 'INPUT', 'TEXTAREA', 'VIDEO', 'PICTURE'].includes(el.tagName) &&
    (!!el.textContent.trim() ||
      /^(P|H[1-6]|A|BUTTON|SPAN|FIGCAPTION)$/.test(el.tagName)) &&
    !getComputedStyle(el).backgroundImage?.includes('url(');
  function capture() {
    for (const [id, record] of records) {
      if (!record.el.isConnected) records.delete(id);
    }
    let index = 0;
    document.body.querySelectorAll(selector).forEach((el) => {
      if (
        el.closest('[data-cms-ignore]') ||
        el.hasAttribute('data-cms-text-link') ||
        (el.closest('svg') && el.closest('svg') !== el)
      )
        return;
      let id = el.getAttribute('data-cms-id') || el.id || `forma-${++index}`;
      if (records.get(id)?.el === el) return;
      while (records.has(id)) id = `forma-${++index}`;
      el.setAttribute('data-cms-id', id);
      records.set(id, {
        el,
        style: el.getAttribute('style'),
        text: leaf(el) ? el.textContent : null,
        href: el.getAttribute('href'),
        src: el.getAttribute('src'),
        srcset: el.getAttribute('srcset'),
        sources:
          el.tagName === 'IMG'
            ? [
                ...(el.closest('picture')?.querySelectorAll('source') || []),
              ].map((node) => ({ node, srcset: node.getAttribute('srcset') }))
            : [],
        alt: el.getAttribute('alt'),
        svgAttrs: Object.fromEntries(
          ['viewBox', 'fill', 'stroke', 'stroke-width'].map((a) => [
            a,
            el.getAttribute(a),
          ]),
        ),
        children: [...el.childNodes],
      });
    });
  }
  function info(id) {
    const r = records.get(id);
    if (!r) return null;
    const el = r.el,
      css = getComputedStyle(el),
      styles = {};
    properties.forEach((p) => (styles[p] = css[p]));
    let p = el.parentElement;
    while (p && !records.has(p.dataset.cmsId)) p = p.parentElement;
    return {
      id,
      parent: p?.dataset.cmsId || null,
      tag: el.tagName.toLowerCase(),
      name:
        el.dataset.cmsName ||
        (el.tagName === 'IMG'
          ? el.getAttribute('alt') || 'Image'
          : r.text !== null
            ? el.textContent.trim().slice(0, 44)
            : {
                HEADER: 'Header',
                NAV: 'Navigation',
                MAIN: 'Page',
                SECTION: 'Section',
                FOOTER: 'Footer',
                DIV: 'Container',
              }[el.tagName] || el.tagName.toLowerCase()),
      text: r.text !== null ? el.textContent : null,
      canLink: r.text !== null,
      href: el.getAttribute('href'),
      src:
        el.tagName === 'IMG'
          ? r.replacementSrc || el.currentSrc || el.src || null
          : el.tagName.toLowerCase() === 'svg'
            ? el
                .querySelector('image[data-cms-replacement]')
                ?.getAttribute('href') || null
            : null,
      alt: el.getAttribute('alt'),
      styles,
      backgroundImage:
        /url\(["']?(.*?)["']?\)/.exec(css.backgroundImage || '')?.[1] || null,
      mediaKind:
        el.tagName === 'IMG'
          ? 'image'
          : el.tagName.toLowerCase() === 'svg'
            ? 'svg'
            : css.backgroundImage?.includes('url(')
              ? 'background'
              : null,
      hidden: css.display === 'none',
    };
  }
  function tree() {
    return [...document.body.querySelectorAll('[data-cms-id]')]
      .filter(
        (el) =>
          records.has(el.dataset.cmsId) && !el.closest('[data-cms-deleted]'),
      )
      .map((el) => info(el.dataset.cmsId));
  }
  let resizeHandle = null;
  let resizing = null;
  let designAllowed = true;
  let textAllowed = true;
  function finishResize(commit = false) {
    if (!resizing) return;
    const done = resizing;
    resizing = null;
    attr(done.el, 'style', done.originalStyle);
    try {
      if (resizeHandle.hasPointerCapture?.(done.pointerId))
        resizeHandle.releasePointerCapture(done.pointerId);
    } catch {}
    if (
      commit &&
      done.nextWidth !== undefined &&
      Math.abs(done.nextWidth - done.width) >= 1
    )
      send('resize', {
        id: done.id,
        width: done.nextWidth,
        inline: done.inline,
      });
    positionResizeHandle();
  }
  function positionResizeHandle() {
    if (!resizeHandle) return;
    const record = records.get(selected);
    const visible =
      active && !preview && designAllowed && record?.text !== null && !!record;
    resizeHandle.hidden = !visible;
    if (!visible) return;
    const rect = record.el.getBoundingClientRect();
    resizeHandle.style.left = `${Math.min(window.innerWidth - 16, rect.right - 6)}px`;
    resizeHandle.style.top = `${rect.top + rect.height / 2 - 16}px`;
  }
  function select(id, scroll = false) {
    if (resizing && resizing.id !== id) finishResize();
    records.forEach((r) => r.el.removeAttribute('data-cms-selected'));
    selected = records.has(id) ? id : null;
    if (selected && !preview) {
      const el = records.get(id).el;
      el.setAttribute('data-cms-selected', '');
      if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    positionResizeHandle();
    send('selection', { node: info(selected) });
  }
  const attr = (el, name, value) =>
    value === null ? el.removeAttribute(name) : el.setAttribute(name, value);
  function apply(state) {
    finishResize();
    if (!state || typeof state !== 'object') return;
    for (const [id, record] of records) {
      if (record.el.hasAttribute('data-cms-added')) {
        record.el.remove();
        records.delete(id);
      }
    }
    for (const [id, r] of records) {
      // Only reset elements Forma itself changed or is about to change.
      // Resetting every record would stomp the inline styles and child spans
      // that page scripts (intro animations, canvas mounts) write between
      // capture() and this apply.
      if (
        !r.el.hasAttribute('data-cms-patched') &&
        !r.el.hasAttribute('data-cms-deleted') &&
        !Object.hasOwn(state.patches || {}, id)
      )
        continue;
      r.el.removeAttribute('data-cms-patched');
      attr(r.el, 'style', r.style);
      r.el.removeAttribute('data-cms-deleted');
      r.sources.forEach(({ node, srcset }) => attr(node, 'srcset', srcset));
      r.replacementSrc = null;
      if (r.text !== null) r.el.textContent = r.text;
      else r.el.replaceChildren(...r.children);
      if (r.el.tagName.toLowerCase() === 'svg')
        Object.entries(r.svgAttrs).forEach(([k, v]) => attr(r.el, k, v));
      ['href', 'src', 'srcset', 'alt'].forEach((k) => attr(r.el, k, r[k]));
    }
    const insertedAfter = new Map();
    for (const item of (Array.isArray(state.insertions)
      ? state.insertions
      : []
    ).slice(0, 100)) {
      if (
        !item ||
        !/^forma-added-[a-zA-Z0-9-]{8,80}$/.test(item.id) ||
        records.has(item.id) ||
        !['text', 'image', 'button'].includes(item.kind)
      )
        continue;
      const anchor = records.get(item.anchor)?.el;
      const parentElement =
        item.position === 'inside' ? anchor : anchor?.parentElement;
      if (
        !anchor?.isConnected ||
        !parentElement ||
        !/^(MAIN|SECTION|ARTICLE|HEADER|FOOTER|DIV|LI|FIGURE|ASIDE)$/.test(
          parentElement.tagName,
        ) ||
        parentElement.closest('a,button,svg') ||
        !['inside', 'after'].includes(item.position)
      )
        continue;
      if (
        item.kind === 'image' &&
        (typeof item.src !== 'string' || !safeUrl(item.src, true))
      )
        continue;
      if (
        item.kind === 'button' &&
        (typeof item.href !== 'string' || !safeUrl(item.href))
      )
        continue;
      const el = document.createElement(
        item.kind === 'image' ? 'img' : item.kind === 'button' ? 'a' : 'p',
      );
      el.dataset.cmsId = item.id;
      el.dataset.cmsAdded = '';
      if (item.kind === 'image') {
        el.src = item.src;
        el.alt = String(item.alt || 'Image').slice(0, 2000);
        el.style.cssText =
          'display:block;width:100%;max-width:100%;height:auto;object-fit:cover;margin:16px 0';
      } else {
        el.textContent = String(
          item.text || (item.kind === 'button' ? 'Learn more' : 'New text'),
        ).slice(0, 50000);
        el.style.cssText =
          'font-family:inherit;color:inherit;margin:16px 0;max-width:100%;box-sizing:border-box';
        if (item.kind === 'button') {
          el.href = item.href;
          el.style.cssText +=
            ';display:inline-block;padding:12px 20px;border:1px solid currentColor;border-radius:6px;text-decoration:none;font-size:16px;font-weight:600';
        } else el.style.cssText += ';font-size:18px;line-height:1.5';
      }
      if (item.position === 'inside') parentElement.appendChild(el);
      else {
        const previous = insertedAfter.get(item.anchor) || anchor;
        previous.after(el);
        insertedAfter.set(item.anchor, el);
      }
      capture();
    }
    for (const [id, patch] of Object.entries(state.patches || {})) {
      const r = records.get(id);
      if (!r || !patch || typeof patch !== 'object') continue;
      r.el.setAttribute('data-cms-patched', '');
      if (typeof patch.text === 'string' && r.text !== null)
        r.el.textContent = patch.text.slice(0, 50000);
      if (
        r.text !== null &&
        (Array.isArray(patch.textLinks) || Array.isArray(patch.textMarks))
      ) {
        const text = r.el.textContent;
        let linkEnd = 0;
        const links = (Array.isArray(patch.textLinks) ? patch.textLinks : [])
          .slice(0, 100)
          .filter(
            (l) =>
              l &&
              Number.isInteger(l.start) &&
              Number.isInteger(l.end) &&
              l.start >= linkEnd &&
              l.end > l.start &&
              l.end <= text.length &&
              typeof l.href === 'string' &&
              l.href.length <= 2000 &&
              safeUrl(l.href) &&
              (linkEnd = l.end),
          );
        const marks = (Array.isArray(patch.textMarks) ? patch.textMarks : [])
          .slice(0, 500)
          .filter(
            (m) =>
              m &&
              Number.isInteger(m.start) &&
              Number.isInteger(m.end) &&
              m.start >= 0 &&
              m.end > m.start &&
              m.end <= text.length,
          );
        const points = [
          ...new Set([
            0,
            text.length,
            ...links.flatMap((l) => [l.start, l.end]),
            ...marks.flatMap((m) => [m.start, m.end]),
          ]),
        ].sort((a, b) => a - b);
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < points.length - 1; i++) {
          const start = points[i],
            end = points[i + 1];
          const link = links.find((l) => l.start <= start && l.end >= end);
          const mark = marks.find((m) => m.start <= start && m.end >= end);
          if (!link && !mark) {
            fragment.append(document.createTextNode(text.slice(start, end)));
            continue;
          }
          const nested = !!r.el.closest('a,button,label');
          const span = document.createElement(link && !nested ? 'a' : 'span');
          span.setAttribute('data-cms-text-link', '');
          span.textContent = text.slice(start, end);
          if (link) {
            if (nested) {
              span.setAttribute('role', 'link');
              span.tabIndex = 0;
              span.dataset.cmsInlineHref = link.href;
              if (link.newTab === true) span.dataset.cmsInlineNewTab = 'true';
            } else {
              span.setAttribute('href', link.href);
              if (link.newTab === true) {
                span.target = '_blank';
                span.rel = 'noopener noreferrer';
              }
            }
            span.style.color = 'inherit';
            span.style.textDecoration = 'underline';
            span.style.cursor = 'pointer';
          }
          if (mark) {
            if (typeof mark.bold === 'boolean')
              span.style.fontWeight = mark.bold ? '700' : '400';
            if (typeof mark.italic === 'boolean')
              span.style.fontStyle = mark.italic ? 'italic' : 'normal';
            if (
              typeof mark.underline === 'boolean' ||
              typeof mark.strike === 'boolean'
            )
              span.style.textDecoration =
                [
                  mark.underline || (link && mark.underline !== false)
                    ? 'underline'
                    : '',
                  mark.strike ? 'line-through' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || 'none';
            if (
              typeof mark.color === 'string' &&
              /^#[\da-f]{6}$/i.test(mark.color)
            )
              span.style.color = mark.color;
            if (
              typeof mark.background === 'string' &&
              (mark.background === 'transparent' ||
                /^#[\da-f]{6}$/i.test(mark.background))
            )
              span.style.backgroundColor = mark.background;
            if (
              Number.isFinite(mark.size) &&
              mark.size >= 8 &&
              mark.size <= 200
            )
              span.style.fontSize = mark.size + 'px';
            if (
              typeof mark.font === 'string' &&
              /^[a-z0-9_ ,"'-]{1,200}$/i.test(mark.font)
            )
              span.style.fontFamily = mark.font;
          }
          fragment.append(span);
        }
        r.el.replaceChildren(fragment);
      }
      if (
        typeof patch.href === 'string' &&
        r.el.tagName === 'A' &&
        safeUrl(patch.href)
      )
        r.el.setAttribute('href', patch.href);
      if (
        typeof patch.src === 'string' &&
        r.el.tagName === 'IMG' &&
        safeUrl(patch.src, true)
      ) {
        r.el.setAttribute('src', patch.src);
        r.replacementSrc = new URL(patch.src, location.href).href;
        r.el.removeAttribute('srcset');
        r.sources.forEach(({ node }) => node.removeAttribute('srcset'));
      }
      if (
        r.el.tagName.toLowerCase() === 'svg' &&
        typeof patch.icon === 'string'
      ) {
        const icons = {
          'arrow-up-right': 'M7 17 17 7M7 7h10v10',
          'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
          check: 'm5 12 4 4L19 6',
          plus: 'M12 5v14M5 12h14',
          star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
          heart:
            'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
        };
        if (Object.hasOwn(icons, patch.icon)) {
          const path = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path',
          );
          path.setAttribute('d', icons[patch.icon]);
          r.el.replaceChildren(path);
          r.el.setAttribute('viewBox', '0 0 24 24');
          r.el.setAttribute('fill', 'none');
          r.el.setAttribute('stroke', 'currentColor');
          r.el.setAttribute('stroke-width', '1.8');
        }
      }
      if (
        typeof patch.backgroundImage === 'string' &&
        (patch.backgroundImage === '' || safeUrl(patch.backgroundImage, true))
      ) {
        r.el.style.backgroundImage = patch.backgroundImage
          ? `url(${JSON.stringify(patch.backgroundImage)})`
          : 'none';
        r.el.style.backgroundSize = 'cover';
        r.el.style.backgroundPosition = 'center';
        r.el.style.backgroundRepeat = 'no-repeat';
      }
      if (
        r.el.tagName.toLowerCase() === 'svg' &&
        typeof patch.src === 'string' &&
        patch.src &&
        safeUrl(patch.src, true)
      ) {
        const photo = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'image',
        );
        const box = (r.svgAttrs.viewBox || '0 0 100 100')
          .trim()
          .split(/[ ,]+/)
          .map(Number);
        photo.setAttribute('data-cms-replacement', '');
        photo.setAttribute('href', patch.src);
        photo.setAttribute('x', String(box[0] || 0));
        photo.setAttribute('y', String(box[1] || 0));
        photo.setAttribute('width', String(box[2] || 100));
        photo.setAttribute('height', String(box[3] || 100));
        photo.setAttribute(
          'preserveAspectRatio',
          patch.styles?.objectFit === 'contain'
            ? 'xMidYMid meet'
            : 'xMidYMid slice',
        );
        if (!r.svgAttrs.viewBox) r.el.setAttribute('viewBox', '0 0 100 100');
        r.el.replaceChildren(photo);
        r.el.style.opacity = '1';
      }
      if (typeof patch.alt === 'string' && r.el.tagName === 'IMG')
        r.el.setAttribute('alt', patch.alt);
      for (const [key, value] of Object.entries(patch.styles || {}))
        if (
          properties.includes(key) &&
          typeof value === 'string' &&
          value.length < 500 &&
          !/url\s*\(|expression|@import/i.test(value)
        )
          r.el.style[key] = value;
      if (patch.deleted === true) {
        r.el.setAttribute('data-cms-deleted', '');
        r.el.style.setProperty('display', 'none', 'important');
      }
    }
    for (const [parentId, ids] of Object.entries(state.orders || {})) {
      const p = records.get(parentId)?.el;
      if (p && Array.isArray(ids)) {
        p.setAttribute('data-cms-patched', '');
        ids.forEach((id) => {
          const c = records.get(id)?.el;
          if (c?.parentElement === p) p.appendChild(c);
        });
      }
    }
    if (active) {
      select(selected);
      send('tree', { nodes: tree() });
    }
    // Do not treat our own patches as framework renders.
    domObserver?.takeRecords();
  }
  function followPreviewLink(href, newTab, event) {
    if (!href || !safeUrl(href)) return;
    const target = new URL(href, location.href);
    event.preventDefault();
    event.stopImmediatePropagation();
    let canonicalOrigin = location.origin;
    try {
      canonicalOrigin = new URL(
        document.querySelector('link[rel=canonical]')?.href || location.href,
      ).origin;
    } catch {}
    const internal =
      target.origin === location.origin || target.origin === canonicalOrigin;
    if (newTab || event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
    } else if (active && internal) {
      if (
        target.pathname === location.pathname &&
        target.search === location.search
      ) {
        // Anchor links remain in the current preview and keep unsaved edits.
        location.hash = target.hash;
        if (target.hash) {
          try {
            document
              .getElementById(decodeURIComponent(target.hash.slice(1)))
              ?.scrollIntoView();
          } catch {}
        }
      } else
        send('navigate', {
          path: target.pathname + target.search + target.hash,
        });
    } else if (active && /^https?:$/.test(target.protocol)) {
      // External sites often disallow embedding; open them as a normal page.
      window.open(target.href, '_blank', 'noopener,noreferrer');
    } else location.assign(target.href);
  }
  function followInlineLink(el, event) {
    followPreviewLink(
      el.dataset.cmsInlineHref,
      el.dataset.cmsInlineNewTab === 'true',
      event,
    );
  }
  function reportTextRange() {
    if (!active || preview) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const startEl =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
    const el = startEl?.closest?.('[data-cms-id]');
    const record = el && records.get(el.dataset.cmsId);
    if (!record || record.text === null || !el.contains(range.endContainer))
      return;
    const before = range.cloneRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length,
      end = start + range.toString().length;
    if (end <= start || end > el.textContent.length) return;
    const rect = range.getBoundingClientRect();
    select(el.dataset.cmsId);
    send('text-range', {
      id: el.dataset.cmsId,
      range: { start, end },
      rect: { x: rect.left, y: rect.top },
    });
  }
  function onClick(e) {
    if (!active || preview) {
      const inline = e.target.closest?.('[data-cms-inline-href]');
      if (inline && e.button === 0) {
        followInlineLink(inline, e);
        return;
      }
      const link = e.target.closest?.('a[href]');
      if (
        !link ||
        e.defaultPrevented ||
        e.button !== 0 ||
        link.hasAttribute('download')
      )
        return;
      if (active) {
        followPreviewLink(
          link.getAttribute('href'),
          link.target === '_blank',
          e,
        );
      } else if (
        liveUrl &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        (!link.target || link.target === '_self')
      ) {
        const target = new URL(link.href, location.href);
        if (
          target.origin === location.origin &&
          (target.pathname !== location.pathname ||
            target.search !== location.search)
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          location.assign(target.href);
        }
      }
      return;
    }
    if (e.target.closest?.('[data-cms-ignore]')) return;
    let el = e.target.closest?.('[data-cms-id]');
    const target = e.target;
    // Gradients layered over photos should select the photo, while text stays editable.
    if (
      target.tagName !== 'IMG' &&
      !(leaf(target) && target.textContent.trim()) &&
      !target.closest?.('button,input,textarea,select')
    ) {
      const photo = document
        .elementsFromPoint?.(e.clientX, e.clientY)
        .map((node) => (node.tagName === 'IMG' ? node : node.closest?.('svg')))
        .find(
          (node) =>
            node &&
            (node.parentElement === target.parentElement ||
              node.parentElement?.parentElement === target.parentElement) &&
            getComputedStyle(node).visibility !== 'hidden' &&
            getComputedStyle(node).opacity !== '0',
        );
      if (photo) {
        capture();
        el = photo;
      }
    }
    if (target.closest?.('svg')) {
      capture();
      el = target.closest('svg');
    }
    if (target.tagName === 'IMG') {
      capture();
      el = target;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (el) select(el.dataset.cmsId);
  }
  function start() {
    capture();
    // React/Vue/Svelte can mount after DOMContentLoaded. Observe structural
    // changes without polling the server or interfering with inline typing.
    domObserver = new MutationObserver((mutations) => {
      let changed = false;
      for (const mutation of mutations) {
        if (
          mutation.target.closest?.(
            '[data-cms-ignore],[contenteditable="true"]',
          )
        )
          continue;
        const record = records.get(mutation.target.dataset?.cmsId);
        if (record?.text !== null && record?.text !== undefined) continue;
        if (
          ![...mutation.addedNodes, ...mutation.removedNodes].some(
            (node) =>
              node.nodeType === 1 && !node.hasAttribute('data-cms-ignore'),
          )
        )
          continue;
        if (record) record.children = [...record.el.childNodes];
        changed = true;
      }
      if (!changed) return;
      capture();
      // Client-side routers replace the page without reloading this script.
      // Never apply the previous page's patches to the new route.
      if (!active && location.pathname !== contentPathname) {
        contentPathname = location.pathname;
        publishedState = null;
        liveRevision = null;
        if (liveUrl || contentUrl) {
          loadContent(liveUrl || contentUrl)
            .catch(() =>
              liveUrl && contentUrl ? loadContent(contentUrl) : undefined,
            )
            .catch(() => {});
        }
        return;
      }
      if (!active && publishedState) apply(publishedState);
      else if (active) send('tree', { nodes: tree() });
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    if (editing) {
      resizeHandle = document.createElement('button');
      resizeHandle.dataset.cmsIgnore = '';
      resizeHandle.dataset.cmsOverlay = '';
      resizeHandle.type = 'button';
      resizeHandle.hidden = true;
      resizeHandle.setAttribute('aria-label', 'Resize text width');
      resizeHandle.title = 'Drag to resize text width';
      resizeHandle.style.cssText =
        'position:fixed;width:12px;height:32px;border:2px solid white;border-radius:8px;background:#8063e6;z-index:2147483647;cursor:ew-resize;touch-action:none;padding:0;box-shadow:0 0 0 1px #8063e6';
      document.body.appendChild(resizeHandle);
      resizeHandle.addEventListener('pointerdown', (e) => {
        const record = records.get(selected);
        if (
          !active ||
          !record ||
          record.text === null ||
          preview ||
          !designAllowed ||
          e.button !== 0 ||
          e.isPrimary === false
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        finishResize();
        const rect = record.el.getBoundingClientRect();
        const width = record.el.offsetWidth || rect.width;
        resizing = {
          id: selected,
          el: record.el,
          pointerId: e.pointerId,
          startX: e.clientX,
          width,
          scale: rect.width / width || 1,
          inline: getComputedStyle(record.el).display === 'inline',
          originalStyle: record.el.getAttribute('style'),
        };
        try {
          resizeHandle.setPointerCapture?.(e.pointerId);
        } catch {}
      });
      // Listen outside the handle too: losing capture or releasing elsewhere
      // must never leave a live, unrecorded drag behind.
      window.addEventListener(
        'pointermove',
        (e) => {
          if (!resizing || e.pointerId !== resizing.pointerId) return;
          if (!(e.buttons & 1)) {
            finishResize(true);
            return;
          }
          if (!active || preview || !designAllowed) {
            finishResize();
            return;
          }
          const delta = (e.clientX - resizing.startX) / resizing.scale;
          if (resizing.nextWidth === undefined && Math.abs(delta) < 3) return;
          e.preventDefault();
          const parentWidth = resizing.el.parentElement?.clientWidth || 8000;
          const width = Math.max(
            24,
            Math.min(parentWidth, resizing.width + delta),
          );
          resizing.el.style.setProperty('width', `${width}px`, 'important');
          resizing.el.style.setProperty('max-width', '100%', 'important');
          resizing.el.style.setProperty(
            'box-sizing',
            'border-box',
            'important',
          );
          if (resizing.inline)
            resizing.el.style.setProperty(
              'display',
              'inline-block',
              'important',
            );
          resizing.nextWidth = width;
          positionResizeHandle();
        },
        { capture: true, passive: false },
      );
      window.addEventListener(
        'pointerup',
        (e) => {
          if (resizing && e.pointerId === resizing.pointerId)
            finishResize(true);
        },
        true,
      );
      window.addEventListener(
        'pointercancel',
        (e) => {
          if (resizing && e.pointerId === resizing.pointerId) finishResize();
        },
        true,
      );
      resizeHandle.addEventListener('lostpointercapture', (e) => {
        if (resizing && e.pointerId === resizing.pointerId) finishResize(true);
      });
      window.addEventListener('blur', () => finishResize(true));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) finishResize(true);
      });
      document.addEventListener('scroll', positionResizeHandle, true);
      window.addEventListener('resize', positionResizeHandle);
    }
    const highlight = document.createElement('style');
    highlight.dataset.cmsOverlay = '';
    highlight.textContent =
      'html[data-cms-editing] [data-cms-id]:hover{outline:1px dashed #8b74ee;outline-offset:3px;cursor:default}html[data-cms-editing] [data-cms-selected]{outline:2px solid #8063e6!important;outline-offset:5px}html[data-cms-editing] [contenteditable=true]{cursor:text!important}';
    document.head.appendChild(highlight);
    document.addEventListener('click', onClick, true);
    document.addEventListener(
      'contextmenu',
      (e) => {
        if (
          !active ||
          preview ||
          e.target.closest?.(
            'input,textarea,select,[contenteditable],[data-cms-ignore]',
          )
        )
          return;
        onClick(e);
        if (selected)
          send('context-menu', { id: selected, x: e.clientX, y: e.clientY });
      },
      true,
    );
    document.addEventListener('mouseup', reportTextRange);
    document.addEventListener('keyup', reportTextRange);
    document.addEventListener(
      'submit',
      (e) => {
        if (active && !preview) e.preventDefault();
      },
      true,
    );
    document.addEventListener('dblclick', (e) => {
      if (!active || preview || !textAllowed) return;
      const el = e.target.closest?.('[data-cms-id]');
      if (!el || records.get(el.dataset.cmsId)?.text === null) return;
      e.preventDefault();
      const beforeEditing = el.textContent;
      el.contentEditable = 'plaintext-only';
      el.focus();
      el.addEventListener(
        'blur',
        () => {
          el.removeAttribute('contenteditable');
          if (el.textContent !== beforeEditing)
            send('text-change', { id: el.dataset.cmsId, text: el.textContent });
        },
        { once: true },
      );
    });
    document.addEventListener('keydown', (e) => {
      const inline = e.target.closest?.('[data-cms-inline-href]');
      if ((!active || preview) && inline && e.key === 'Enter') {
        followInlineLink(inline, e);
        return;
      }
      if (!active) return;
      if (
        resizing &&
        (e.key === 'Escape' ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        finishResize();
        return;
      }
      const inText =
        e.target.isContentEditable ||
        e.target.closest?.('[contenteditable]') ||
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (
        !preview &&
        !inText &&
        !e.isComposing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        ['Delete', 'Backspace'].includes(e.key) &&
        selected
      ) {
        e.preventDefault();
        e.stopPropagation();
        send('shortcut', { key: 'delete' });
        return;
      }
      const textEditor = e.target.closest?.('[contenteditable][data-cms-id]');
      const managedText =
        !preview &&
        textEditor &&
        records.get(textEditor.dataset.cmsId)?.text !== null;
      if (
        !e.isComposing &&
        !e.altKey &&
        (e.ctrlKey || e.metaKey) &&
        ['z', 'y', 's'].includes(e.key.toLowerCase()) &&
        (!inText || managedText)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (managedText) textEditor.blur();
        send('shortcut', { key: e.key.toLowerCase(), shift: e.shiftKey });
        return;
      }
      if (inText && e.key === 'Escape') e.target.blur();
    });
    document.addEventListener('beforeinput', (e) => {
      if (
        !active ||
        preview ||
        !['historyUndo', 'historyRedo'].includes(e.inputType)
      )
        return;
      const textEditor = e.target.closest?.('[contenteditable][data-cms-id]');
      if (!textEditor || !records.has(textEditor.dataset.cmsId)) return;
      e.preventDefault();
      textEditor.blur();
      send('shortcut', { key: e.inputType === 'historyUndo' ? 'z' : 'y' });
    });
    window.addEventListener('message', (e) => {
      if (
        e.source !== parent ||
        e.origin !== editorOrigin ||
        e.data?.channel !== channel
      )
        return;
      const m = e.data;
      if (m.type === 'hello') {
        if (!contentReady) return;
        capture();
        active = true;
        document.documentElement.toggleAttribute('data-cms-editing', !preview);
        const iconHref =
          document.querySelector('link[rel~="icon"]')?.href ||
          document.querySelector('link[rel="apple-touch-icon"]')?.href ||
          '';
        send('ready', {
          nodes: tree(),
          title: document.title,
          path: location.pathname,
          publicUrl:
            document.querySelector('link[rel=canonical]')?.href ||
            document.querySelector('meta[property="og:url"]')?.content ||
            location.origin,
          icon: iconHref,
          publishedState,
          live: !!liveUrl,
          revision: liveRevision,
        });
        if (iconHref)
          fetch(iconHref)
            .then((r) => r.blob())
            .then((b) => createImageBitmap(b))
            .then((bmp) => {
              const c = document.createElement('canvas');
              c.width = c.height = 16;
              c.getContext('2d').drawImage(bmp, 0, 0, 16, 16);
              const d = c
                .getContext('2d')
                .getImageData(0, 0, 16, 16).data;
              let light = 0,
                opaque = 0;
              for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] < 100) continue;
                opaque++;
                if (
                  0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 200
                )
                  light++;
              }
              send('icon-tone', {
                light: opaque > 0 && light / opaque > 0.85,
              });
            })
            .catch(() => {});
        return;
      }
      if (!active) return;
      if (m.type === 'permissions') {
        if (m.design === false) finishResize();
        designAllowed = m.design !== false;
        textAllowed = m.text !== false;
        positionResizeHandle();
      }
      if (m.type === 'apply') apply(m.state);
      if (m.type === 'select') select(m.id, m.scroll !== false);
      if (m.type === 'preview') {
        finishResize();
        preview = !!m.value;
        document.documentElement.toggleAttribute('data-cms-editing', !preview);
        select(selected);
      }
      if (m.type === 'export-html') {
        const clone = document.documentElement.cloneNode(true);
        clone.removeAttribute('data-cms-editing');
        clone
          .querySelectorAll('[data-cms-selected],[contenteditable]')
          .forEach((el) => {
            el.removeAttribute('data-cms-selected');
            el.removeAttribute('contenteditable');
          });
        clone
          .querySelectorAll(
            '[data-cms-overlay],[data-cms-deleted],script[src*="visual-cms.js"]',
          )
          .forEach((el) => el.remove());
        const base = document.createElement('base');
        base.href = location.href;
        clone.querySelector('head').prepend(base);
        send('html', { html: '<!doctype html>\n' + clone.outerHTML });
      }
    });
    // Live content is separate from deployments. The repository file is a fallback.
    async function loadContent(address) {
      const requestedPath = location.pathname;
      const target = new URL(address, location.href);
      if (address === liveUrl) {
        target.searchParams.set('page', requestedPath);
        // An editor must start from the latest revision for conflict checks.
        if (editing) target.searchParams.set('editor', '1');
      }
      const response = await fetch(target, {
        signal: AbortSignal.timeout(6000),
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Content unavailable');
      const data = await response.json();
      if (requestedPath !== location.pathname) return;
      // Follow a domain migration only when the configured editor itself redirects
      // its live-content endpoint. Never trust the embedding parent or page URL.
      if (
        address === liveUrl &&
        target.origin === editorOrigin &&
        response.url
      ) {
        const canonical = new URL(response.url);
        if (
          canonical.protocol === 'https:' &&
          canonical.pathname === target.pathname
        )
          editorOrigin = canonical.origin;
      }
      const state =
        data.version === 2
          ? data.pages?.[location.pathname] || null
          : data.version === 1 &&
              (!data.path || data.path === location.pathname)
            ? data.state
            : null;
      if (address === liveUrl) liveRevision = data.revision || null;
      if (JSON.stringify(publishedState) !== JSON.stringify(state)) {
        publishedState = state;
        if (!active) apply(publishedState || { patches: {}, orders: {} });
      }
    }
    let lastContentRead = Date.now();
    if (liveUrl || contentUrl) {
      loadContent(liveUrl || contentUrl)
        .catch(() =>
          liveUrl && contentUrl ? loadContent(contentUrl) : undefined,
        )
        .catch(() => {})
        .finally(() => {
          contentReady = true;
        });
    }
    if (liveUrl) {
      let fetching = false;
      const refresh = () => {
        if (
          active ||
          fetching ||
          !contentReady ||
          document.visibilityState === 'hidden' ||
          Date.now() - lastContentRead < 60000
        )
          return;
        fetching = true;
        lastContentRead = Date.now();
        loadContent(liveUrl)
          .catch(() => {})
          .finally(() => {
            fetching = false;
          });
      };
      // Visitors load published content once. Recheck only when returning to
      // an old tab; never poll Blob while somebody is simply reading a page.
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('pageshow', refresh);
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
