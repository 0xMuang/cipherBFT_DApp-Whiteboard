/**
 * ObjectManager - Manages all drawing objects on the canvas
 */
export class ObjectManager {
    constructor() {
        this.objects = new Map();
        this.layerOrder = [];
        this.deletedObjects = new Set();
        this.nextLocalId = -1; // 로컬 임시 ID는 음수
    }

    addObject(objData) {
        this.objects.set(objData.id, objData);
        this._updateLayerOrder();
        return objData;
    }

    updateObject(objectId, updates) {
        const obj = this.objects.get(objectId);
        if (obj && !this.deletedObjects.has(objectId)) {
            Object.assign(obj, updates);
            if ('layer' in updates) {
                this._updateLayerOrder();
            }
        }
    }

    deleteObject(objectId) {
        this.deletedObjects.add(objectId);
        this._updateLayerOrder();
    }

    getObject(objectId) {
        if (this.deletedObjects.has(objectId)) return null;
        return this.objects.get(objectId);
    }

    getObjectsInLayerOrder() {
        return this.layerOrder
            .filter(id => !this.deletedObjects.has(id))
            .map(id => this.objects.get(id));
    }

    getObjectAtPoint(x, y) {
        const sorted = [...this.layerOrder].reverse();
        for (const id of sorted) {
            if (this.deletedObjects.has(id)) continue;
            const obj = this.objects.get(id);
            if (obj && this._pointInBounds(x, y, obj)) {
                return obj;
            }
        }
        return null;
    }

    _pointInBounds(x, y, obj) {
        if (!obj.bounds) return false;
        const b = obj.bounds;
        const pad = (obj.strokeWidth || 5) + 5;
        return x >= b.x - pad && x <= b.x + b.width + pad &&
               y >= b.y - pad && y <= b.y + b.height + pad;
    }

    _updateLayerOrder() {
        this.layerOrder = [...this.objects.keys()]
            .filter(id => !this.deletedObjects.has(id))
            .sort((a, b) => {
                const objA = this.objects.get(a);
                const objB = this.objects.get(b);
                return (objA?.layer || 0) - (objB?.layer || 0);
            });
    }

    calculateStrokeBounds(points) {
        if (!points || points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < points.length; i += 2) {
            const px = points[i];
            const py = points[i + 1];
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX || 1,
            height: maxY - minY || 1
        };
    }

    generateLocalId() {
        return this.nextLocalId--;
    }

    clear() {
        this.objects.clear();
        this.layerOrder = [];
        this.deletedObjects.clear();
    }
}
