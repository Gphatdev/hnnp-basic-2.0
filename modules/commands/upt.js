const os = require('os');
const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

// Hàm vẽ hình chữ nhật bo góc (thay cho ctx.roundRect)
function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

module.exports = {
    config: {
        name: "uptime",
        version: "2.0.1",
        hasPermssion: 0,
        credits: "GiaPhat Dev & AI",
        description: "Xem thông số hệ thống và uptime dưới dạng ảnh Canvas",
        commandCategory: "Admin",
        cooldowns: 5
    },

    run: async ({ api, event }) => {
        const { threadID, messageID } = event;

        // Tính toán thông số
        const uptime = process.uptime();
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeStr = `${days > 0 ? days + 'd ' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = ((usedMem / totalMem) * 100).toFixed(1);

        const totalGB = (totalMem / 1024 / 1024 / 1024).toFixed(2);
        const usedGB = (usedMem / 1024 / 1024 / 1024).toFixed(2);
        const freeGB = (freeMem / 1024 / 1024 / 1024).toFixed(2);

        const cpus = os.cpus();
        const cpuModel = (cpus[0] ? cpus[0].model : 'Unknown').replace(/\(R\)|\(TM\)/g, '').trim();
        const platform = os.platform();
        const ping = event.timestamp ? Math.max(0, Date.now() - Number(event.timestamp)) : 0;

        // Khởi tạo Canvas
        const width = 800;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Nền Gradient
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#020e2f');
        bgGradient.addColorStop(1, '#353069');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        const fontSans = 'sans-serif';

        // 1. Viền ngoài
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, 760, 410);

        // 2. Tiêu đề
        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold 26px ${fontSans}`;
        ctx.fillText('⚡ SYSTEM & BOT UPTIME STATUS', 40, 65);

        // Đường kẻ phân cách 1
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 85);
        ctx.lineTo(760, 85);
        ctx.stroke();

        // 3. Khối Uptime & Thông tin hệ thống
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold 20px ${fontSans}`;
        ctx.fillText('⏱️ BOT UPTIME', 40, 125);

        ctx.fillStyle = '#4ade80';
        ctx.font = `bold 36px ${fontSans}`;
        ctx.fillText(uptimeStr, 40, 170);

        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold 20px ${fontSans}`;
        ctx.fillText('💻 HỆ THỐNG', 450, 125);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `16px ${fontSans}`;
        ctx.fillText(`• Hệ điều hành: ${platform.toUpperCase()}`, 450, 155);
        ctx.fillText(`• Độ trễ (Ping): ${ping}ms`, 450, 180);
        ctx.fillText(`• CPU: ${cpuModel.length > 28 ? cpuModel.substring(0, 28) + '...' : cpuModel}`, 450, 205);

        // 4. Khối RAM
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold 20px ${fontSans}`;
        ctx.fillText(`🔋 RAM USAGE (${memoryUsage}%)`, 40, 245);

        const barX = 40;
        const barY = 265;
        const barW = 720;
        const barH = 24;

        ctx.fillStyle = '#334155';
        roundRect(ctx, barX, barY, barW, barH, 12);
        ctx.fill();

        const fillWidth = Math.max(12, (barW * Number(memoryUsage)) / 100);
        const ramGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        ramGradient.addColorStop(0, '#38bdf8');
        ramGradient.addColorStop(0.7, '#818cf8');
        ramGradient.addColorStop(1, '#f43f5e');

        ctx.fillStyle = ramGradient;
        roundRect(ctx, barX, barY, fillWidth, barH, 12);
        ctx.fill();

        // Chi tiết RAM
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `16px ${fontSans}`;
        ctx.fillText(`Đã dùng: ${usedGB} GB`, 40, 318);
        ctx.fillText(`Còn trống: ${freeGB} GB`, 310, 318);
        ctx.fillText(`Tổng cộng: ${totalGB} GB`, 580, 318);

        // Đường kẻ phân cách 2
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 350);
        ctx.lineTo(760, 350);
        ctx.stroke();

        // 5. Chân trang
        ctx.fillStyle = '#64748b';
        ctx.font = `italic 15px ${fontSans}`;
        ctx.fillText(`GiaPhat Dev System • Ngày khởi tạo: ${new Date().toLocaleDateString('vi-VN')}`, 40, 388);

        // Xuất file
        const cacheDir = path.join(__dirname, 'cache');
        const cachePath = path.join(cacheDir, `uptime_${Date.now()}.png`);
        await fs.ensureDir(cacheDir);

        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(cachePath, buffer);

        return api.sendMessage({
            body: `🤖 Thông số hệ thống hiện tại của Bot:`,
            attachment: fs.createReadStream(cachePath)
        }, threadID, () => {
            if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
        }, messageID);
    }
};