# NKNP AGENCY

<p align="center">
    <img src="https://files.catbox.moe/qq3jvx.png" alt="NKNP AGENCY" width="720">
</p>

> Facebook Messenger Bot - bản cơ bản, dễ cài, dễ chỉnh và chạy trực tiếp bằng Node.js.

## Có gì trong bot?

- Hệ thống command và event có thể mở rộng.
- Quản lý `ADMINBOT` và `NDH` ngay khi đang chạy bot.
- Tự dọn file cache tạm khi khởi động.
- Tự lưu appstate mới trong lúc phiên đăng nhập còn hoạt động.
- Hỗ trợ đăng nhập bằng appstate, cookie hoặc tài khoản Facebook với 2FA TOTP.
- Database SQLite tự khởi tạo theo cấu hình.

## Yêu cầu

- Node.js 20.x trở lên.
- Một tài khoản Facebook riêng dùng cho bot.
- Windows, Linux hoặc Termux.

## Cài đặt nhanh

```bash
git clone https://github.com/YOUR_USERNAME/nknp-basic.git
cd nknp-basic
npm install
npm start
```

Thay `YOUR_USERNAME` bằng tên tài khoản GitHub của bạn.

## Cấu hình cơ bản

Mở [config.json](config.json) và chỉnh:

- `BOTNAME`: tên hiển thị của bot.
- `PREFIX`: tiền tố lệnh, mặc định là `!`.
- `ADMINBOT`: danh sách Admin Bot.
- `NDH`: danh sách Người Điều Hành.
- `language`: ngôn ngữ `vi` hoặc `en`.

Khi sửa `ADMINBOT` hoặc `NDH` trong lúc bot đang chạy, bot sẽ tự nhận diện thay đổi, không cần restart.

## Đăng nhập

Bot hỗ trợ ba cách, theo thứ tự ưu tiên:

1. Appstate đã lưu tại `utils/data/fbstate.json`.
2. Cookie trong `cookie.txt`.
3. Thông tin trong file `auth.json`.

### Đăng nhập tự động tùy chọn

Nếu cần dùng tài khoản, mật khẩu và 2FA, điền [auth.json](auth.json):

```json
{
    "email": "email_cua_ban",
    "password": "mat_khau_cua_ban",
    "otpKey": "KHOA_2FA_BASE32"
}
```

`auth.json` là tùy chọn. Người không dùng autologin có thể bỏ qua file này và tiếp tục dùng cookie hoặc appstate như bình thường.

`otpKey` là khóa thiết lập 2FA gốc, không phải mã OTP 6 số. Xem [HUONG_DAN_2FA.md](HUONG_DAN_2FA.md) để biết cách lấy khóa.

## Lệnh mẫu

```text
!help
!uid
!ping
!admin list
!admin add USER_ID
!admin remove USER_ID
```

## Bảo mật

- Không đăng `auth.json`, `cookie.txt` hoặc `utils/data/fbstate.json` lên GitHub.
- Không gửi mật khẩu, cookie hoặc khóa 2FA cho người khác.
- Nên dùng tài khoản Facebook phụ, không dùng tài khoản chính.
- Facebook có thể yêu cầu checkpoint hoặc xác minh thiết bị. Khi đó cần xác minh thủ công.

## Cấu trúc chính

```text
autologin.js       Đăng nhập và lưu appstate
config.json        Cấu hình bot
auth.json          Thông tin autologin, không bắt buộc
modules/commands   Các lệnh bot
modules/events     Các event bot
includes/           Database và bộ xử lý event
utils/              Tiện ích dùng chung
```

## Chạy bot

```bash
npm start
```

## Đóng góp

1. Fork repository.
2. Tạo branch mới.
3. Thực hiện thay đổi và kiểm tra bot.
4. Tạo Pull Request.

## NKNP AGENCY

Dự án được xây dựng để làm nền tảng Messenger Bot đơn giản, dễ tùy biến và phù hợp cho việc học Node.js.