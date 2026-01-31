/**
 * SelectionSystem - Handles object selection, transforms (move/resize)
 */
export class SelectionSystem {
    constructor(objectManager) {
        this.objectManager = objectManager;
        this.selectedIds = new Set();
        this.selectionBounds = null;
        this.transformMode = null;
        this.dragStart = null;
        this.originalBounds = null;
        this.originalObjectBounds = new Map();
        this.originalObjectPoints = new Map(); // 스트로크용 원본 포인트
        this.handleSize = 10;
    }

    selectObject(objectId, addToSelection = false) {
        if (!addToSelection) {
            this.selectedIds.clear();
        }
        this.selectedIds.add(objectId);
        this._updateSelectionBounds();
    }

    deselectAll() {
        this.selectedIds.clear();
        this.selectionBounds = null;
    }

    getSelectedObjects() {
        return [...this.selectedIds]
            .map(id => this.objectManager.getObject(id))
            .filter(Boolean);
    }

    hasSelection() {
        return this.selectedIds.size > 0;
    }

    _updateSelectionBounds() {
        if (this.selectedIds.size === 0) {
            this.selectionBounds = null;
            return;
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const id of this.selectedIds) {
            const obj = this.objectManager.getObject(id);
            if (obj && obj.bounds) {
                minX = Math.min(minX, obj.bounds.x);
                minY = Math.min(minY, obj.bounds.y);
                maxX = Math.max(maxX, obj.bounds.x + obj.bounds.width);
                maxY = Math.max(maxY, obj.bounds.y + obj.bounds.height);
            }
        }

        if (minX !== Infinity) {
            this.selectionBounds = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
    }

    getHandlePositions() {
        if (!this.selectionBounds) return {};
        const b = this.selectionBounds;
        return {
            nw: { x: b.x, y: b.y },
            n:  { x: b.x + b.width / 2, y: b.y },
            ne: { x: b.x + b.width, y: b.y },
            e:  { x: b.x + b.width, y: b.y + b.height / 2 },
            se: { x: b.x + b.width, y: b.y + b.height },
            s:  { x: b.x + b.width / 2, y: b.y + b.height },
            sw: { x: b.x, y: b.y + b.height },
            w:  { x: b.x, y: b.y + b.height / 2 }
        };
    }

    getHandleAtPoint(x, y) {
        if (!this.selectionBounds) return null;
        const positions = this.getHandlePositions();
        for (const [name, pos] of Object.entries(positions)) {
            if (Math.abs(x - pos.x) <= this.handleSize &&
                Math.abs(y - pos.y) <= this.handleSize) {
                return name;
            }
        }
        return null;
    }

    isPointInSelection(x, y) {
        if (!this.selectionBounds) return false;
        const b = this.selectionBounds;
        return x >= b.x && x <= b.x + b.width &&
               y >= b.y && y <= b.y + b.height;
    }

    startTransform(mode, startPoint) {
        this.transformMode = mode;
        this.dragStart = { ...startPoint };
        this.originalBounds = this.selectionBounds ? { ...this.selectionBounds } : null;
        this.originalObjectBounds = new Map();
        this.originalObjectPoints = new Map();

        for (const id of this.selectedIds) {
            const obj = this.objectManager.getObject(id);
            if (!obj) continue;

            // bounds가 없으면 계산
            if (!obj.bounds) {
                if (obj.type === 'stroke' && obj.points && obj.points.length >= 2) {
                    obj.bounds = this.objectManager.calculateStrokeBounds(obj.points);
                } else {
                    continue;
                }
            }

            this.originalObjectBounds.set(id, { ...obj.bounds });

            // 스트로크의 경우 원본 포인트도 저장
            if (obj.type === 'stroke' && obj.points) {
                this.originalObjectPoints.set(id, [...obj.points]);
            }
        }
    }

    updateTransform(currentPoint) {
        if (!this.transformMode || !this.dragStart) return;

        const dx = currentPoint.x - this.dragStart.x;
        const dy = currentPoint.y - this.dragStart.y;

        if (this.transformMode === 'move') {
            for (const id of this.selectedIds) {
                let original = this.originalObjectBounds.get(id);
                const obj = this.objectManager.getObject(id);

                if (!obj) continue;

                // bounds가 없으면 설정
                if (!original) {
                    if (obj.bounds) {
                        original = { ...obj.bounds };
                    } else if (obj.points && obj.points.length >= 2) {
                        const calculatedBounds = this.objectManager.calculateStrokeBounds(obj.points);
                        obj.bounds = calculatedBounds;
                        original = { ...calculatedBounds };
                    } else {
                        continue;
                    }
                    this.originalObjectBounds.set(id, original);

                    // 스트로크인데 원본 포인트가 없으면 저장
                    if (obj.type === 'stroke' && obj.points && !this.originalObjectPoints.has(id)) {
                        this.originalObjectPoints.set(id, [...obj.points]);
                    }
                }

                const updates = {
                    bounds: {
                        x: original.x + dx,
                        y: original.y + dy,
                        width: original.width,
                        height: original.height
                    }
                };

                // 스트로크의 경우 포인트도 변환
                if (obj.type === 'stroke') {
                    const originalPoints = this.originalObjectPoints.get(id);
                    if (originalPoints) {
                        const newPoints = [];
                        for (let i = 0; i < originalPoints.length; i += 2) {
                            newPoints.push(originalPoints[i] + dx);
                            newPoints.push(originalPoints[i + 1] + dy);
                        }
                        updates.points = newPoints;
                    }
                }

                this.objectManager.updateObject(id, updates);
            }
        } else if (this.transformMode.startsWith('resize')) {
            this._handleResize(dx, dy);
        }

        this._updateSelectionBounds();
    }

    _handleResize(dx, dy) {
        const mode = this.transformMode.replace('resize-', '');
        const ob = this.originalBounds;
        if (!ob) return;

        let scaleX = 1, scaleY = 1;
        let offsetX = 0, offsetY = 0;

        if (mode.includes('e')) {
            scaleX = Math.max(0.1, (ob.width + dx) / ob.width);
        }
        if (mode.includes('w')) {
            scaleX = Math.max(0.1, (ob.width - dx) / ob.width);
            offsetX = dx;
        }
        if (mode.includes('s')) {
            scaleY = Math.max(0.1, (ob.height + dy) / ob.height);
        }
        if (mode.includes('n')) {
            scaleY = Math.max(0.1, (ob.height - dy) / ob.height);
            offsetY = dy;
        }

        for (const id of this.selectedIds) {
            const original = this.originalObjectBounds.get(id);
            if (original) {
                const relX = ob.width > 0 ? (original.x - ob.x) / ob.width : 0;
                const relY = ob.height > 0 ? (original.y - ob.y) / ob.height : 0;

                const obj = this.objectManager.getObject(id);
                const updates = {
                    bounds: {
                        x: ob.x + offsetX + relX * ob.width * scaleX,
                        y: ob.y + offsetY + relY * ob.height * scaleY,
                        width: Math.max(10, original.width * scaleX),
                        height: Math.max(10, original.height * scaleY)
                    }
                };

                // 스트로크의 경우 포인트도 스케일 변환
                if (obj && obj.type === 'stroke') {
                    const originalPoints = this.originalObjectPoints.get(id);
                    if (originalPoints && original) {
                        const newPoints = [];
                        for (let i = 0; i < originalPoints.length; i += 2) {
                            // 원래 bounds 기준으로 상대 위치 계산
                            const relPx = original.width > 0 ? (originalPoints[i] - original.x) / original.width : 0;
                            const relPy = original.height > 0 ? (originalPoints[i + 1] - original.y) / original.height : 0;
                            // 새 bounds 크기에 맞게 변환
                            newPoints.push(updates.bounds.x + relPx * updates.bounds.width);
                            newPoints.push(updates.bounds.y + relPy * updates.bounds.height);
                        }
                        updates.points = newPoints;
                    }
                }

                this.objectManager.updateObject(id, updates);
            }
        }
    }

    endTransform() {
        const result = {
            mode: this.transformMode,
            objects: this.getSelectedObjects()
        };

        this.transformMode = null;
        this.dragStart = null;
        this.originalBounds = null;
        this.originalObjectBounds.clear();
        if (this.originalObjectPoints) {
            this.originalObjectPoints.clear();
        }

        return result;
    }

    drawSelection(ctx) {
        if (!this.selectionBounds) return;

        const b = this.selectionBounds;

        // 선택 박스
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.setLineDash([]);

        // 핸들
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 1;

        const positions = this.getHandlePositions();
        for (const pos of Object.values(positions)) {
            ctx.beginPath();
            ctx.rect(
                pos.x - this.handleSize / 2,
                pos.y - this.handleSize / 2,
                this.handleSize,
                this.handleSize
            );
            ctx.fill();
            ctx.stroke();
        }
    }
}
