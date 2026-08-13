# Đóng góp cho Đào Sim

Cảm ơn bạn muốn đóng góp. Hãy mở issue trước cho thay đổi lớn để thống nhất phạm vi và cách triển khai.

## Thiết lập môi trường

- Node.js 22 trở lên.
- Cài dependency đúng lockfile bằng `npm ci`.
- Chạy ứng dụng phát triển bằng `npm run dev`.

Trước khi gửi pull request, hãy chạy:

```bash
npm run typecheck
npm test
npm run build
```

## Nguyên tắc pull request

- Mỗi pull request tập trung vào một mục tiêu rõ ràng.
- Thêm hoặc cập nhật test cho thay đổi hành vi.
- Không commit file build, danh sách SIM, cookie, token, khóa ký, `.env` hoặc dữ liệu người dùng.
- Không thêm cơ chế vượt CAPTCHA, giới hạn truy cập hoặc gọi API giữ/mua SIM.
- Giữ crawler ở chế độ chỉ đọc, do người dùng chủ động chạy và có giới hạn tốc độ hợp lý.
- Chỉ đóng góp mã nguồn, nội dung và hình ảnh mà bạn có quyền cấp phép theo GPL-3.0-only.

Pull request từ fork công khai chỉ chạy typecheck, test và audit. Bộ cài chính thức được đóng gói từ nhánh `main` hoặc bằng workflow thủ công của dự án.

Khi gửi đóng góp, bạn đồng ý cấp phép phần đóng góp của mình theo [GNU General Public License v3.0 only](LICENSE) của dự án.
