const fs = require("fs-extra");
const path = require("path");
const login = require("@dongdev/fca-unofficial");
const { TOTP } = require("totp-generator");

module.exports = function autoLogin({ rootDirectory, config, parseCookies, logger }, callback) {
    const cookiePath = path.join(rootDirectory, "cookie.txt");
    const authPath = path.join(rootDirectory, "auth.json");
    const appStatePath = path.join(rootDirectory, "utils", "data", "fbstate.json");
    const loginAttempts = [];
    let auth = {};

    if (fs.existsSync(authPath)) {
        try {
            auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
        } catch (_) {
            logger("auth.json không hợp lệ, chuyển sang thông tin trong config.json.", "warn");
        }
    }

    if (fs.existsSync(appStatePath)) {
        try {
            const appState = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
            if (Array.isArray(appState) && appState.length) loginAttempts.push({ appState });
        } catch (_) {
            logger("fbstate.json không hợp lệ, chuyển sang phương thức đăng nhập khác.", "warn");
        }
    }

    if (fs.existsSync(cookiePath)) {
        loginAttempts.push({ appState: parseCookies(fs.readFileSync(cookiePath, "utf8")) });
    }

    const email = process.env.FB_EMAIL || auth.email || config.EMAIL;
    const password = process.env.FB_PASSWORD || auth.password || config.PASSWORD;
    if (email && password) loginAttempts.push({ email, password });

    const attemptLogin = (index) => {
        if (!loginAttempts[index]) {
            return callback(new Error("Không có appstate hợp lệ hoặc thông tin đăng nhập Facebook."));
        }

        login(loginAttempts[index], (loginError, api) => {
            if (!loginError) {
                const saveAppState = () => {
                    try {
                        fs.writeFileSync(appStatePath, JSON.stringify(api.getAppState(), null, 2));
                    } catch (error) {
                        logger(`Không thể cập nhật appstate: ${error.message}`, "warn");
                    }
                };
                saveAppState();
                setInterval(saveAppState, 15 * 60 * 1000);
                return callback(null, api);
            }

            if (loginError.error === "login-approval") {
                const otpKey = process.env.FB_OTPKEY || auth.otpKey || config.OTPKEY;
                if (!otpKey) return callback(loginError);
                try {
                    const { otp } = TOTP.generate(otpKey.replace(/\s+/g, ""));
                    return loginError.continue(otp);
                } catch (error) {
                    return callback(new Error(`Không thể tạo mã 2FA: ${error.message}`));
                }
            }

            return attemptLogin(index + 1);
        });
    };

    attemptLogin(0);
};