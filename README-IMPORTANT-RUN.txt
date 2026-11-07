التشغيل بعد فصل المشروع:

1) أغلق السيرفر القديم باستخدام Ctrl+C.
2) استخدم Node.js إصدار 22 أو أحدث.
3) افتح Terminal في المجلد الرئيسي وشغل:
   npm run setup
   npm run dev
4) افتح الموقع: http://localhost:3000
   تسجيل الدخول: http://localhost:3000/login.html
   API: http://localhost:4000/api/health

npm start من الجذر يشغل الباك إند فقط؛ لن يعرض صفحات الموقع.
الإعدادات الخاصة: backend/.env
عنوان API العام للواجهة: frontend/assets/js/config.js
البيانات الحالية: backend/data وbackend/uploads

حافظ على SESSION_SECRET القديم عند استخدام قاعدة البيانات الحالية.
لا تغير السر أو تحذف قاعدة البيانات لمحاولة إصلاح تسجيل الدخول.
لا تنشر مجلد backend أو قاعدة البيانات على استضافة ملفات عامة.

راجع README-AR.md للتشغيل والنشر، وdocs/PROJECT-ANALYSIS.md
للملاحظات الأمنية المتبقية قبل الإنتاج.
