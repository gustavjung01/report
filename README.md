# Tea Survey Report PWA

Web app PWA để sales ghi nhận khảo sát thị trường ngành trà sữa, đặc biệt cho các buổi test trà ONA. App chạy mobile-first, lưu offline trên máy và có thể đồng bộ báo cáo tiếng Việt lên Google Sheet thông qua Google Apps Script.

## Chức năng chính

- Tạo báo cáo theo ngày và thị trường/khu vực.
- Trong từng báo cáo, thêm từng khách hàng cụ thể.
- Mỗi khách có khu vực, loại sản phẩm test, hẹn báo lại, ghi chú tổng.
- Thanh lọc test riêng cho từng sản phẩm:
  - Trà Đen
  - Trà Quả Mộng
  - Trà Gạo Rang
  - Trà Lài
  - Trà Olong
  - Trà Olong Sen
- Trạng thái nhanh: Chưa thử, OK, Quan tâm, Cần mẫu, Báo Tân, Chưa tốt, Thử lại.
- Test chung thị trường: Giá tốt, ngọt, lạt, béo, thơm, đậm, nhạt, đang bán hãng khác, cần mẫu lớn, chủ đi vắng, báo sau cho A Tân.
- Sửa hoặc xóa khách trong báo cáo.
- Lọc khách theo sản phẩm, trạng thái hoặc từ khóa.
- Copy báo cáo để gửi Zalo/Telegram/Gmail.
- Xuất CSV tiếng Việt để mở bằng Excel.
- Đồng bộ lên Google Sheet bằng Apps Script Web App.
- Có manifest và service worker để chạy như PWA, hỗ trợ offline sau lần mở đầu tiên.

## Cách dùng nhanh

1. Deploy app lên Vercel hoặc GitHub Pages.
2. Mở app trên điện thoại và cài ra màn hình chính nếu trình duyệt gợi ý.
3. Tạo báo cáo mới theo ngày và thị trường.
4. Thêm từng khách hàng, chọn trạng thái cho từng loại trà.
5. Dùng **Gửi test** để kiểm tra Google Sheet trước.
6. Dùng **Đẩy Sheet** để gửi báo cáo thật lên Google Sheet.
7. Dùng **Copy** hoặc **CSV** khi cần gửi/tải báo cáo thủ công.

## Logo Bépi

App tự tìm logo theo các tên phổ biến. Cách chắc nhất là đặt logo vào repo theo đường dẫn:

```text
icons/bepi-logo.png
```

Các tên khác cũng được thử tự động: `icons/logo.png`, `icons/bepi.png`, `logo.png`, `bepi-logo.png`, `assets/logo.png`.

## Kết nối Google Sheet

App không dùng trực tiếp Google Sheets API để tránh lộ token/API key ở frontend. Cách an toàn và đơn giản hơn là dùng Google Apps Script làm cổng nhận dữ liệu.

### Tạo Sheet receiver

1. Tạo Google Sheet mới.
2. Vào **Tiện ích mở rộng / Extensions → Apps Script**.
3. Xóa code mặc định.
4. Copy toàn bộ nội dung file `google-apps-script.gs` trong repo này và dán vào Apps Script.
5. Bấm Save.
6. Vào **Deploy → New deployment → Web app**.
7. Chọn:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Deploy và copy link Web App dạng `https://script.google.com/macros/s/.../exec`.
9. Mở PWA, dán link vào mục **Google Sheet**, bấm **Lưu link**.
10. Bấm **Gửi test** trước. Nếu Sheet xuất hiện dòng `TEST KẾT NỐI SHEET`, kết nối đã đúng.
11. Mở báo cáo và bấm **Đẩy Sheet**.

Apps Script sẽ tự tạo 2 sheet:

- `Báo cáo`
- `Chi tiết khách hàng`

Các cột đều dùng tiếng Việt.

### Nếu bấm Đẩy Sheet nhưng Sheet không đổi

- Kiểm tra link phải kết thúc bằng `/exec`, không dùng link `/dev`.
- Trong Apps Script phải chọn **Execute as: Me** và **Who has access: Anyone**.
- Nếu vừa sửa code Apps Script, phải vào **Deploy → Manage deployments → Edit → New version → Deploy**. Chỉ bấm Save là chưa cập nhật Web App đang chạy.
- Bấm **Gửi test** trong PWA để kiểm tra trước khi gửi báo cáo thật.

## Deploy Vercel

Vercel project có thể chọn:

- Framework Preset: `Other`
- Root Directory: `./`
- Build Command: để trống
- Output Directory: để trống
- Install Command: để trống

App là static PWA thuần `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js` nên không cần build.

## Quy trình 2 repo

Repo nguồn để sửa/pull:

```powershell
origin = https://github.com/gustavjung01/report.git
```

Repo deploy Vercel:

```powershell
deploy = https://github.com/minhmannguyengdp-sketch/report-02.git
```

Sau khi sửa repo nguồn, ở local chạy:

```powershell
cd "F:\1_A_Disk_D\Tool\report"
git pull origin main
git push deploy main
```

Nếu repo deploy cần ghi đè lần đầu:

```powershell
git push deploy main --force-with-lease
```

## Ghi chú kỹ thuật

Dữ liệu vẫn được lưu bằng `localStorage` trên trình duyệt của máy đang dùng. Khi mạng yếu, sales vẫn nhập báo cáo được. Khi có mạng, bấm **Đẩy Sheet** để đồng bộ. Frontend gửi qua Apps Script bằng form submit ẩn để tránh lỗi CORS thường gặp trên PWA.
