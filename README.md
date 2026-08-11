# Đào Sim cho macOS

Ứng dụng desktop dùng trình duyệt nhúng để tìm và crawl SIM từ bốn website:

- KhoSim
- Sim Thăng Long
- Viettel
- VNPT Digishop

Kết quả được lưu thành CSV một cột, không có tiêu đề và đã bỏ số `0` đầu tiên. Ứng dụng cũng có màn hình lọc CSV để loại những SIM chứa một hoặc nhiều chuỗi số.

## Yêu cầu hệ thống

- Máy Mac dùng Apple Silicon (`arm64`: M1, M2, M3, M4 hoặc mới hơn).
- macOS 12 Monterey trở lên.
- Bản ứng dụng đóng gói không cần cài Node.js.

## Cài đặt từ DMG

1. Mở file `Đào Sim-<phiên-bản>-arm64.dmg`.
2. Kéo **Đào Sim** vào thư mục **Applications** trong cửa sổ cài đặt.
3. Tháo ổ đĩa cài đặt, sau đó mở ứng dụng từ thư mục **Applications**.

### Mở bản chưa ký

Bản DMG hiện tại **chưa được ký bằng Developer ID và chưa được Apple notarize**, vì vậy macOS có thể chặn ở lần mở đầu tiên. Chỉ tiếp tục nếu bạn nhận file từ nguồn tin cậy:

1. Trong Finder, mở thư mục **Applications**.
2. Bấm chuột phải hoặc giữ `Control` rồi bấm **Đào Sim**, chọn **Open**.
3. Chọn **Open** một lần nữa trong hộp thoại xác nhận.

Nếu tùy chọn này chưa xuất hiện, mở **System Settings → Privacy & Security**, tìm thông báo về Đào Sim rồi chọn **Open Anyway**.

## Gỡ cài đặt

1. Thoát hoàn toàn Đào Sim.
2. Trong Finder, mở **Applications** và chuyển **Đào Sim** vào Trash.
3. Nếu muốn xóa cả cookie và phiên duyệt web đã lưu, mở **Go → Go to Folder…** trong Finder, nhập `~/Library/Application Support/Đào Sim`, rồi chuyển thư mục đó vào Trash.

## Chạy trong chế độ phát triển

Yêu cầu Node.js 22 trở lên, macOS 12+ và máy Apple Silicon. Cài đúng phiên bản dependency trong lockfile bằng:

```bash
npm ci
npm run dev
```

Electron 43 tự tải binary macOS cần thiết nếu binary chưa có khi chạy `npm run dev`. Lần chạy đầu tiên vì thế cần kết nối Internet và có thể lâu hơn các lần sau.

## Kiểm tra và build tái lập

Luôn bắt đầu từ lockfile bằng `npm ci`, sau đó chạy đầy đủ kiểm tra trước khi đóng gói:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run package:mac
```

File `.dmg` và `.zip` Apple Silicon (`arm64`) được tạo trong thư mục `release/`.

## Cách sử dụng

1. Chọn một trong bốn website ở thanh bên.
2. Tìm SIM và chọn bộ lọc ngay trong website.
3. Bấm **Crawl toàn bộ**.
4. Chỉ lưu CSV sau khi ứng dụng báo hoàn thành.
5. Mở mục **Xử lý CSV** nếu cần loại SIM chứa chuỗi số, ví dụ `00, 49, 777`.

## Giới hạn và mức độ hoàn chỉnh

- **Sim Thăng Long:** crawl toàn bộ phân trang và chỉ hoàn thành khi số SIM duy nhất khớp đúng tổng website công bố. Nếu không khớp sau các lần thử lại, ứng dụng không xuất CSV.
- **KhoSim:** crawl và đối chiếu chính xác với truy vấn có tối đa 5.000 kết quả. Truy vấn lớn hơn phải lọc hẹp lại; ứng dụng không coi một phần kết quả là hoàn chỉnh.
- **Viettel:** website không cung cấp tổng kết quả đáng tin cậy, nên ứng dụng chỉ có thể báo **Tốt nhất có thể**. CAPTCHA, giới hạn tốc độ hoặc dữ liệu lặp có thể làm lượt crawl dừng sớm.
- **VNPT Digishop:** API hiện chỉ trả tối đa 50 SIM cho mỗi truy vấn. Ứng dụng lấy toàn bộ tập API trả về, nhưng không thể khẳng định còn hay không còn SIM bị ẩn ngoài giới hạn đó.

Tồn kho của các website có thể thay đổi ngay trong lúc crawl. Với các nguồn có tổng kiểm chứng được, nếu trang bị lặp, CAPTCHA xuất hiện hoặc số duy nhất không khớp tổng, ứng dụng dừng và không tạo file thiếu.

## Bảo mật

- Nội dung website không có quyền Node.js hoặc quyền truy cập file trên máy.
- Mỗi website dùng một session cookie riêng.
- Không lưu mật khẩu, OTP hoặc dữ liệu đặt hàng.
- Crawler chỉ đọc danh sách SIM và không gọi chức năng giữ số hoặc mua SIM.

## Trạng thái phát hành macOS

Gói tạo trong môi trường phát triển là bản **unsigned và chưa notarized**. Đây là bản dùng để thử nghiệm hoặc chia sẻ nội bộ; cảnh báo Gatekeeper khi mở là hành vi dự kiến. Để phát hành rộng rãi cần:

1. Tài khoản Apple Developer.
2. Chứng thư Developer ID Application.
3. Ký ứng dụng, bật Hardened Runtime và notarize.
