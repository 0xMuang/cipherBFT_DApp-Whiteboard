/**
 * CanvasRenderer - Renders all objects on the canvas
 */
import { CONFIG } from './config.js';

export class CanvasRenderer {
    constructor(canvas, objectManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objectManager = objectManager;
    }

    render() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const objects = this.objectManager.getObjectsInLayerOrder();
        for (const obj of objects) {
            this._renderObject(obj);
        }
    }

    _renderObject(obj) {
        if (!obj) return;
        const color = CONFIG.colors[obj.colorIndex] || '#000000';

        switch (obj.type) {
            case 'stroke':
                this._renderStroke(obj, color);
                break;
            case 'rectangle':
                this._renderRectangle(obj, color);
                break;
            case 'ellipse':
                this._renderEllipse(obj, color);
                break;
            case 'line':
                this._renderLine(obj, color);
                break;
            case 'arrow':
                this._renderArrow(obj, color);
                break;
            case 'stickyNote':
                this._renderStickyNote(obj);
                break;
            case 'text':
                this._renderText(obj, color);
                break;
        }
    }

    _renderStroke(obj, color) {
        if (!obj.points || obj.points.length < 4) return;

        this.ctx.beginPath();
        this.ctx.moveTo(obj.points[0], obj.points[1]);

        for (let i = 2; i < obj.points.length; i += 2) {
            this.ctx.lineTo(obj.points[i], obj.points[i + 1]);
        }

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = obj.strokeWidth || 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }

    _renderRectangle(obj, color) {
        const b = obj.bounds;
        if (!b) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = obj.strokeWidth || 2;
        this.ctx.strokeRect(b.x, b.y, b.width, b.height);
    }

    _renderEllipse(obj, color) {
        const b = obj.bounds;
        if (!b) return;

        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;

        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = obj.strokeWidth || 2;
        this.ctx.stroke();
    }

    _renderLine(obj, color) {
        const b = obj.bounds;
        if (!b) return;

        this.ctx.beginPath();
        this.ctx.moveTo(b.x, b.y);
        this.ctx.lineTo(b.x + b.width, b.y + b.height);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = obj.strokeWidth || 2;
        this.ctx.stroke();
    }

    _renderArrow(obj, color) {
        const b = obj.bounds;
        if (!b) return;

        const x1 = b.x, y1 = b.y;
        const x2 = b.x + b.width, y2 = b.y + b.height;
        const headLen = 15;
        const angle = Math.atan2(b.height, b.width);

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLen * Math.cos(angle - Math.PI / 6),
            y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLen * Math.cos(angle + Math.PI / 6),
            y2 - headLen * Math.sin(angle + Math.PI / 6)
        );

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = obj.strokeWidth || 2;
        this.ctx.stroke();
    }

    _renderStickyNote(obj) {
        const b = obj.bounds;
        if (!b) return;

        const bgColor = CONFIG.stickyColors[obj.bgColorIndex || 0] || '#fff740';

        // 그림자
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;

        // 배경
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(b.x, b.y, b.width, b.height);

        // 그림자 리셋
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        // 접힌 모서리
        this.ctx.fillStyle = this._darkenColor(bgColor, 20);
        this.ctx.beginPath();
        this.ctx.moveTo(b.x + b.width - 20, b.y);
        this.ctx.lineTo(b.x + b.width, b.y + 20);
        this.ctx.lineTo(b.x + b.width, b.y);
        this.ctx.closePath();
        this.ctx.fill();

        // 텍스트
        if (obj.content) {
            this.ctx.fillStyle = '#333';
            this.ctx.font = '14px sans-serif';
            this._wrapText(obj.content, b.x + 10, b.y + 25, b.width - 20, 20);
        } else {
            this.ctx.fillStyle = '#999';
            this.ctx.font = 'italic 14px sans-serif';
            this.ctx.fillText('Double-click to edit', b.x + 10, b.y + 30);
        }
    }

    _renderText(obj, color) {
        const b = obj.bounds;
        if (!b) return;

        const fontSize = (obj.strokeWidth || 3) * 5;
        this.ctx.font = `${fontSize}px sans-serif`;
        this.ctx.fillStyle = color;
        this.ctx.fillText(obj.content || '', b.x, b.y + fontSize);
    }

    _wrapText(text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > maxWidth && line !== '') {
                this.ctx.fillText(line, x, currentY);
                line = word + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        this.ctx.fillText(line, x, currentY);
    }

    _darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }
}
