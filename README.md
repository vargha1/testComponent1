# `<cost-estimator>`

محاسبه‌گر تعاملی هزینه و زمان پروژه؛ یک Custom Element بدون وابستگی به فریم‌ورک (TypeScript، Shadow DOM، RTL).
باندل نهایی حدود **۸ کیلوبایت gzip** است (سقف: ۳۰ کیلوبایت).

مراحل: نوع پروژه ← امکانات ← تعداد صفحه/نقش کاربر ← فوریت ← فرم تماس (نام + موبایل) و ارسال به سرور.

**دموی آنلاین:** `<DEMO_URL>` (GitHub Pages، پوشه‌ی `docs/`)

## جاسازی در ASP.NET Core / Razor

۱. فایل‌های `cost-estimator.js` و `estimator.json` را در `wwwroot` بگذارید.

```cshtml
<cost-estimator config-url="/estimator.json"></cost-estimator>
<script src="~/cost-estimator.js" asp-append-version="true"></script>
```

- اسکریپت یک IIFE است؛ `type="module"` لازم نیست و ترتیب قرار گرفتن تگ و اسکریپت مهم نیست.
- آدرس ارسال (`submit.url`) را می‌توانید به یک اکشن کنترلر اشاره دهید. اگر از Antiforgery استفاده می‌کنید توکن را در `submit.headers` بگذارید (یا اکشن را `[IgnoreAntiforgeryToken]` کنید).

نمونه‌ی اکشن دریافت:

```csharp
public record LeadDto(string Name, string Mobile, JsonElement Selection, JsonElement Estimate);

[HttpPost("/api/estimate-lead")]
public IActionResult Lead([FromBody] LeadDto dto) => Ok();   // هر کد 2xx = موفق
```

بدنه‌ی POST (JSON) — موبایل همیشه به ارقام لاتین و قالب `09xxxxxxxxx` نرمال می‌شود:

```json
{
  "name": "علی رضایی",
  "mobile": "09123456789",
  "selection": { "type": "shop", "features": ["payment", "seo"], "units": 12, "urgency": "urgent" },
  "estimate": { "minPrice": 105.5, "maxPrice": 147, "minWeeks": 7, "maxWeeks": 9 }
}
```

هر پاسخ غیر ۲xx یا خطای شبکه ← پیام `texts.submitError` نمایش داده می‌شود.

## attributeها، property و رویدادها

| مورد | توضیح |
|---|---|
| `config-url` | آدرس JSON پیکربندی |
| `theme` | `light` / `dark`؛ بدون مقدار = تبعیت از `prefers-color-scheme` |
| `el.config = {...}` | دادن config به‌صورت آبجکت به‌جای URL |
| رویداد `estimate-change` | با هر تغییر؛ `detail = { selection, estimate }` |
| رویداد `estimate-submit` | بعد از ارسال موفق؛ `detail` = همان payload |

## تم (CSS Variables)

متغیرها را روی خود المان یا هر والدی تنظیم کنید:

```css
cost-estimator {
  --ce-primary: #0b7285;     --ce-on-primary: #fff;
  --ce-bg: #fff;             --ce-surface: #f4f6f8;
  --ce-text: #1a1a1a;        --ce-muted: #5f6b76;
  --ce-border: #d5dbe1;      --ce-radius: 12px;
  --ce-danger: #c62828;      --ce-success: #1b8a4b;
  --ce-font: "Vazirmatn", Tahoma, sans-serif;
}
```

حالت تیره به‌صورت پیش‌فرض با `prefers-color-scheme` فعال می‌شود؛ اگر سایت شما کلاس/attribute تم دارد، `theme="dark"` را از روی آن تنظیم کنید.

## ساختار JSON

همه‌ی قیمت‌ها، ضرایب و متن‌ها از همین فایل می‌آیند. قیمت‌ها به واحد `currencyUnit` (در نمونه: میلیون تومان) هستند. نمونه‌ی کامل: [`docs/estimator.json`](docs/estimator.json).

```jsonc
{
  "currencyUnit": "میلیون تومان",
  "defaultUrgency": "normal",           // اختیاری
  "range": { "low": 0.9, "high": 1.25 }, // ضریب کف و سقف بازه
  "roundTo": 0.5,                        // گرد کردن قیمت
  "submit": { "url": "/api/estimate-lead", "method": "POST", "headers": {} },
  "texts": { "title": "…", "steps": { "type": { "title": "…", "hint": "…" } /* … */ } },
  "projectTypes": [{
    "id": "shop", "title": "فروشگاه اینترنتی", "description": "…", "icon": "cart",
    "basePrice": 70, "baseWeeks": 8,
    "scale": { "label": "تعداد صفحه", "unit": "صفحه", "min": 5, "max": 60, "step": 1,
               "default": 10, "included": 8, "pricePerUnit": 1.5, "weeksPerUnit": 0.2 }
  }],
  "features": [{
    "id": "payment", "title": "درگاه پرداخت", "icon": "card", "price": 6, "weeks": 0.5,
    "types": ["corporate", "shop", "mobile"]   // اختیاری؛ بدون آن برای همه‌ی انواع
  }],
  "urgency": [{ "id": "urgent", "title": "فوری", "icon": "bolt", "priceMultiplier": 1.35, "timeMultiplier": 0.7 }]
}
```

آیکون‌های موجود: `globe cart phone building card user chart search chat bell shield edit link lang mail bolt clock calendar gear image box`.

### فرمول محاسبه

```
subtotal = basePrice + Σ price(امکانات انتخاب‌شده) + max(0, units − included) × pricePerUnit
قیمت     = subtotal × priceMultiplier(فوریت)   →  بازه: [قیمت × low ، قیمت × high] گردشده با roundTo
زمان     = (baseWeeks + Σ weeks + extraUnits × weeksPerUnit) × timeMultiplier  →  ceil(× low) تا ceil(× high)
```

تابع خالص در [`src/calc.ts`](src/calc.ts) است (`calculate(config, selection)`).

## توسعه

```bash
npm install
npm test            # تست واحد (vitest): محاسبه‌ی قیمت + ارقام فارسی/اعتبارسنجی موبایل
npm run typecheck
npm run build       # dist/cost-estimator.js (+ کپی در docs/) و بررسی سقف ۳۰KB gzip
npm run serve       # http://localhost:5173 (PORT=... برای تغییر پورت) — سرو پوشه‌ی docs
```

## دسترس‌پذیری

- انتخاب‌ها `radio`/`checkbox` واقعی‌اند؛ کامل با کیبورد (Tab، فلش‌ها، Space) و با حلقه‌ی فوکوس واضح.
- با تغییر مرحله، فوکوس به عنوان مرحله می‌رود؛ نوار پیشرفت `role="progressbar"` دارد.
- تغییر قیمت به‌صورت `aria-live` (با تأخیر کوتاه) اعلام می‌شود؛ شمارنده‌ی انیمیشنی برای صفحه‌خوان مخفی است.
- خطاهای فرم با `aria-invalid` و `role="alert"`.
- با `prefers-reduced-motion: reduce` انیمیشن شمارنده، نوار و جابه‌جایی‌ها خاموش می‌شود.
