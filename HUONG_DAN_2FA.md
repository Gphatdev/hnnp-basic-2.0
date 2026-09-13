# Hướng dẫn lấy khóa 2FA

`otpKey` trong `auth.json` là khóa bí mật dùng để tạo mã 2FA tự động. Đây **không phải** mã 6 số đang thay đổi trên ứng dụng Authenticator.

## Cách lấy khóa 2FA

1. Đăng nhập Facebook bằng trình duyệt hoặc ứng dụng chính thức.
2. Mở **Cài đặt và quyền riêng tư** > **Cài đặt**.
3. Vào **Trung tâm tài khoản** > **Mật khẩu và bảo mật**.
4. Chọn **Xác thực hai yếu tố** và tài khoản Facebook cần dùng.
5. Chọn ứng dụng xác thực, sau đó chọn thêm thiết bị hoặc thiết lập lại ứng dụng xác thực.
6. Khi Facebook hiển thị mã QR, chọn tùy chọn hiển thị khóa thiết lập thủ công nếu có.
7. Sao chép chuỗi khóa gốc đó vào trường `otpKey` trong `auth.json`.

Ví dụ:

```json
{
    "email": "email_cua_ban",
    "password": "mat_khau_cua_ban",
    "otpKey": "JBSWY3DPEHPK3PXP"
}
```

## Lưu ý bảo mật

- Không gửi `otpKey`, mật khẩu hoặc file `auth.json` cho người khác.
- Không dùng mã OTP 6 số hiện tại thay cho `otpKey`.
- Không đăng file `auth.json` lên GitHub hoặc nhóm chat.
- Nếu Facebook không hiển thị khóa thiết lập thủ công, hãy tạo lại phương thức ứng dụng xác thực từ phần bảo mật của tài khoản.
- Bot chỉ có thể dùng khóa 2FA mà chính chủ tài khoản lấy được; không có cách an toàn để suy ra khóa này chỉ từ email và mật khẩu.