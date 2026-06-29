# UI Ownership Audit — Bếp Sỉ Báo Cáo

Giai đoạn 1 chỉ audit và ghi contract UI. Không đổi logic nghiệp vụ, IndexedDB, Supabase sync, schema, id record, custom event hoặc flow Test.

## Mục tiêu

- Mỗi page/modal có UI owner rõ ràng.
- Fix UI bằng selector scoped, không sửa logic để chữa giao diện.
- Tránh selector global làm lan lỗi giữa MCP / Đơn / Test / Báo cáo / Data / Admin.
- App mobile-first, thao tác nhanh ngoài thị trường.

## Quy tắc selector bắt buộc

Page UI phải scope theo:

```css
section.page[data-page="mcp"] ...
section.page[data-page="order-shell"] ...
section.page[data-page="report-shell"] ...
section.page[data-page="data"] ...
section.page[data-page="admin"] ...
```

Modal UI phải scope theo:

```css
#modal[data-type="..."] ...
```

Không thêm selector UI mới dạng global nếu không có lý do rất rõ:

```css
.card {}
.record {}
.modal {}
.grid {}
.line {}
label {}
input {}
textarea {}
.shell-card {}
.shell-actions {}
```

Nếu cần dùng class shared, phải bọc bởi page/modal owner trước.

## File ownership hiện tại

### App shell / shared bootstrap

- `index.html`
  - Khung app, header, bottom nav, các section page gốc, `#modal`, `#toast`.
  - Không đổi id quan trọng: `#syncState`, `#syncBtn`, `#dbInfo`, `#adminStats` nếu chưa audit sync.
- `src/ui-polish.js`
  - Bootstrap import hiện tại cho nhiều module UI/action.
  - Rủi ro: đang gom quá nhiều file; chỉ nên chỉnh import theo block hoặc thêm UI owner mới.
- `src/polish.css`
  - Shared CSS và nhiều rule shell/module cũ.
  - Rủi ro: `.shell-card`, `.shell-actions`, `.modal`, `.grid` nếu sửa không scope sẽ lan nhiều màn.

### MCP / tuyến thị trường

Owner page/card/action:

- `src/mcp-ui-shell.js`
- `src/mcp-card-compact-ui.js`
- `src/mcp-customer-manage-style.js`
- `src/mcp-manage-actions-compact-ui.js`
- `src/mcp-import-ui.js`

Owner modal/action UI liên quan MCP:

- `src/mcp-order-actions.js` — có nghiệp vụ/action tạo đơn từ MCP, tránh sửa nếu chỉ là CSS.
- `src/mcp-order-modal-ui.js` — UI modal tạo đơn từ MCP.
- `src/mcp-report-actions.js` — action/report từ MCP, tránh sửa logic nếu chỉ UI.
- `src/mcp-test-actions.js` — action/test từ MCP, tránh sửa logic Test.

Scope bắt buộc:

```css
section.page[data-page="mcp"] ...
#modal[data-type="mcp-order"] ...
#modal[data-type="mcp-customer"] ...
#modal[data-type="mcp-start"] ...
```

Custom event cần giữ:

- `mcp:session-changed`

### Đơn hàng

Owner page/list/card:

- `src/order-ui.js` — render page/list/modal logic đơn; tránh sửa logic khi chỉ UI.
- `src/order-card-compact-ui.js` — UI card/list đơn hàng.

Owner modal:

- `src/order-create-compact-ui.js`
- `src/order-modal-lock-ui.js`
- `src/modal-form-ui.js` còn có fallback cho `order-create/order-detail`; không mở rộng thêm nếu có thể tách owner riêng.

Scope bắt buộc:

```css
section.page[data-page="order-shell"] ...
#modal[data-type="order-create"] ...
#modal[data-type="order-detail"] ...
```

Custom event cần giữ:

- `order:changed`

### Test sản phẩm

Owner hiện tại:

- `test-first-app.js`
- `src/test-pull.js`
- `src/compact-detail.js`
- `src/test-export.js`
- `src/test-file-modal-ui.js`

Hạn chế:

- Test đang hoạt động, không refactor trong giai đoạn UI ownership trừ khi lỗi hiển thị cụ thể.
- Không đổi selector/action Test nếu chưa audit đầy đủ.

### Báo cáo thị trường

Owner page/list/card/modal:

- `src/report-ui.js` — render page, list, detail, repeat, save local; tránh sửa logic nếu chỉ UI.
- `src/report-modal-ui.js` — UI modal tạo/chi tiết báo cáo.

Scope bắt buộc:

```css
section.page[data-page="report-shell"] ...
#modal[data-type="report-create"] ...
#modal[data-type="report-detail"] ...
```

Custom event cần giữ:

- `report:changed`

### Data / Admin / AI

Owner:

- `src/data-hub-shell.js`
- `src/data-hub-force.js` nếu còn dùng trong build hiện tại.
- `src/business-ui-shells.js`
- `src/ai-agent-settings.js`

Sync/admin lưu ý:

- Không đổi `#syncBtn`, `#syncState`, `#dbInfo`, `#adminStats` khi chưa test sync.
- Không sửa `src/supabase-sync.js` trong refactor UI.

## Risk map

### Rủi ro cao

- Sửa `polish.css` bằng selector không scope.
- Sửa `modal-form-ui.js` rồi ảnh hưởng nhiều modal.
- Sửa `ui-polish.js` và đổi thứ tự import khiến CSS override khác đi.
- Đụng Test files để fix UI chung.
- Đổi `data-page`, `data-type`, `data-*` action.

### Rủi ro vừa

- Tách CSS `.shell-card` vì đang dùng chung ở Đơn/Báo cáo.
- Tách modal create form vì `order-create`, `report-create`, `mcp-order` có layout gần giống nhưng data khác.

### Rủi ro thấp

- Thêm file UI-only scoped theo đúng page/modal.
- Bump cache version trong `index.html`.
- Thêm docs/comment ownership.

## Checklist bắt buộc sau mỗi commit UI

Test bằng URL cache bust:

```txt
https://report-nietz.vercel.app/?app_v=<tag>
```

Nếu PWA cache cũ: Admin → Update.

Flow cần kiểm tra:

1. Mobile width 390px hoặc nhỏ hơn.
2. Home mở đúng, bottom nav không mất.
3. MCP mở tuyến, list khách, action chính còn bấm được.
4. Đơn hàng mở page, card không phồng, `+ Đơn` mở modal, lưu/xem/tạo lại còn hoạt động.
5. Test mở được, không vỡ detail/export.
6. Báo cáo mở page, `+ Báo cáo`, lưu, chi tiết, tạo lại còn hoạt động.
7. Admin còn `#syncBtn`; trạng thái `#syncState` hiển thị.
8. Đồng bộ business data không mất nút/trạng thái.

## Kế hoạch refactor tiếp theo

### Giai đoạn 2 — Group import không đổi behavior

- Chỉ sắp xếp comment trong `src/ui-polish.js` theo block:
  - Core UI
  - MCP
  - Orders
  - Reports
  - Data/Admin/AI
  - Sync
- Không đổi thứ tự import nếu chưa có lý do.

### Giai đoạn 3 — Order UI owner

- Gom CSS page/card/modal Order về owner scoped.
- Không sửa `order-ui.js` trừ khi chỉ thêm class/data attribute phục vụ UI và không đổi save/render logic.

### Giai đoạn 4 — Report UI owner

- Gom page/card/modal Report về owner scoped.
- Không sửa `makeMarketReport`, store `marketReports`, event `report:changed`.

### Giai đoạn 5 — MCP UI owner

- Gom MCP card/action/modal về owner scoped.
- Không sửa core session/status/check-in/order/test/report logic.

### Giai đoạn 6 — Cleanup shared CSS

- Chỉ xóa rule global sau khi owner scoped đã thay thế và test đủ.
- Commit cleanup riêng, dễ rollback.

## Câu nhắc ngắn cho các chat sau

UI fix phải scope theo `section.page[data-page="..."]` hoặc `#modal[data-type="..."]`. Không dùng selector global để chữa lỗi. Không sửa logic/DB/sync/Test khi chỉ là lỗi giao diện. Module mới phải có UI ownership riêng và bump cache version.
