import css from './styles.css';
import { activeFeatures, calculate, clamp, featuresFor, findType } from './calc';
import { icon } from './icons';
import { formatFa, normalizeMobile, toFa } from './persian';
import type { Estimate, EstimatorConfig, Selection } from './types';

const STEPS = ['type', 'features', 'scale', 'urgency', 'contact'] as const;
type StepKey = (typeof STEPS)[number];
type Status = 'loading' | 'error' | 'ready' | 'done';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class CostEstimator extends HTMLElement {
  static observedAttributes = ['config-url'];

  private cfg?: EstimatorConfig;
  private status: Status = 'loading';
  private step = 0;
  private sel: Selection = { typeId: null, featureIds: [], units: 0, urgencyId: null };
  private shown: Estimate = { minPrice: 0, maxPrice: 0, minWeeks: 0, maxWeeks: 0 };
  private raf = 0;
  private announceTimer = 0;
  private loadId = 0;
  private submitting = false;
  private formError = '';
  private contact = { name: '', mobile: '' };
  private root!: HTMLElement;

  /** Programmatic alternative to the config-url attribute. */
  set config(value: EstimatorConfig) {
    this.useConfig(value);
  }
  get config(): EstimatorConfig | undefined {
    return this.cfg;
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      const sr = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = css;
      this.root = document.createElement('div');
      this.root.className = 'root';
      this.root.setAttribute('role', 'group');
      this.root.addEventListener('change', (e) => this.onChange(e));
      this.root.addEventListener('input', (e) => this.onInput(e));
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('submit', (e) => this.onSubmit(e));
      sr.append(style, this.root);
      this.renderState();
    }
    if (!this.cfg) void this.load();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.announceTimer);
  }

  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    if (name === 'config-url' && this.root && this.isConnected && oldV !== newV) {
      this.cfg = undefined;
      void this.load();
    }
  }

  // ---------- loading ----------
  private async load() {
    const url = this.getAttribute('config-url');
    const id = ++this.loadId;
    this.status = 'loading';
    this.renderState();
    try {
      if (!url) throw new Error('config-url attribute is missing');
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EstimatorConfig;
      if (id !== this.loadId) return;
      this.useConfig(data);
    } catch (err) {
      if (id !== this.loadId) return;
      console.warn('[cost-estimator] config load failed:', err);
      this.status = 'error';
      this.renderState();
    }
  }

  private useConfig(cfg: EstimatorConfig) {
    if (!cfg?.projectTypes?.length || !cfg.texts) {
      console.warn('[cost-estimator] invalid config');
      this.status = 'error';
      if (this.root) this.renderState();
      return;
    }
    this.cfg = cfg;
    this.sel = { typeId: null, featureIds: [], units: 0, urgencyId: cfg.defaultUrgency ?? cfg.urgency[0]?.id ?? null };
    this.shown = { minPrice: 0, maxPrice: 0, minWeeks: 0, maxWeeks: 0 };
    this.step = 0;
    this.status = 'ready';
    this.contact = { name: '', mobile: '' };
    if (this.root) this.renderAll();
  }

  private get t() {
    return this.cfg!.texts;
  }

  // ---------- rendering ----------
  private renderState() {
    const t = this.cfg?.texts;
    if (this.status === 'loading') {
      this.root.innerHTML = `<p class="state" role="status">${esc(t?.loading ?? 'در حال بارگذاری…')}</p>`;
    } else if (this.status === 'error') {
      this.root.innerHTML = `<p class="state error" role="alert">${esc(t?.loadError ?? 'بارگذاری محاسبه‌گر ممکن نشد.')}</p>`;
    }
  }

  private renderAll() {
    const t = this.t;
    this.root.setAttribute('aria-label', t.title);
    this.root.innerHTML = `
      <div class="head"><h2>${esc(t.title)}</h2><p>${esc(t.subtitle)}</p></div>
      <div class="progress">
        <div class="progress-meta"><span data-ref="stepLabel"></span><span data-ref="stepName"></span></div>
        <div class="bar" role="progressbar" aria-label="${esc(t.title)}" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      </div>
      <div class="layout">
        <div class="main"><div data-ref="body"></div><div class="nav" data-ref="nav"></div></div>
        <aside class="panel" aria-label="${esc(t.estimateLabel)}">
          <div class="lbl">${esc(t.estimateLabel)}</div>
          <div class="price" aria-hidden="true" data-ref="price"></div>
          <div class="lbl">${esc(t.timeLabel)}: <span class="time" aria-hidden="true" data-ref="time"></span></div>
          <p class="sr" role="status" aria-live="polite" data-ref="live"></p>
          <details class="sum"${this.offsetWidth >= 700 ? " open" : ""}><summary>${esc(t.summaryTitle)}</summary><ul data-ref="summary"></ul></details>
          <p class="disc">${esc(t.disclaimer)}</p>
        </aside>
      </div>`;
    this.renderStep(false);
    this.updatePanel(false);
  }

  private ref<T extends HTMLElement = HTMLElement>(name: string): T {
    return this.root.querySelector<T>(`[data-ref="${name}"]`)!;
  }

  private get key(): StepKey {
    return STEPS[this.step];
  }

  private renderStep(focus = true) {
    const cfg = this.cfg!;
    const t = this.t;
    const key = this.key;
    const st = t.steps[key];
    const body = this.ref('body');

    this.ref('stepLabel').textContent = t.stepOf.replace('{n}', toFa(this.step + 1)).replace('{total}', toFa(STEPS.length));
    this.ref('stepName').textContent = st.title;
    const pct = this.status === 'done' ? 100 : Math.round(((this.step + 1) / STEPS.length) * 100);
    const bar = this.root.querySelector<HTMLElement>('.bar')!;
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', `${toFa(pct)}٪`);
    bar.firstElementChild!.setAttribute('style', `width:${pct}%`);

    let html = `<h3 class="step-title" tabindex="-1">${esc(st.title)}</h3>${st.hint ? `<p class="step-hint">${esc(st.hint)}</p>` : ''}`;
    if (key === 'type') {
      html += `<fieldset><legend class="sr">${esc(st.title)}</legend><div class="cards">${cfg.projectTypes
        .map((p) => this.card('radio', 'type', p.id, p.icon, p.title, p.description, this.sel.typeId === p.id))
        .join('')}</div></fieldset>`;
    } else if (key === 'features') {
      const list = featuresFor(cfg, this.sel.typeId);
      html += `<fieldset><legend class="sr">${esc(st.title)}</legend><div class="cards">${list
        .map((f) =>
          this.card('checkbox', 'feature', f.id, f.icon, f.title, f.description, this.sel.featureIds.includes(f.id), `+${formatFa(f.price)} ${cfg.currencyUnit}`),
        )
        .join('')}</div></fieldset>`;
    } else if (key === 'scale') {
      const sc = findType(cfg, this.sel.typeId)!.scale;
      html += `<div class="scale"><label class="sr" for="units">${esc(sc.label)}</label>
        <div class="scale-row">
          <button type="button" class="step-btn" data-act="dec" aria-label="${esc(this.t.decrease)}">−</button>
          <div class="scale-value" aria-hidden="true"><span data-ref="units">${formatFa(this.sel.units, 0)}</span><small>${esc(sc.unit)}</small></div>
          <button type="button" class="step-btn" data-act="inc" aria-label="${esc(this.t.increase)}">+</button>
        </div>
        <input id="units" type="range" dir="rtl" min="${sc.min}" max="${sc.max}" step="${sc.step}" value="${this.sel.units}"
          aria-valuetext="${esc(`${formatFa(this.sel.units, 0)} ${sc.unit}`)}">
        </div>`;
    } else if (key === 'urgency') {
      html += `<fieldset><legend class="sr">${esc(st.title)}</legend><div class="cards list">${cfg.urgency
        .map((u) => this.card('radio', 'urgency', u.id, u.icon, u.title, u.description, this.sel.urgencyId === u.id))
        .join('')}</div></fieldset>`;
    } else {
      html += this.contactForm();
    }
    body.innerHTML = html;
    this.renderNav();
    if (focus) {
      body.querySelector<HTMLElement>('.step-title')?.focus({ preventScroll: true });
      this.scrollIntoViewIfNeeded();
    }
  }

  private card(kind: 'radio' | 'checkbox', name: string, id: string, ic?: string, title = '', desc = '', checked = false, price = '') {
    return `<label class="card"><input type="${kind}" name="${name}" value="${esc(id)}"${checked ? ' checked' : ''}>
      <span class="face">${icon(ic)}<span class="t">${esc(title)}</span>${desc ? `<span class="d">${esc(desc)}</span>` : ''}${price ? `<span class="p">${esc(price)}</span>` : ''}</span></label>`;
  }

  private contactForm() {
    const t = this.t;
    return `<form novalidate data-form>
      <div class="field"><label for="name">${esc(t.nameLabel)}</label>
        <input id="name" name="name" autocomplete="name" required value="${esc(this.contact.name)}" aria-describedby="name-err"><div class="err" id="name-err"></div></div>
      <div class="field"><label for="mobile">${esc(t.mobileLabel)}</label>
        <input id="mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" required value="${esc(this.contact.mobile)}" aria-describedby="mobile-hint mobile-err">
        <div class="hint" id="mobile-hint">${esc(t.mobileHint)}</div><div class="err" id="mobile-err"></div></div>
      <div data-ref="formMsg">${this.formError ? this.msgHtml(this.formError) : ''}</div>
      <button class="btn primary" type="submit"${this.submitting ? ' disabled' : ''}>${esc(this.submitting ? t.submitting : t.submit)}</button>
    </form>`;
  }

  private msgHtml(text: string) {
    return `<div class="form-msg" role="alert">${icon('alert')}<span>${esc(text)}</span></div>`;
  }

  private renderNav() {
    const t = this.t;
    const nav = this.ref('nav');
    if (this.status === 'done') {
      nav.innerHTML = '';
      return;
    }
    const last = this.step === STEPS.length - 1;
    const canNext = this.step !== 0 || this.sel.typeId !== null;
    nav.innerHTML =
      (this.step > 0 ? `<button type="button" class="btn" data-act="back">${esc(t.back)}</button>` : '') +
      (last ? '' : `<button type="button" class="btn primary grow" data-act="next"${canNext ? '' : ' disabled'}>${esc(t.next)}</button>`);
  }

  private scrollIntoViewIfNeeded() {
    const r = this.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.6) this.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }

  // ---------- price panel ----------
  private fmtRange(a: number, b: number) {
    if (!b) return '—';
    return a === b ? formatFa(a) : `${formatFa(a)} ${this.t.to} ${formatFa(b)}`;
  }

  private paint(e: Estimate) {
    const unit = this.cfg!.currencyUnit;
    this.ref('price').innerHTML = e.maxPrice ? `${esc(this.fmtRange(e.minPrice, e.maxPrice))} <small>${esc(unit)}</small>` : '—';
    this.ref('time').textContent = e.maxWeeks ? `${this.fmtRange(Math.round(e.minWeeks), Math.round(e.maxWeeks))} ${this.t.weeks}` : '—';
  }

  private updatePanel(animate = true) {
    const cfg = this.cfg!;
    const target = calculate(cfg, this.sel);
    cancelAnimationFrame(this.raf);

    const from = this.shown;
    const done = () => {
      this.shown = target;
      this.paint(target);
    };
    if (!animate || reduced()) done();
    else {
      const t0 = performance.now();
      const dur = 550;
      const tick = (now: number) => {
        const k = clamp((now - t0) / dur, 0, 1);
        const ease = 1 - Math.pow(1 - k, 3);
        if (k >= 1) return done();
        const mix = (a: number, b: number) => a + (b - a) * ease;
        this.paint({
          minPrice: mix(from.minPrice, target.minPrice),
          maxPrice: mix(from.maxPrice, target.maxPrice),
          minWeeks: mix(from.minWeeks, target.minWeeks),
          maxWeeks: mix(from.maxWeeks, target.maxWeeks),
        });
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    this.renderSummary();

    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      const live = this.root.querySelector('[data-ref="live"]');
      if (!live) return;
      live.textContent = target.maxPrice
        ? `${this.t.estimateLabel}: ${this.fmtRange(target.minPrice, target.maxPrice)} ${cfg.currencyUnit}، ${this.t.timeLabel}: ${this.fmtRange(target.minWeeks, target.maxWeeks)} ${this.t.weeks}`
        : '';
    }, 500);
  }

  private renderSummary() {
    const cfg = this.cfg!;
    const type = findType(cfg, this.sel.typeId);
    const rows: [string, string][] = [];
    if (type) {
      rows.push([this.t.steps.type.title, type.title]);
      const feats = activeFeatures(cfg, this.sel).map((f) => f.title);
      rows.push([this.t.steps.features.title, feats.length ? feats.join('، ') : this.t.nothingSelected]);
      if (this.sel.units) rows.push([type.scale.label, `${formatFa(this.sel.units, 0)} ${type.scale.unit}`]);
      const u = cfg.urgency.find((x) => x.id === this.sel.urgencyId);
      if (u) rows.push([this.t.steps.urgency.title, u.title]);
    }
    this.ref('summary').innerHTML = rows.length
      ? rows.map(([k, v]) => `<li><b>${esc(k)}:</b><span>${esc(v)}</span></li>`).join('')
      : `<li>${esc(this.t.summaryEmpty)}</li>`;
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private changed() {
    this.updatePanel();
    this.emit('estimate-change', { selection: { ...this.sel }, estimate: calculate(this.cfg!, this.sel) });
  }

  // ---------- events ----------
  private onChange(e: Event) {
    const el = e.target as HTMLInputElement;
    if (!this.cfg || this.status !== 'ready') return;
    if (el.name === 'type') {
      if (this.sel.typeId !== el.value) {
        this.sel.typeId = el.value;
        const sc = findType(this.cfg, el.value)!.scale;
        this.sel.units = sc.default;
        const allowed = featuresFor(this.cfg, el.value).map((f) => f.id);
        this.sel.featureIds = this.sel.featureIds.filter((id) => allowed.includes(id));
      }
      this.renderNav();
      this.changed();
    } else if (el.name === 'feature') {
      const ids = new Set(this.sel.featureIds);
      el.checked ? ids.add(el.value) : ids.delete(el.value);
      this.sel.featureIds = [...ids];
      this.changed();
    } else if (el.name === 'urgency') {
      this.sel.urgencyId = el.value;
      this.changed();
    }
  }

  private setUnits(v: number) {
    const sc = findType(this.cfg!, this.sel.typeId)!.scale;
    this.sel.units = clamp(v, sc.min, sc.max);
    const range = this.root.querySelector<HTMLInputElement>('#units')!;
    range.value = String(this.sel.units);
    range.setAttribute('aria-valuetext', `${formatFa(this.sel.units, 0)} ${sc.unit}`);
    this.ref('units').textContent = formatFa(this.sel.units, 0);
    this.changed();
  }

  private onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.id === 'units') this.setUnits(Number(el.value));
  }

  private onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn || !this.cfg) return;
    const act = btn.dataset.act;
    if (act === 'next' && this.step < STEPS.length - 1) this.go(this.step + 1);
    else if (act === 'back' && this.step > 0) this.go(this.step - 1);
    else if (act === 'inc' || act === 'dec') {
      const sc = findType(this.cfg, this.sel.typeId)!.scale;
      this.setUnits(this.sel.units + (act === 'inc' ? sc.step : -sc.step));
    } else if (act === 'restart') {
      this.useConfig(this.cfg);
    }
  }

  private go(n: number) {
    this.step = n;
    this.formError = '';
    this.renderStep();
  }

  private async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.cfg || this.submitting) return;
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const rawMobile = (form.elements.namedItem('mobile') as HTMLInputElement).value;
    this.contact = { name, mobile: rawMobile };
    const mobile = normalizeMobile(rawMobile);

    const setErr = (id: string, msg: string, input: string) => {
      form.querySelector(`#${id}`)!.textContent = msg;
      form.querySelector(input)!.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    setErr('name-err', name.length < 2 ? this.t.nameError : '', '#name');
    setErr('mobile-err', mobile ? '' : this.t.mobileError, '#mobile');
    if (name.length < 2) return form.querySelector<HTMLElement>('#name')!.focus();
    if (!mobile) return form.querySelector<HTMLElement>('#mobile')!.focus();

    const cfg = this.cfg;
    const estimate = calculate(cfg, this.sel);
    const payload = {
      name,
      mobile,
      selection: {
        type: this.sel.typeId,
        features: activeFeatures(cfg, this.sel).map((f) => f.id),
        units: this.sel.units,
        urgency: this.sel.urgencyId,
      },
      estimate,
    };

    this.submitting = true;
    this.formError = '';
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
    submitBtn.disabled = true;
    submitBtn.textContent = this.t.submitting;
    form.querySelector('[data-ref="formMsg"]')!.innerHTML = '';
    try {
      const res = await fetch(cfg.submit.url, {
        method: cfg.submit.method ?? 'POST',
        headers: { 'Content-Type': 'application/json', ...cfg.submit.headers },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.submitting = false;
      this.status = 'done';
      this.renderDone();
      this.emit('estimate-submit', payload);
    } catch (err) {
      console.warn('[cost-estimator] submit failed:', err);
      this.submitting = false;
      this.formError = this.t.submitError;
      submitBtn.disabled = false;
      submitBtn.textContent = this.t.submit;
      form.querySelector('[data-ref="formMsg"]')!.innerHTML = this.msgHtml(this.formError);
    }
  }

  private renderDone() {
    const t = this.t;
    this.ref('body').innerHTML = `<div class="done"><div class="badge">${icon('check')}</div>
      <h3 class="step-title" tabindex="-1">${esc(t.successTitle)}</h3><p role="status">${esc(t.successBody)}</p>
      <button type="button" class="btn" data-act="restart">${esc(t.restart)}</button></div>`;
    this.ref('nav').innerHTML = '';
    const bar = this.root.querySelector<HTMLElement>('.bar')!;
    bar.setAttribute('aria-valuenow', '100');
    bar.firstElementChild!.setAttribute('style', 'width:100%');
    this.ref('body').querySelector<HTMLElement>('.step-title')!.focus({ preventScroll: true });
  }
}
