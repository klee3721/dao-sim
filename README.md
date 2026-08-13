# Đào Sim cho macOS và Windows

[![Windows](https://github.com/klee3721/dao-sim/actions/workflows/windows.yml/badge.svg)](https://github.com/klee3721/dao-sim/actions/workflows/windows.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPL_v3-blue.svg)](LICENSE)

Ứng dụng desktop dùng trình duyệt nhúng để tìm và crawl SIM từ bốn website:

- KhoSim
- Sim Thăng Long
- Viettel
- VNPT Digishop

Kết quả crawl được tự động nối vào file CSV đang lưu và đã bỏ số `0` đầu tiên. Người dùng có thể chọn lưu CSV một cột hoặc thêm sẵn các cột luận giải. Ứng dụng có màn hình luận số điện thoại hàng loạt với bộ lọc CSV, đồng thời tích hợp Huyền Số trực tiếp vào trình duyệt để luận giải selection tự động.

## Yêu cầu hệ thống

- **Windows:** Windows 10 hoặc Windows 11, bản 64-bit (`x64`).
- **macOS:** máy Mac dùng Apple Silicon (`arm64`: M1, M2, M3, M4 hoặc mới hơn) và macOS 12 Monterey trở lên.
- Bản ứng dụng đóng gói không cần cài Node.js.

## Cài đặt trên Windows

1. Mở file `Đào Sim-Setup-<phiên-bản>-x64.exe`.
2. Trình cài đặt theo người dùng sẽ tự cài **Đào Sim** mà không yêu cầu quyền Administrator.
3. Mở ứng dụng từ Start Menu hoặc shortcut trên Desktop.

Bản phát hành chưa ký mã có thể hiện cảnh báo Microsoft Defender SmartScreen với nhà phát hành không xác định. Chỉ tiếp tục khi file đến từ nguồn tin cậy và checksum SHA-256 khớp với bản phát hành. Có thể chọn **More info → Run anyway** để mở trình cài đặt.

### Gỡ cài đặt trên Windows

Mở **Settings → Apps → Installed apps → Đào Sim → Uninstall**. Trình gỡ cài đặt không tự xóa danh sách SIM trong thư mục lưu mà người dùng đã chọn. Dữ liệu phiên duyệt web và cài đặt cục bộ nằm trong thư mục ứng dụng của Đào Sim dưới `%APPDATA%`.

## Cài đặt trên macOS từ DMG

1. Mở file `Đào Sim-<phiên-bản>-arm64.dmg`.
2. Kéo **Đào Sim** vào thư mục **Applications** trong cửa sổ cài đặt.
3. Tháo ổ đĩa cài đặt, sau đó mở ứng dụng từ thư mục **Applications**.

### Mở bản chưa ký

Bản DMG hiện tại **chưa được ký bằng Developer ID và chưa được Apple notarize**, vì vậy macOS có thể chặn ở lần mở đầu tiên. Chỉ tiếp tục nếu bạn nhận file từ nguồn tin cậy:

1. Trong Finder, mở thư mục **Applications**.
2. Bấm chuột phải hoặc giữ `Control` rồi bấm **Đào Sim**, chọn **Open**.
3. Chọn **Open** một lần nữa trong hộp thoại xác nhận.

Nếu tùy chọn này chưa xuất hiện, mở **System Settings → Privacy & Security**, tìm thông báo về Đào Sim rồi chọn **Open Anyway**.

### Gỡ cài đặt trên macOS

1. Thoát hoàn toàn Đào Sim.
2. Trong Finder, mở **Applications** và chuyển **Đào Sim** vào Trash.
3. Nếu muốn xóa cả cookie và phiên duyệt web đã lưu, mở **Go → Go to Folder…** trong Finder, nhập `~/Library/Application Support/Đào Sim`, rồi chuyển thư mục đó vào Trash.

## Chạy trong chế độ phát triển

Yêu cầu Node.js 22 trở lên và một hệ điều hành được hỗ trợ. Cài đúng phiên bản dependency trong lockfile bằng:

```bash
npm ci
npm run dev
```

Electron 43 tự tải binary tương ứng với hệ điều hành nếu binary chưa có khi chạy `npm run dev`. Lần chạy đầu tiên vì thế cần kết nối Internet và có thể lâu hơn các lần sau.

## Kiểm tra và build tái lập

Luôn bắt đầu từ lockfile bằng `npm ci`, sau đó chạy đầy đủ kiểm tra trước khi đóng gói:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run package:mac
npm run package:win
```

File `.dmg` và `.zip` Apple Silicon (`arm64`) được tạo trong thư mục `release/`.
Sau khi đóng gói thành công, lệnh `npm run package:mac` sẽ tự đóng tiến trình Đào Sim cũ, cài đúng DMG vừa tạo vào `/Applications` và chuyển các artifact phiên bản cũ cùng app debug trong `release/mac-*` vào Trash. Chỉ DMG/ZIP của phiên bản hiện tại được giữ lại trong `release/`.

Bản Windows tạo bộ cài NSIS `.exe`, bản `.zip` 64-bit và file checksum `SHA256SUMS-windows.txt` trong `release/`. Sau khi xác minh PE/ZIP/ASAR thành công, lệnh build xóa các artifact Windows cũ và thư mục debug `win-unpacked`; nó không tự chạy bộ cài. Việc chạy và cài thử bộ cài Windows phải được thực hiện trên Windows thật hoặc runner Windows; macOS chỉ có thể tạo và kiểm tra cấu trúc artifact.

## Cách sử dụng

1. Chọn một trong bốn website ở thanh bên.
2. Tìm SIM và chọn bộ lọc ngay trong website.
3. Ở panel bên phải, chọn thư mục lưu và bật **Kèm luận giải** nếu muốn file crawl có sẵn kết quả phân tích.
4. Bấm **Crawl toàn bộ**. Kết quả được tự động nối vào file đang lưu; SIM trùng trong file sẽ không được thêm lần nữa.
5. Khi muốn tách sang một danh sách khác, bấm **Tạo file mới**. Nếu không bấm, các lượt crawl tiếp theo vẫn nối vào file hiện tại.
6. Mở mục **Luận hàng loạt** để chọn nhanh một file trong thư mục lưu, lọc dữ liệu hoặc xuất kết quả.

### Huyền Số trong trình duyệt

- Chế độ mặc định là **AUTO** và được hiển thị ngay trên thanh địa chỉ.
- Bôi đen một dãy số trên website; sau 250 ms, kết quả sẽ tự cập nhật trong thẻ Huyền Số cố định ở panel bên phải, không che nội dung website.
- Hỗ trợ cặp số, dãy số 2–30 chữ số, SĐT 9/10 chữ số, định dạng `+84` và CCCD 12 chữ số.
- Mỗi cặp hiển thị kèm bậc 1–4; bậc cũng được giữ trong dòng chuyển hóa và đại vận CCCD.
- Nút `×` đóng kết quả hiện tại và đưa thẻ về trạng thái chờ; lần bôi đen tiếp theo sẽ tự hiển thị kết quả mới.
- Không đọc selection trong ô mật khẩu. Toàn bộ phân tích diễn ra cục bộ, không gửi selection ra máy chủ.

### File crawl và thư mục lưu

- Thư mục mặc định là `Downloads/DaoSim`; có thể đổi ngay trong panel bên phải màn hình Trình duyệt.
- Tên file crawl ngắn theo mẫu `sim-YYMMDD-NN.csv`, ví dụ `sim-260811-01.csv`.
- Cột A luôn là SĐT 9 chữ số đã bỏ số `0` đầu. Khi bật **Kèm luận giải**, các cột phía sau chứa kết quả luận số; tab Luận hàng loạt vẫn đọc đúng SĐT từ cột A.
- Bật hoặc tắt **Kèm luận giải** sẽ áp dụng ở lần lưu tiếp theo và viết lại toàn bộ file đang lưu theo chế độ đã chọn.
- Tab Luận hàng loạt tự hiển thị tối đa 100 file CSV/XLSX mới nhất trong thư mục đã cài đặt. Tab này mở trực tiếp CSV; XLSX vẫn được liệt kê để theo dõi.
- File xuất từ Luận hàng loạt dùng hậu tố ngắn `-ls`; file đã lọc dùng hậu tố `-loc`.

### Luận số hàng loạt

- File đầu vào chỉ dùng cột A, không có tiêu đề; mỗi dòng là một số điện thoại.
- Định dạng chuẩn là 9 chữ số đã bỏ số `0` đầu. Ứng dụng cũng đọc được số 10 chữ số và dạng `+84`.
- Giữ nguyên thứ tự, số trùng, dòng trống và dữ liệu gốc. Một dòng sai không làm dừng cả danh sách.
- Giới hạn mỗi file là 5 MB và 10.000 dòng; bảng xem trước hiển thị 50 dòng đầu.
- Có thể loại dòng theo số lượng ô hung tinh màu đỏ, chuỗi ô đỏ liên tiếp, chuỗi số có trong SĐT, dòng có mã năng lượng đã chọn hoặc dòng thiếu mã năng lượng bắt buộc. Các mã lọc được hiển thị gọn dưới dạng `TY/SK/DN/PV/LS/HH/NQ/TM`; nhiều mã “không có ô” nghĩa là dòng phải có đủ các mã đã chọn. Các điều kiện kết hợp theo “HOẶC” và có thể xóa để khôi phục toàn bộ dữ liệu gốc.
- Bảng xem trước và file xuất chỉ chứa các dòng còn lại sau bộ lọc; số dòng ban đầu, thứ tự và các dòng trùng vẫn được giữ nguyên trong tập kết quả còn lại.
- Excel có màu phân biệt cát tinh, hung tinh, quy tắc đặc biệt và dòng lỗi. CSV chỉ chứa nội dung chữ vì định dạng CSV không lưu màu.
- Kết quả dùng mã ngắn đồng bộ với Huyền Số: `TY`, `SK`, `DN`, `PV`, `LS`, `HH`, `NQ`, `TM`; chữ số sau mã là bậc 1–4. `S5`, `(ẩn)` và `(kích)` là các quy tắc đặc biệt và đều được giải thích trong sheet **Chú giải** của file Excel.
- Luận hàng loạt chỉ xuất kết quả cặp ngắn gọn, không tự thêm gợi ý chuyển hóa; các bộ lọc riêng của Đào Sim vẫn dùng đúng mã năng lượng nội bộ nên không bị ảnh hưởng bởi cách hiển thị rút gọn.
- Toàn bộ việc phân tích diễn ra cục bộ trên máy; ứng dụng không gửi danh sách số điện thoại ra Internet.
- Trên Windows, nếu file kết quả đang mở và bị Microsoft Excel khóa, ứng dụng sẽ giữ nguyên file cũ và yêu cầu đóng Excel trước khi lưu lại.

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

Vui lòng báo cáo lỗ hổng theo [chính sách bảo mật](SECURITY.md), không đăng cookie, token hoặc dữ liệu người dùng trong issue công khai.

## Open source và đóng góp

Copyright © 2026 Trung Kien Vu. Mã nguồn Đào Sim được phát hành theo [GNU General Public License v3.0 only](LICENSE). Khi phân phối chương trình, kể cả phiên bản đã sửa đổi, bạn phải cung cấp mã nguồn tương ứng và giữ cùng quyền tự do theo các điều khoản của GPL v3. Hướng dẫn thiết lập, kiểm tra và gửi pull request nằm trong [CONTRIBUTING.md](CONTRIBUTING.md). Giấy phép của các dependency được liệt kê tại [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Đào Sim là dự án độc lập, không liên kết, đại diện hoặc được bảo trợ bởi KhoSim, Sim Thăng Long, Viettel hay VNPT. Tên và nhãn hiệu của các bên thuộc chủ sở hữu tương ứng. Người dùng và người đóng góp có trách nhiệm tuân thủ điều khoản của website, pháp luật áp dụng và giới hạn truy cập hợp lý.

Kết quả Huyền Số chỉ mang tính tham khảo/giải trí, không phải tư vấn y tế, tài chính, pháp lý hoặc căn cứ duy nhất cho quyết định cá nhân.

## Trạng thái phát hành

### Windows

Bộ cài hiện chưa được ký Authenticode nên Windows có thể hiển thị cảnh báo **Unknown publisher** hoặc SmartScreen. Để phát hành rộng rãi cần ký file thực thi và bộ cài bằng chứng thư OV/EV hoặc Azure Trusted Signing, đóng dấu thời gian và kiểm tra lại chữ ký sau khi đóng gói.

### macOS

Gói tạo trong môi trường phát triển là bản **unsigned và chưa notarized**. Đây là bản dùng để thử nghiệm hoặc chia sẻ trực tiếp; cảnh báo Gatekeeper khi mở là hành vi dự kiến. Để phát hành rộng rãi cần:

1. Tài khoản Apple Developer.
2. Chứng thư Developer ID Application.
3. Ký ứng dụng, bật Hardened Runtime và notarize.
