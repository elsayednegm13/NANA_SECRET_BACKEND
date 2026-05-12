# NANA SECRET - النسخة الحقيقية Backend + Database

هذه نسخة جاهزة من موقع NANA SECRET مع Backend حقيقي بدل `localStorage`.

## ماذا تم تنفيذه؟

- تشغيل الموقع من Node.js بدل فتح ملفات HTML مباشرة.
- Database حقيقية SQLite داخل `data/nana-secret.sqlite`.
- API للأخبار:
  - `GET /api/news`
  - `POST /api/news`
  - `PUT /api/news/:id`
  - `DELETE /api/news/:id`
- API للمنتجات:
  - `GET /api/products`
  - `POST /api/products`
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
- تسجيل دخول للوحة التحكم من السيرفر.
- الأخبار والمنتجات تظهر لكل الزوار من نفس قاعدة البيانات.
- إضافة/تعديل/حذف الأخبار من `admin.html`.
- إضافة/تعديل/حذف المنتجات من `admin.html`.
- رفع صورة من الجهاز مدعوم حاليًا بصيغة Base64 داخل الداتابيز.

## التشغيل المحلي

افتح Terminal داخل الفولدر ثم نفذ:

```bash
npm install
cp .env.example .env
npm start
```

ثم افتح:

```text
http://localhost:4000
```

لو أنت على Windows ومفيش أمر `cp`، اعمل نسخة يدويًا من `.env.example` وسمّيها `.env`.

## بيانات لوحة التحكم

```text
Username: ADMIN
Password: 123
```

يمكن تغييرهم من ملف `.env`:

```env
ADMIN_USER=ADMIN
ADMIN_PASS=123
SESSION_SECRET=change-this-secret-before-publishing
```

## مهم جدًا

لا تفتح `index.html` مباشرة من الجهاز، لأن النسخة الجديدة تعتمد على السيرفر والـ API.
لازم تشغل:

```bash
npm start
```

وتفتح الموقع من الرابط:

```text
http://localhost:4000
```

## النشر على الإنترنت

يمكن رفع المشروع على Render أو VPS أو أي استضافة Node.js.
بعد النشر، أي خبر أو منتج تضيفه من لوحة التحكم سيظهر لكل الزوار.

## ملاحظات

- تم إنشاء صور Placeholder لأن الملفات الأصلية للصور لم تكن ضمن الملفات المرسلة بشكل كامل.
- عند وضع صور الموقع الأصلية داخل `assets/images` بنفس الأسماء، ستظهر تلقائيًا بدل الصور المؤقتة.

## تحديث ظهور الأخبار
تم تعديل الأخبار المضافة لتظهر مباشرة بدون انتظار تأثيرات الحركة، حتى تظهر فورًا في صفحة الأخبار والرئيسية بعد إضافتها من لوحة التحكم.
