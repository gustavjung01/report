# Bếp Sỉ Báo Cáo PWA

PWA mobile-first cho sales/thị trường dùng để tạo và quản lý 3 nghiệp vụ riêng:

1. Đơn hàng
2. Test sản phẩm
3. Báo cáo thị trường

AI là tầng tổng hợp dữ liệu đã tạo để làm báo cáo trình công ty. App không phải bản mock UI: dữ liệu được lưu thật vào local database trên máy và đồng bộ lên Supabase khi có mạng.

## Nguyên tắc dữ liệu

- **Local DB bắt buộc:** app dùng IndexedDB (`bep-si-report-local-db`), không dùng `localStorage` làm nơi lưu nghiệp vụ chính.
- **Offline-first:** sales có thể nhập đơn/test/báo cáo khi mất mạng.
- **Sync queue:** mỗi bản ghi mới được đưa vào hàng đợi đồng bộ.
- **Supabase là kho trung tâm:** khi có mạng và đã cấu hình URL/key, app tự đẩy queue lên Supabase và kéo dữ liệu mới về máy.
- **Không trộn nghiệp vụ:** đơn hàng, phiếu test và báo cáo thị trường nằm ở các bảng riêng.
- **AI tổng hợp:** đọc dữ liệu thật từ Local DB/Supabase, không còn số liệu mẫu cứng.

## Bảng dữ liệu Supabase

App đang dùng các bảng sau:

- `products`
- `customers_master`
- `orders`
- `order_items`
- `ona_tests`
- `ona_test_items`
- `market_reports`
- `market_report_products`
- `market_report_competitors`
- `ai_summaries`
- `exports`

## Luồng sử dụng ngoài thị trường

1. Mở app trên điện thoại.
2. Vào **Tạo**.
3. Chọn đúng nghiệp vụ: **Đơn hàng**, **Test sản phẩm**, hoặc **Báo cáo thị trường**.
4. Bấm lưu. Dữ liệu được ghi vào IndexedDB ngay lập tức.
5. Nếu có mạng và đã nối Supabase, app tự đồng bộ.
6. Vào **Dữ liệu** để xem trạng thái từng card: `Chờ sync`, `Đã đồng bộ`, hoặc `Lỗi sync`.
7. Vào **AI** để tổng hợp báo cáo từ dữ liệu thật đã tạo.

## Cấu hình Supabase

Trong app vào **Admin → Supabase**:

1. Dán Project URL, ví dụ `https://xxxxx.supabase.co`.
2. Dán publishable/anon key.
3. Chỉ dùng public key phù hợp cho frontend PWA; không đưa private/server key vào app.
4. Bấm **Lưu DB**.
5. Bấm **Đồng bộ lại** trong **Dữ liệu máy** nếu cần đẩy lại queue.

## Deploy Vercel

App là static PWA thuần, không cần build:

- Framework Preset: `Other`
- Root Directory: `./`
- Build Command: để trống
- Output Directory: để trống
- Install Command: để trống

## Quy trình 2 repo

Repo nguồn: `gustavjung01/report`.

Repo deploy Vercel: `minhmannguyengdp-sketch/report-02`.

Sau khi sửa repo nguồn, ở local chạy lệnh fetch/reset từ origin main rồi push sang remote deploy bằng force-with-lease.
