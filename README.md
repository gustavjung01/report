# Bếp Sỉ Báo Cáo PWA

Trạng thái hiện tại: **làm lại chuẩn từ module Test trước**.

## Nguyên tắc mới

- Không phát triển kiểu landing page.
- Mỗi nghiệp vụ phải là một module/trang rõ ràng.
- Tạo dữ liệu bằng popup gọn.
- Sau khi tạo xong, thao tác chi tiết nằm ở trang Dữ liệu.
- Local DB chỉ là cache/hàng đợi offline.
- Supabase là nguồn đồng bộ trung tâm khi đã cấu hình Vercel env.

## Module đang ưu tiên: Test sản phẩm

Luồng Test chuẩn:

1. Tạo file test tổng.
2. Nhập thủ công sản phẩm cần test.
3. Không lấy danh sách sản phẩm Bếp Sỉ.
4. Sang Dữ liệu test.
5. Mở file test, bấm Thao tác.
6. Thêm khách vào file test.
7. Mỗi khách chỉ test các sản phẩm đã chọn trong file tổng.

## File runtime hiện tại

- `index.html`: shell mobile.
- `test-first-app.js`: runtime Test-first hiện đang chạy.
- `local-db.js`: IndexedDB hiện tại.
- `supabase-v2.js`: kết nối Supabase.
- `api/config.js`: đọc env từ Vercel.
- `api/ai-report.js`: endpoint AI thật.
- `sw.js`: service worker cache runtime Test-first.

## Cấu trúc mục tiêu

```text
src/
  app.js
  db.js
  supabase.js
  styles.css
  modules/
    test/
      test.module.js
      test.store.js
      test.ui.js
    orders/
    market/
    ai/
api/
icons/
index.html
manifest.webmanifest
sw.js
```

## Việc cần dọn tiếp

Một số file root cũ còn tồn tại vì connector GitHub chặn thao tác xóa trong phiên này. Các file đó không được `index.html` hoặc `sw.js` gọi nữa. Khi thao tác local, nên xóa sạch các file legacy không còn dùng.

Các file legacy cần bỏ khi dọn local:

- `core-app.js`
- `core-test-app.js`
- `app-shell-v2.css` nếu còn
- `flow-stability.js` nếu còn
- `runtime-fix.js` nếu còn
- `ai-bridge.js` nếu còn
- các CSS/module cũ còn sót từ phase trước

## Deploy

```powershell
cd "F:\1_A_Disk_D\Tool\report"
git fetch origin main
git reset --hard origin/main
git push deploy main --force-with-lease
```
