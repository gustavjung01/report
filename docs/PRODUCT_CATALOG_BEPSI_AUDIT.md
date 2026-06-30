# Product catalog chuẩn từ Bếp Sỉ

Nguồn: `gustavjung01/F-B-Order`, file `data/catalog/hung-phat/v2/products.csv`.

## Mục tiêu

- Không nhập sản phẩm tự do trong Đơn nếu có catalog.
- Dùng SKU gốc `BGKQ-xxxx` để đối chiếu nguồn.
- Sinh ID nội bộ theo hướng `ngành-nhóm-brand-vị-size-sku` để giảm nhầm sản phẩm.
- Siro nhiều vị cùng giá: giữ 1 SKU giá, bắt chọn `Vị` khi tạo đơn.
- Sinh tố nhiều vị khác giá: mỗi SKU/vị là một dòng catalog riêng.

## File logic

- `src/product-catalog.js`: tải CSV từ repo Bếp Sỉ, chuẩn hóa, seed vào IndexedDB store `products`.
- `src/order-ui.js`: khi tạo Đơn, nạp catalog, chọn sản phẩm bằng tên/SKU, tự fill giá/SKU/unit.
- `local-db.js`: thêm `clearLocalStore(storeName)` để xóa store `products` cũ khi catalog version thay đổi.

## Dữ liệu lưu trong `products`

Mỗi dòng catalog có các trường chính:

```txt
id
product_id
sku / source_sku
source_product_key
name / product_name
brand
industry / industry_key
category / category_key
flavor
size
unit
price / unit_price
price_mode
active / orderable
choice_groups
aliases
search_label
search_text
raw_payload
```

## Luồng Đơn hàng

```txt
Mở + Đơn
→ ensureProductCatalog()
→ nếu catalog cũ/chưa có: clear products + import từ Bếp Sỉ
→ ô Sản phẩm dùng datalist tên/SKU/giá
→ chọn sản phẩm tự fill SKU + giá
→ nếu có choice_groups, bắt chọn Vị/Loại
→ order_items lưu product_id, sku, unit, raw_payload.selections
```

## Lưu ý

Hiện catalog được import runtime từ raw GitHub để lấy đủ data nguồn. Sau khi chốt data sạch có thể đóng băng thành file local JSON trong repo report để không phụ thuộc GitHub raw.
