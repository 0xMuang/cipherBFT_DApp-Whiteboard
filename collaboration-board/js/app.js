/**
 * Collaboration Board - Main Application
 * Figma-like real-time collaboration tool on blockchain
 */
import { CONFIG, CONTRACT_ABI, REGISTRY_ABI, ANVIL_ACCOUNTS } from './config.js';
import { ObjectManager } from './ObjectManager.js';
import { SelectionSystem } from './SelectionSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';

// ===== Global State =====
let provider = null;
let signer = null;
let contract = null;
let contractAddress = null;
let myAddress = null;
let isJoined = false;
let userNickname = null;

let sessionWallet = null;
let sessionContract = null;

let mainCanvas, mainCtx, selectionCanvas, selectionCtx;
let objectManager, selectionSystem, canvasRenderer;

let currentTool = 'pen';
let currentColor = '#000000';
let currentColorIndex = 0;
let brushSize = 3;

let isDrawing = false;
let shapeStart = null;
let strokePoints = [];
let lastPoint = null;

const cursors = new Map();
let stats = { txSent: 0, objects: 0 };
let pollingIntervalId = null;

let editingStickyId = null;

// BoardRegistry
let registryAddress = localStorage.getItem('boardRegistryAddress') || '';
let registryContract = null;

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const cursorLayer = document.getElementById('cursor-layer');
const eventLog = document.getElementById('event-log');
const layerList = document.getElementById('layer-list');

// ===== Initialization =====
function init() {
    mainCanvas = document.getElementById('main-canvas');
    mainCtx = mainCanvas.getContext('2d');
    selectionCanvas = document.getElementById('selection-canvas');
    selectionCtx = selectionCanvas.getContext('2d');

    objectManager = new ObjectManager();
    selectionSystem = new SelectionSystem(objectManager);
    canvasRenderer = new CanvasRenderer(mainCanvas, objectManager);

    resizeCanvas();

    // Color palette
    const palette = document.getElementById('color-palette');
    CONFIG.colors.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.className = 'color-btn' + (i === 0 ? ' active' : '');
        btn.style.background = color;
        btn.dataset.color = color;
        btn.dataset.index = i;
        btn.onclick = () => selectColor(color, i, btn);
        palette.appendChild(btn);
    });

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.onclick = () => selectTool(btn.dataset.tool, btn);
    });

    // Brush size
    const brushSizeInput = document.getElementById('brush-size');
    brushSizeInput.oninput = () => {
        brushSize = parseInt(brushSizeInput.value);
        updateBrushPreview();
    };
    updateBrushPreview();

    // Canvas events
    mainCanvas.addEventListener('mousedown', handleMouseDown);
    mainCanvas.addEventListener('mousemove', handleMouseMove);
    mainCanvas.addEventListener('mouseup', handleMouseUp);
    mainCanvas.addEventListener('mouseleave', handleMouseUp);
    mainCanvas.addEventListener('dblclick', handleDoubleClick);

    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);

    // Layer panel events
    document.getElementById('bring-front-btn').onclick = () => handleLayerAction('front');
    document.getElementById('send-back-btn').onclick = () => handleLayerAction('back');
    document.getElementById('lock-btn').onclick = () => handleLayerAction('lock');
    document.getElementById('delete-btn').onclick = () => handleLayerAction('delete');

    // Panel drag & collapse
    setupDraggablePanels();

    // Clear button
    document.getElementById('clear-btn').onclick = clearCanvas;

    // Text input
    document.getElementById('text-input').addEventListener('keydown', handleTextInput);
    document.getElementById('text-input').addEventListener('blur', hideTextInput);

    // Window resize
    window.addEventListener('resize', resizeCanvas);

    // Connection buttons
    document.getElementById('connect-btn').addEventListener('click', connectWallet);
    document.getElementById('disconnect-btn').addEventListener('click', disconnectWallet);
    document.getElementById('account-select').addEventListener('change', function() {
        const pkInput = document.getElementById('pk-input');
        if (this.value === 'custom') {
            pkInput.style.display = 'block';
            pkInput.focus();
        } else {
            pkInput.style.display = 'none';
            pkInput.value = '';
        }
    });
    document.getElementById('deploy-btn').addEventListener('click', openBoardModal);
    document.getElementById('use-existing-btn').addEventListener('click', useExistingContract);
    document.getElementById('create-board-btn').addEventListener('click', createBoard);
    document.getElementById('change-registry-btn').addEventListener('click', () => {
        localStorage.removeItem('boardRegistryAddress');
        registryAddress = '';
        registryContract = null;
        loadBoardList();
    });
    document.getElementById('join-btn').addEventListener('click', function() {
        showNicknameModal();
    });

    // Nickname modal events
    document.getElementById('nickname-input').addEventListener('input', function() {
        const value = this.value.trim() || 'Designer';
        document.getElementById('nickname-preview-text').textContent = value;
    });
    document.getElementById('nickname-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('nickname-confirm-btn').click();
        }
    });
    document.getElementById('nickname-cancel-btn').addEventListener('click', function() {
        hideNicknameModal();
        document.getElementById('join-btn').disabled = false;
    });
    document.getElementById('nickname-confirm-btn').addEventListener('click', function() {
        const input = document.getElementById('nickname-input');
        userNickname = input.value.trim() || `Designer_${myAddress.slice(-4)}`;
        localStorage.setItem('userNickname', userNickname);
        hideNicknameModal();
        document.getElementById('join-btn').disabled = false;
        joinSession();
    });

    log('Collaboration Board loaded. Connect wallet to start!');
    render();
}

function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    mainCanvas.width = rect.width;
    mainCanvas.height = rect.height;
    selectionCanvas.width = rect.width;
    selectionCanvas.height = rect.height;
    mainCanvas.style.cursor = getCursorStyle();
    render();
}

function getCursorStyle() {
    switch (currentTool) {
        case 'select': return 'default';
        case 'eraser': return 'cell';
        case 'text': return 'text';
        default: return 'crosshair';
    }
}

function updateBrushPreview() {
    const brushDot = document.getElementById('brush-dot');
    brushDot.style.width = brushSize + 'px';
    brushDot.style.height = brushSize + 'px';
}

function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    eventLog.appendChild(entry);
    eventLog.scrollTop = eventLog.scrollHeight;
    while (eventLog.children.length > 50) {
        eventLog.removeChild(eventLog.firstChild);
    }
}

// ===== Tool/Color Selection =====
function selectTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mainCanvas.style.cursor = getCursorStyle();

    if (tool !== 'select') {
        selectionSystem.deselectAll();
        renderSelection();
    }
}

function selectColor(color, index, btn) {
    currentColor = color;
    currentColorIndex = index;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ===== Rendering =====
function render() {
    canvasRenderer.render();
    renderSelection();
    updateLayerPanel();
    updateStats();
}

function renderSelection() {
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    selectionSystem.drawSelection(selectionCtx);
}

function updateLayerPanel() {
    const objects = objectManager.getObjectsInLayerOrder().reverse();
    const selectedIds = selectionSystem.selectedIds;

    layerList.innerHTML = objects.map(obj => {
        const icon = getTypeIcon(obj.type);
        const name = getObjectName(obj);
        const selected = selectedIds.has(obj.id) ? 'selected' : '';
        const locked = obj.isLocked ? 'locked' : '';

        return `
            <div class="layer-item ${selected} ${locked}" data-id="${obj.id}">
                <span class="layer-icon">${icon}</span>
                <span class="layer-name">${name}</span>
                ${obj.isLocked ? '<span class="lock-icon">&#128274;</span>' : ''}
            </div>
        `;
    }).join('');

    layerList.querySelectorAll('.layer-item').forEach(item => {
        item.onclick = () => {
            const id = parseInt(item.dataset.id);
            selectionSystem.selectObject(id);
            render();
        };
    });

    document.getElementById('object-count').textContent = objects.length;
}

function getTypeIcon(type) {
    const icons = {
        stroke: '&#9999;&#65039;',
        rectangle: '&#11036;',
        ellipse: '&#11093;',
        line: '&#128207;',
        arrow: '&#10145;&#65039;',
        stickyNote: '&#128221;',
        text: 'T'
    };
    return icons[type] || '?';
}

function getObjectName(obj) {
    const prefix = obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
    const isOwner = obj.creator?.toLowerCase() === myAddress?.toLowerCase();
    const ownerMark = isOwner ? '' : ' &#128274;';
    if (obj.content) {
        return `${prefix}: ${obj.content.slice(0, 10)}${ownerMark}`;
    }
    return `${prefix} #${obj.id}${ownerMark}`;
}

function setupDraggablePanels() {
    const panels = document.querySelectorAll('.draggable-panel');

    panels.forEach(panel => {
        const header = panel.querySelector('.panel-header');
        const collapseBtn = panel.querySelector('.collapse-btn');
        const contentId = collapseBtn?.dataset.target;
        const content = document.getElementById(contentId);

        if (collapseBtn && content) {
            collapseBtn.onclick = (e) => {
                e.stopPropagation();
                content.classList.toggle('collapsed');
                collapseBtn.textContent = content.classList.contains('collapsed') ? '+' : '−';
            };
        }

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target === collapseBtn) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.style.transition = '';
            }
        });
    });
}

function updateStats() {
    document.getElementById('tx-sent').textContent = stats.txSent;
}

// ===== Mouse Events =====
function handleMouseDown(e) {
    const { x, y } = getCanvasPoint(e);

    if (currentTool === 'select') {
        handleSelectMouseDown(x, y, e);
    } else if (currentTool === 'pen') {
        handlePenMouseDown(x, y);
    } else if (currentTool === 'eraser') {
        handleEraserMouseDown(x, y);
    } else if (['rect', 'ellipse', 'line', 'arrow'].includes(currentTool)) {
        handleShapeMouseDown(x, y);
    } else if (currentTool === 'sticky') {
        handleStickyCreate(x, y);
    } else if (currentTool === 'text') {
        showTextInput(e.clientX, e.clientY, x, y);
    }
}

let lastCursorSend = 0;
const CURSOR_SEND_INTERVAL = 100;

function handleMouseMove(e) {
    const { x, y } = getCanvasPoint(e);

    if (sessionContract && Date.now() - lastCursorSend > CURSOR_SEND_INTERVAL) {
        lastCursorSend = Date.now();
        sendCursorPosition(x, y);
    }

    if (currentTool === 'select' && selectionSystem.transformMode) {
        selectionSystem.updateTransform({ x, y });
        render();
    } else if (currentTool === 'eraser') {
        handleEraserMouseMove(x, y);
    } else if (isDrawing) {
        if (currentTool === 'pen') {
            handlePenMouseMove(x, y);
        } else if (['rect', 'ellipse', 'line', 'arrow'].includes(currentTool)) {
            handleShapeMouseMove(x, y);
        }
    }
}

function handleMouseUp(e) {
    const { x, y } = getCanvasPoint(e);

    if (currentTool === 'select' && selectionSystem.transformMode) {
        handleSelectMouseUp();
    } else if (isDrawing) {
        if (currentTool === 'pen') {
            handlePenMouseUp();
        } else if (currentTool === 'eraser') {
            handleEraserMouseUp();
        } else if (['rect', 'ellipse', 'line', 'arrow'].includes(currentTool)) {
            handleShapeMouseUp(x, y);
        }
    }

    isDrawing = false;
}

function handleDoubleClick(e) {
    const { x, y } = getCanvasPoint(e);
    const obj = objectManager.getObjectAtPoint(x, y);

    if (obj && obj.type === 'stickyNote') {
        showStickyEditor(obj);
    }
}

function getCanvasPoint(e) {
    const rect = mainCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// ===== Select Tool =====
function handleSelectMouseDown(x, y, e) {
    const handle = selectionSystem.getHandleAtPoint(x, y);

    if (handle) {
        const selectedObjs = selectionSystem.getSelectedObjects();
        const canTransform = selectedObjs.every(obj =>
            obj.creator?.toLowerCase() === myAddress?.toLowerCase()
        );
        if (canTransform) {
            selectionSystem.startTransform('resize-' + handle, { x, y });
        } else {
            log('You can only modify your own objects', 'error');
        }
    } else if (selectionSystem.isPointInSelection(x, y)) {
        const selectedObjs = selectionSystem.getSelectedObjects();
        const canTransform = selectedObjs.every(obj =>
            obj.creator?.toLowerCase() === myAddress?.toLowerCase()
        );
        if (canTransform) {
            selectionSystem.startTransform('move', { x, y });
        } else {
            log('You can only move your own objects', 'error');
        }
    } else {
        const obj = objectManager.getObjectAtPoint(x, y);
        if (obj) {
            selectionSystem.selectObject(obj.id, e.shiftKey);
            if (obj.creator?.toLowerCase() === myAddress?.toLowerCase()) {
                selectionSystem.startTransform('move', { x, y });
            }
        } else {
            selectionSystem.deselectAll();
        }
        render();
    }
}

function handleSelectMouseUp() {
    const result = selectionSystem.endTransform();

    if (result.mode && result.objects.length > 0 && sessionContract) {
        for (const obj of result.objects) {
            if (obj.bounds && obj.id >= 0) {
                if (result.mode === 'move') {
                    sendMoveObject(obj.id, obj.bounds.x, obj.bounds.y);
                } else if (result.mode.startsWith('resize')) {
                    sendMoveObject(obj.id, obj.bounds.x, obj.bounds.y);
                    sendResizeObject(obj.id, obj.bounds.width, obj.bounds.height);
                }
            }
        }
    }

    render();
}

// ===== Pen Tool =====
let strokeStreamTimer = null;
const STREAM_INTERVAL = 100;
const MIN_POINTS_TO_STREAM = 6;

function handlePenMouseDown(x, y) {
    isDrawing = true;
    lastPoint = { x, y };
    strokePoints = [x, y];

    if (sessionContract) {
        strokeStreamTimer = setInterval(() => {
            streamStrokePoints();
        }, STREAM_INTERVAL);
    }
}

function handlePenMouseMove(x, y) {
    if (!lastPoint) return;

    mainCtx.beginPath();
    mainCtx.moveTo(lastPoint.x, lastPoint.y);
    mainCtx.lineTo(x, y);
    mainCtx.strokeStyle = currentColor;
    mainCtx.lineWidth = brushSize;
    mainCtx.lineCap = 'round';
    mainCtx.lineJoin = 'round';
    mainCtx.stroke();

    strokePoints.push(x, y);
    lastPoint = { x, y };
}

function streamStrokePoints() {
    if (strokePoints.length >= MIN_POINTS_TO_STREAM && sessionContract) {
        const colorIdx = currentColorIndex;
        const width = brushSize;
        const pointsToSend = [...strokePoints];

        const obj = {
            id: objectManager.generateLocalId(),
            type: 'stroke',
            creator: myAddress,
            colorIndex: colorIdx,
            strokeWidth: width,
            layer: objectManager.objects.size + 1,
            points: pointsToSend,
            bounds: objectManager.calculateStrokeBounds(pointsToSend)
        };

        objectManager.addObject(obj);
        stats.objects++;

        sendCreateStroke(pointsToSend, colorIdx, width, obj.id);

        const lastX = strokePoints[strokePoints.length - 2];
        const lastY = strokePoints[strokePoints.length - 1];
        strokePoints = [lastX, lastY];
    }
}

function handlePenMouseUp() {
    if (strokeStreamTimer) {
        clearInterval(strokeStreamTimer);
        strokeStreamTimer = null;
    }

    if (strokePoints.length >= 4) {
        const colorIdx = currentColorIndex;
        const width = brushSize;

        const obj = {
            id: objectManager.generateLocalId(),
            type: 'stroke',
            creator: myAddress,
            colorIndex: colorIdx,
            strokeWidth: width,
            layer: objectManager.objects.size + 1,
            points: [...strokePoints],
            bounds: objectManager.calculateStrokeBounds(strokePoints)
        };

        objectManager.addObject(obj);
        stats.objects++;

        if (sessionContract) {
            sendCreateStroke(strokePoints, colorIdx, width, obj.id);
        }

        render();
    }

    strokePoints = [];
    lastPoint = null;
}

// ===== Eraser Tool =====
let erasedObjects = new Set();
const ERASER_RADIUS = 25;

function handleEraserMouseDown(x, y) {
    isDrawing = true;
    erasedObjects.clear();
    eraseAtPoint(x, y);
}

function handleEraserMouseMove(x, y) {
    render();
    mainCtx.beginPath();
    mainCtx.arc(x, y, ERASER_RADIUS, 0, Math.PI * 2);
    mainCtx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    mainCtx.lineWidth = 2;
    mainCtx.stroke();

    if (!isDrawing) return;
    eraseAtPoint(x, y);
}

function handleEraserMouseUp() {
    erasedObjects.clear();
}

function eraseAtPoint(x, y) {
    const objects = objectManager.getObjectsInLayerOrder();

    for (const obj of objects) {
        if (erasedObjects.has(obj.id)) continue;

        const isNear = isPointNearObject(x, y, obj, ERASER_RADIUS);
        if (isNear) {
            erasedObjects.add(obj.id);
            objectManager.deleteObject(obj.id);
            log(`Erased ${obj.type} #${obj.id}`, 'event');

            if (sessionContract && obj.id >= 0) {
                sendDeleteObject(obj.id);
            }

            render();
        }
    }
}

function isPointNearObject(px, py, obj, radius) {
    if (!obj.bounds) return false;

    if (obj.type === 'stroke' && obj.points) {
        for (let i = 0; i < obj.points.length - 2; i += 2) {
            const x1 = obj.points[i];
            const y1 = obj.points[i + 1];
            const x2 = obj.points[i + 2];
            const y2 = obj.points[i + 3];

            if (pointToLineDistance(px, py, x1, y1, x2, y2) < radius + (obj.strokeWidth || 2)) {
                return true;
            }
        }
        return false;
    } else {
        const b = obj.bounds;
        return px >= b.x - radius && px <= b.x + b.width + radius &&
               py >= b.y - radius && py <= b.y + b.height + radius;
    }
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// ===== Shape Tool =====
function handleShapeMouseDown(x, y) {
    isDrawing = true;
    shapeStart = { x, y };
}

function handleShapeMouseMove(x, y) {
    if (!shapeStart) return;

    canvasRenderer.render();

    mainCtx.strokeStyle = currentColor;
    mainCtx.lineWidth = brushSize;

    const w = x - shapeStart.x;
    const h = y - shapeStart.y;

    if (currentTool === 'rect') {
        mainCtx.strokeRect(shapeStart.x, shapeStart.y, w, h);
    } else if (currentTool === 'ellipse') {
        mainCtx.beginPath();
        mainCtx.ellipse(
            shapeStart.x + w / 2,
            shapeStart.y + h / 2,
            Math.abs(w / 2),
            Math.abs(h / 2),
            0, 0, Math.PI * 2
        );
        mainCtx.stroke();
    } else if (currentTool === 'line') {
        mainCtx.beginPath();
        mainCtx.moveTo(shapeStart.x, shapeStart.y);
        mainCtx.lineTo(x, y);
        mainCtx.stroke();
    } else if (currentTool === 'arrow') {
        drawArrow(mainCtx, shapeStart.x, shapeStart.y, x, y);
    }
}

function handleShapeMouseUp(x, y) {
    if (!shapeStart) return;

    const w = x - shapeStart.x;
    const h = y - shapeStart.y;

    if (Math.abs(w) < 5 && Math.abs(h) < 5) {
        shapeStart = null;
        render();
        return;
    }

    const typeMap = {
        rect: 'rectangle',
        ellipse: 'ellipse',
        line: 'line',
        arrow: 'arrow'
    };

    const obj = {
        id: objectManager.generateLocalId(),
        type: typeMap[currentTool],
        creator: myAddress,
        colorIndex: currentColorIndex,
        strokeWidth: brushSize,
        layer: objectManager.objects.size + 1,
        bounds: {
            x: Math.min(shapeStart.x, x),
            y: Math.min(shapeStart.y, y),
            width: Math.abs(w),
            height: Math.abs(h)
        },
        rotation: 0
    };

    objectManager.addObject(obj);
    stats.objects++;

    if (sessionContract) {
        const shapeTypeNum = CONFIG.objectTypes.indexOf(obj.type);
        sendCreateShape(shapeTypeNum, obj.bounds, 0, currentColorIndex, brushSize, obj.id);
    }

    shapeStart = null;
    render();
}

function drawArrow(ctx, x1, y1, x2, y2) {
    const headLen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
}

// ===== Sticky Note =====
function handleStickyCreate(x, y) {
    const obj = {
        id: objectManager.generateLocalId(),
        type: 'stickyNote',
        creator: myAddress,
        colorIndex: 0,
        bgColorIndex: 0,
        strokeWidth: 0,
        layer: objectManager.objects.size + 1,
        bounds: { x, y, width: 200, height: 150 },
        content: '',
        isNew: true
    };

    objectManager.addObject(obj);
    stats.objects++;
    render();
    showStickyEditor(obj);
}

function showStickyEditor(obj) {
    editingStickyId = obj.id;

    const overlay = document.createElement('div');
    overlay.className = 'sticky-editor';
    overlay.id = 'sticky-editor-overlay';
    overlay.style.left = obj.bounds.x + 'px';
    overlay.style.top = obj.bounds.y + 'px';
    overlay.style.width = obj.bounds.width + 'px';
    overlay.style.height = obj.bounds.height + 'px';

    const bgColor = CONFIG.stickyColors[obj.bgColorIndex || 0];

    overlay.innerHTML = `
        <div class="sticky-editor-container" style="background:${bgColor};width:100%;height:100%;">
            <div class="sticky-color-picker">
                ${CONFIG.stickyColors.map((c, i) => `
                    <button class="sticky-color-opt ${i === (obj.bgColorIndex || 0) ? 'active' : ''}"
                            data-index="${i}" style="background:${c}"></button>
                `).join('')}
            </div>
            <textarea class="sticky-textarea">${obj.content || ''}</textarea>
        </div>
    `;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('.sticky-textarea');
    let isClosing = false;
    let currentBgIdx = obj.bgColorIndex || 0;

    textarea.focus();

    overlay.querySelectorAll('.sticky-color-opt').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = parseInt(btn.dataset.index);
            overlay.querySelector('.sticky-editor-container').style.background = CONFIG.stickyColors[idx];
            overlay.querySelectorAll('.sticky-color-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentBgIdx = idx;
            obj.bgColorIndex = idx;
        });
    });

    function closeEditor() {
        if (isClosing) return;
        isClosing = true;

        const content = textarea.value;
        const localObj = objectManager.getObject(obj.id);

        if (localObj) {
            localObj.content = content;
            localObj.bgColorIndex = currentBgIdx;
        }
        obj.content = content;
        obj.bgColorIndex = currentBgIdx;

        if (sessionContract) {
            const realObj = localObj || obj;
            const currentId = realObj.id;

            if (obj.isNew || realObj.isNew) {
                sendCreateStickyNote(obj.bounds.x, obj.bounds.y, obj.bounds.width, obj.bounds.height, content, currentBgIdx, obj.id);
                obj.isNew = false;
                if (localObj) localObj.isNew = false;
            } else if (currentId >= 0) {
                sendUpdateStickyNote(currentId, content);
            }
        }

        overlay.remove();
        editingStickyId = null;
        render();
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeEditor();
        }
    });

    textarea.addEventListener('blur', () => {
        setTimeout(() => {
            if (!isClosing && !document.activeElement?.closest('.sticky-editor')) {
                closeEditor();
            }
        }, 150);
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditor();
        }
    });
}

// ===== Text Tool =====
function showTextInput(clientX, clientY, canvasX, canvasY) {
    const overlay = document.getElementById('text-input-overlay');
    overlay.style.left = clientX + 'px';
    overlay.style.top = clientY + 'px';
    overlay.classList.add('active');
    overlay.dataset.canvasX = canvasX;
    overlay.dataset.canvasY = canvasY;

    const input = document.getElementById('text-input');
    input.value = '';
    input.focus();
}

function hideTextInput() {
    document.getElementById('text-input-overlay').classList.remove('active');
}

function handleTextInput(e) {
    if (e.key === 'Enter') {
        const overlay = document.getElementById('text-input-overlay');
        const text = document.getElementById('text-input').value;
        const x = parseInt(overlay.dataset.canvasX);
        const y = parseInt(overlay.dataset.canvasY);

        if (text) {
            const fontSize = brushSize * 5;
            const metrics = mainCtx.measureText(text);

            const obj = {
                id: objectManager.generateLocalId(),
                type: 'text',
                creator: myAddress,
                colorIndex: currentColorIndex,
                strokeWidth: Math.min(72, Math.max(8, brushSize * 3)),
                layer: objectManager.objects.size + 1,
                bounds: { x, y, width: metrics.width || 100, height: fontSize },
                content: text
            };

            objectManager.addObject(obj);
            stats.objects++;

            if (sessionContract) {
                sendCreateText(x, y, text, currentColorIndex, obj.strokeWidth, obj.id);
            }

            render();
        }

        hideTextInput();
    } else if (e.key === 'Escape') {
        hideTextInput();
    }
}

// ===== Keyboard Events =====
function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
        case 'Delete':
        case 'Backspace':
            deleteSelectedObjects();
            break;
        case 'v':
        case 'V':
            selectTool('select', document.querySelector('[data-tool="select"]'));
            break;
        case 'p':
        case 'P':
            selectTool('pen', document.querySelector('[data-tool="pen"]'));
            break;
        case 'e':
        case 'E':
            selectTool('eraser', document.querySelector('[data-tool="eraser"]'));
            break;
        case 'r':
        case 'R':
            selectTool('rect', document.querySelector('[data-tool="rect"]'));
            break;
        case 'o':
        case 'O':
            selectTool('ellipse', document.querySelector('[data-tool="ellipse"]'));
            break;
        case 'l':
        case 'L':
            selectTool('line', document.querySelector('[data-tool="line"]'));
            break;
        case 'a':
        case 'A':
            if (!e.ctrlKey && !e.metaKey) {
                selectTool('arrow', document.querySelector('[data-tool="arrow"]'));
            }
            break;
        case 's':
        case 'S':
            if (!e.ctrlKey && !e.metaKey) {
                selectTool('sticky', document.querySelector('[data-tool="sticky"]'));
            }
            break;
        case 't':
        case 'T':
            selectTool('text', document.querySelector('[data-tool="text"]'));
            break;
        case 'Escape':
            selectionSystem.deselectAll();
            render();
            break;
    }
}

function deleteSelectedObjects() {
    const selected = selectionSystem.getSelectedObjects();
    for (const obj of selected) {
        objectManager.deleteObject(obj.id);
        if (sessionContract && obj.id >= 0) {
            sendDeleteObject(obj.id);
        }
    }
    selectionSystem.deselectAll();
    render();
}

// ===== Layer Actions =====
function handleLayerAction(action) {
    const selected = selectionSystem.getSelectedObjects();
    if (selected.length === 0) return;

    for (const obj of selected) {
        if (action === 'front') {
            if (sessionContract && obj.id >= 0) sendBringToFront(obj.id);
            else if (obj.id < 0) log('Object pending - wait for confirmation', 'error');
        } else if (action === 'back') {
            if (sessionContract && obj.id >= 0) sendSendToBack(obj.id);
            else if (obj.id < 0) log('Object pending - wait for confirmation', 'error');
        } else if (action === 'lock') {
            obj.isLocked = !obj.isLocked;
            if (sessionContract && obj.id >= 0) sendToggleLock(obj.id);
        } else if (action === 'delete') {
            objectManager.deleteObject(obj.id);
            if (sessionContract && obj.id >= 0) {
                sendDeleteObject(obj.id);
                log(`Deleted object #${obj.id}`, 'tx');
            } else if (obj.id < 0) {
                log('Local object deleted (not yet on chain)', 'event');
            }
        }
    }

    if (action === 'delete') {
        selectionSystem.deselectAll();
    }
    render();
}

// ===== Canvas Clear =====
async function clearCanvas() {
    if (sessionContract) {
        try {
            await sessionContract.clearCanvas({ gasLimit: 100000 });
            stats.txSent++;
            log('Canvas cleared', 'tx');
        } catch (error) {
            log(`Clear error: ${error.message}`, 'error');
        }
    }

    objectManager.clear();
    selectionSystem.deselectAll();
    render();
}

// ===== On-chain Functions =====
async function sendCreateStroke(points, colorIndex, strokeWidth, localId) {
    if (!sessionContract) return;

    try {
        const intPoints = points.map(p => Math.round(p));
        const tx = await sessionContract.createStroke(intPoints, colorIndex, strokeWidth, { gasLimit: 500000 });
        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'ObjectCreated');
        if (event) {
            const realId = event.args.objectId.toNumber();
            updateLocalIdToRealId(localId, realId);
        }

        stats.txSent++;
        log(`Stroke created`, 'tx');
    } catch (error) {
        log(`Stroke error: ${error.message}`, 'error');
    }
}

async function sendCreateShape(shapeType, bounds, rotation, colorIndex, strokeWidth, localId) {
    if (!sessionContract) return;

    try {
        const tx = await sessionContract.createShape(
            shapeType,
            Math.round(bounds.x),
            Math.round(bounds.y),
            Math.round(bounds.width),
            Math.round(bounds.height),
            rotation,
            colorIndex,
            strokeWidth,
            { gasLimit: 300000 }
        );
        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'ObjectCreated');
        if (event) {
            const realId = event.args.objectId.toNumber();
            updateLocalIdToRealId(localId, realId);
        }

        stats.txSent++;
        log(`Shape created`, 'tx');
    } catch (error) {
        log(`Shape error: ${error.message}`, 'error');
    }
}

async function sendCreateStickyNote(x, y, width, height, content, bgColorIndex, localId) {
    if (!sessionContract) return;

    try {
        const tx = await sessionContract.createStickyNote(
            Math.round(x), Math.round(y),
            Math.round(width), Math.round(height),
            content, bgColorIndex,
            { gasLimit: 300000 }
        );
        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'ObjectCreated');
        if (event) {
            const realId = event.args.objectId.toNumber();
            updateLocalIdToRealId(localId, realId);
        }

        stats.txSent++;
        log(`Sticky note created`, 'tx');
    } catch (error) {
        log(`Sticky note error: ${error.message}`, 'error');
    }
}

async function sendCreateText(x, y, content, colorIndex, fontSize, localId) {
    if (!sessionContract) return;

    try {
        const tx = await sessionContract.createText(
            Math.round(x), Math.round(y),
            content, colorIndex, fontSize,
            { gasLimit: 300000 }
        );
        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'ObjectCreated');
        if (event) {
            const realId = event.args.objectId.toNumber();
            updateLocalIdToRealId(localId, realId);
        }

        stats.txSent++;
        log(`Text created`, 'tx');
    } catch (error) {
        log(`Text error: ${error.message}`, 'error');
    }
}

async function sendMoveObject(objectId, newX, newY) {
    if (!sessionContract) return;

    try {
        await sessionContract.moveObject(objectId, Math.round(newX), Math.round(newY), { gasLimit: 150000 });
        stats.txSent++;
    } catch (error) {
        log(`Move error: ${error.message}`, 'error');
    }
}

async function sendResizeObject(objectId, newWidth, newHeight) {
    if (!sessionContract) return;

    try {
        await sessionContract.resizeObject(objectId, Math.round(newWidth), Math.round(newHeight), { gasLimit: 150000 });
        stats.txSent++;
    } catch (error) {
        log(`Resize error: ${error.message}`, 'error');
    }
}

async function sendDeleteObject(objectId) {
    if (!sessionContract) return;

    try {
        await sessionContract.deleteObject(objectId, { gasLimit: 100000 });
        stats.txSent++;
        log(`Object deleted`, 'tx');
    } catch (error) {
        log(`Delete error: ${error.message}`, 'error');
    }
}

async function sendUpdateStickyNote(objectId, content) {
    if (!sessionContract) return;

    try {
        const tx = await sessionContract.updateStickyNote(objectId, content, { gasLimit: 200000 });
        await tx.wait();
        stats.txSent++;
    } catch (error) {
        log(`Update error: ${error.message}`, 'error');
    }
}

async function sendCursorPosition(x, y) {
    if (!sessionContract) return;

    try {
        sessionContract.moveCursor(Math.round(x), Math.round(y), { gasLimit: 50000 })
            .catch(() => {});
    } catch (error) {
        // Ignore
    }
}

async function sendBringToFront(objectId) {
    if (!sessionContract) return;

    try {
        await sessionContract.bringToFront(objectId, { gasLimit: 100000 });
        stats.txSent++;
    } catch (error) {
        log(`Layer error: ${error.message}`, 'error');
    }
}

async function sendSendToBack(objectId) {
    if (!sessionContract) return;

    try {
        await sessionContract.sendToBack(objectId, { gasLimit: 100000 });
        stats.txSent++;
    } catch (error) {
        log(`Layer error: ${error.message}`, 'error');
    }
}

async function sendToggleLock(objectId) {
    if (!sessionContract) return;

    try {
        await sessionContract.toggleLock(objectId, { gasLimit: 100000 });
        stats.txSent++;
    } catch (error) {
        log(`Lock error: ${error.message}`, 'error');
    }
}

function updateLocalIdToRealId(localId, realId) {
    const obj = objectManager.objects.get(localId);
    if (obj) {
        objectManager.objects.delete(localId);
        obj.id = realId;
        objectManager.objects.set(realId, obj);
        objectManager._updateLayerOrder();

        if (selectionSystem.selectedIds.has(localId)) {
            selectionSystem.selectedIds.delete(localId);
            selectionSystem.selectedIds.add(realId);
        }

        render();
    }
}

// ===== Wallet Connection =====
async function connectWallet() {
    try {
        const accountSelect = document.getElementById('account-select');
        const selectedValue = accountSelect.value;
        const pkInput = document.getElementById('pk-input').value.trim();
        let privateKey;
        let accountLabel;

        if (selectedValue === 'custom') {
            if (!pkInput) {
                log('Please enter a private key', 'error');
                return;
            }
            privateKey = pkInput.startsWith('0x') ? pkInput : '0x' + pkInput;
            accountLabel = 'Custom';
            log('Connecting with custom private key...');
        } else {
            const accountIndex = parseInt(selectedValue);
            privateKey = ANVIL_ACCOUNTS[accountIndex];
            accountLabel = `Anvil #${accountIndex}`;
            log(`Connecting with ${accountLabel}...`);
        }

        document.getElementById('connect-btn').disabled = true;

        provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
        signer = new ethers.Wallet(privateKey, provider);
        myAddress = signer.address;

        document.getElementById('connection-status').textContent = `Connected (${accountLabel})`;
        document.getElementById('connection-status').classList.add('connected');
        document.getElementById('my-address').textContent = `${myAddress.slice(0, 6)}...${myAddress.slice(-4)}`;
        document.getElementById('connect-btn').style.display = 'none';
        document.getElementById('disconnect-btn').style.display = 'block';
        document.getElementById('account-select').style.display = 'none';
        document.getElementById('pk-input').style.display = 'none';
        document.getElementById('deploy-btn').disabled = false;

        log(`Connected: ${myAddress}`, 'tx');

        const savedContract = localStorage.getItem('collaborationContract');
        if (savedContract) {
            document.getElementById('contract-input').value = savedContract;
        }

    } catch (error) {
        log(`Connection error: ${error.message}`, 'error');
        document.getElementById('connect-btn').disabled = false;
    }
}

function disconnectWallet() {
    provider = null;
    signer = null;
    myAddress = null;
    contract = null;
    sessionContract = null;
    contractAddress = null;

    document.getElementById('connection-status').textContent = 'Disconnected';
    document.getElementById('connection-status').classList.remove('connected');
    document.getElementById('my-address').textContent = '';
    document.getElementById('connect-btn').style.display = 'block';
    document.getElementById('connect-btn').disabled = false;
    document.getElementById('disconnect-btn').style.display = 'none';
    document.getElementById('account-select').style.display = 'block';
    document.getElementById('account-select').value = '0';
    document.getElementById('pk-input').style.display = 'none';
    document.getElementById('pk-input').value = '';
    document.getElementById('deploy-btn').disabled = true;
    document.getElementById('deploy-btn').textContent = 'Setup Contract';
    document.getElementById('join-btn').disabled = true;

    log('Disconnected. Select an account to connect.', 'tx');
}

// ===== BoardRegistry Functions =====
async function openBoardModal() {
    document.getElementById('contract-modal').classList.add('active');
    await loadBoardList();
}

async function loadBoardList() {
    const boardListDiv = document.getElementById('board-list');
    boardListDiv.innerHTML = '<div class="board-list-loading">Loading boards...</div>';

    if (!registryAddress) {
        boardListDiv.innerHTML = `
            <div class="board-list-loading">
                <p>No BoardRegistry configured.</p>
                <p class="modal-section-title" style="margin-top:8px;">Enter registry address:</p>
                <input type="text" id="registry-input" placeholder="0x... (BoardRegistry address)">
                <button class="btn secondary" id="set-registry-btn" style="margin-top:8px;width:100%;">Set Registry</button>
            </div>`;

        document.getElementById('set-registry-btn').onclick = async () => {
            const addr = document.getElementById('registry-input').value.trim();
            if (addr && ethers.utils.isAddress(addr)) {
                registryAddress = addr;
                localStorage.setItem('boardRegistryAddress', registryAddress);
                log(`Registry set: ${registryAddress.slice(0, 10)}...`, 'tx');
                await loadBoardList();
            } else {
                alert('Enter valid address!');
            }
        };
        return;
    }

    try {
        registryContract = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
        const boards = await registryContract.getAllBoards();

        if (boards.length === 0) {
            boardListDiv.innerHTML = `
                <div class="board-list-loading">
                    No boards yet. Create one below!
                </div>`;
        } else {
            boardListDiv.innerHTML = boards.map((board, index) => {
                const date = new Date(Number(board.createdAt) * 1000).toLocaleDateString();
                const creatorShort = `${board.creator.slice(0, 6)}...${board.creator.slice(-4)}`;
                const deleteMode = board.allowAnyoneDelete ? 'Anyone can delete' : 'Owner only';
                const badgeClass = board.allowAnyoneDelete ? 'badge-warning' : 'badge-success';
                return `
                    <div class="board-item" data-address="${board.boardAddress}">
                        <div>
                            <div class="board-item-name">${board.name || 'Untitled Board'}</div>
                            <div class="board-item-meta">By ${creatorShort} &bull; ${date}</div>
                        </div>
                        <span class="board-badge ${badgeClass}">${deleteMode}</span>
                    </div>`;
            }).join('');

            boardListDiv.querySelectorAll('.board-item').forEach(item => {
                item.addEventListener('click', () => {
                    const addr = item.dataset.address;
                    selectBoard(addr);
                });
            });
        }

    } catch (error) {
        log(`Failed to load boards: ${error.message}`, 'error');
        boardListDiv.innerHTML = `
            <div class="board-list-error">
                Failed to load boards. Check registry address.
                <button class="btn secondary" id="reset-registry-btn" style="margin-top:12px;width:100%;">Reset Registry</button>
            </div>`;

        document.getElementById('reset-registry-btn').onclick = () => {
            localStorage.removeItem('boardRegistryAddress');
            registryAddress = '';
            loadBoardList();
        };
    }
}

async function createBoard() {
    const nameInput = document.getElementById('new-board-name');
    const name = nameInput.value.trim();
    const allowAnyoneDelete = document.getElementById('allow-anyone-delete').checked;

    if (!name) {
        alert('Enter a board name!');
        return;
    }

    if (!registryContract) {
        alert('Registry not connected!');
        return;
    }

    const createBtn = document.getElementById('create-board-btn');
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
        log(`Creating board: ${name} (delete: ${allowAnyoneDelete ? 'anyone' : 'owner only'})...`);
        const tx = await registryContract.createBoard(name, allowAnyoneDelete);
        const receipt = await tx.wait();

        const event = receipt.events?.find(e => e.event === 'BoardCreated');
        if (event) {
            const boardAddress = event.args.boardAddress;
            log(`Board created: ${boardAddress}`, 'tx');
            nameInput.value = '';
            await loadBoardList();
            selectBoard(boardAddress);
        } else {
            log('Board created!', 'tx');
            await loadBoardList();
        }

    } catch (error) {
        log(`Create failed: ${error.message}`, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Create';
    }
}

function resetBoardState() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }

    objectManager = new ObjectManager();
    selectionSystem = new SelectionSystem(objectManager);
    canvasRenderer = new CanvasRenderer(mainCanvas, objectManager);

    cursors.forEach((data, addr) => {
        if (data.element) data.element.remove();
    });
    cursors.clear();

    document.getElementById('users').innerHTML = '';
    document.getElementById('user-count').textContent = '0';

    isJoined = false;
    sessionContract = null;
    stats = { txSent: 0, objects: 0 };

    document.getElementById('join-btn').disabled = true;
    document.getElementById('join-btn').textContent = 'Join Room';

    render();
    log('Board state reset', 'tx');
}

async function selectBoard(boardAddress) {
    if (!boardAddress || !ethers.utils.isAddress(boardAddress)) {
        alert('Invalid board address!');
        return;
    }

    resetBoardState();

    contractAddress = boardAddress;
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

    try {
        const version = await contract.canvasVersion();
        log(`Selected board (version ${version})`, 'tx');
        localStorage.setItem('collaborationContract', contractAddress);

        document.getElementById('contract-modal').classList.remove('active');
        document.getElementById('deploy-btn').textContent = 'Board Selected';

        showNicknameModal();

    } catch (error) {
        log(`Invalid board: ${error.message}`, 'error');
    }
}

async function useExistingContract() {
    const address = document.getElementById('contract-input').value.trim();
    if (!address || !ethers.utils.isAddress(address)) {
        alert('Enter valid contract address!');
        return;
    }

    contractAddress = address;
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

    try {
        const version = await contract.canvasVersion();
        log(`Connected to contract (version ${version})`, 'tx');
        localStorage.setItem('collaborationContract', contractAddress);

        document.getElementById('contract-modal').classList.remove('active');
        document.getElementById('deploy-btn').textContent = 'Contract Ready';
        document.getElementById('join-btn').disabled = false;

    } catch (error) {
        log(`Invalid contract: ${error.message}`, 'error');
    }
}

function showNicknameModal() {
    const modal = document.getElementById('nickname-modal');
    const input = document.getElementById('nickname-input');
    const preview = document.getElementById('nickname-preview-text');

    const savedNickname = localStorage.getItem('userNickname');
    const defaultNickname = savedNickname || `Designer_${myAddress.slice(-4)}`;
    input.value = defaultNickname;
    preview.textContent = defaultNickname;

    modal.classList.add('active');
    input.focus();
    input.select();
}

function hideNicknameModal() {
    document.getElementById('nickname-modal').classList.remove('active');
}

async function joinSession() {
    const joinBtn = document.getElementById('join-btn');

    try {
        joinBtn.disabled = true;
        joinBtn.innerHTML = '<span class="spinner"></span> Joining...';

        sessionContract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

        let nickname = userNickname || `Designer_${myAddress.slice(-4)}`;

        try {
            const userInfo = await sessionContract.getUserInfo(myAddress);
            if (userInfo.isActive) {
                const storedNickname = userInfo.nickname;
                if (userNickname && userNickname !== storedNickname) {
                    log(`Updating nickname to ${userNickname}...`);
                    const tx = await sessionContract.updateNickname(userNickname);
                    await tx.wait();
                    stats.txSent++;
                    nickname = userNickname;
                } else {
                    nickname = storedNickname || nickname;
                }
                log(`Reconnected as ${nickname}`, 'tx');
            } else {
                log(`Joining as ${nickname}...`);
                const tx = await sessionContract.join(nickname);
                await tx.wait();
                stats.txSent++;
            }
        } catch (e) {
            log(`Joining as ${nickname}...`);
            const tx = await sessionContract.join(nickname);
            await tx.wait();
            stats.txSent++;
        }

        isJoined = true;

        document.getElementById('my-address').textContent = `${myAddress.slice(0, 6)}...${myAddress.slice(-4)}`;
        createCursor(myAddress, nickname);

        log('Loading existing drawings...');
        await loadInitialState();

        startEventPolling();

        joinBtn.textContent = 'Joined!';
        log('Joined! Start collaborating.', 'tx');

    } catch (error) {
        log(`Join error: ${error.message}`, 'error');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Room';
    }
}

// ===== Cursor Management =====
function getColorForAddress(address) {
    const index = parseInt(address.slice(-4), 16) % CONFIG.cursorColors.length;
    return CONFIG.cursorColors[index];
}

function createCursor(address, nickname) {
    const addr = address.toLowerCase();

    if (cursors.has(addr)) {
        const existing = cursors.get(addr);
        if (existing.nickname !== nickname) {
            existing.nickname = nickname;
            const label = existing.element.querySelector('.cursor-label');
            if (label) label.textContent = nickname;
            updateUserList();
        }
        return;
    }

    const color = getColorForAddress(address);
    const cursor = document.createElement('div');
    cursor.className = 'remote-cursor';
    cursor.style.setProperty('--cursor-color', color);
    cursor.innerHTML = `
        <div class="cursor-pointer"></div>
        <div class="cursor-label">${nickname}</div>
    `;

    cursorLayer.appendChild(cursor);
    cursors.set(addr, { element: cursor, nickname, color });
    updateUserList();
}

function updateRemoteCursor(address, x, y) {
    const addr = address.toLowerCase();
    const cursorData = cursors.get(addr);

    if (!cursorData) {
        createCursor(address, `User_${address.slice(-4)}`);
        return updateRemoteCursor(address, x, y);
    }

    const posX = typeof x === 'object' ? x.toNumber() : x;
    const posY = typeof y === 'object' ? y.toNumber() : y;

    cursorData.element.style.left = posX + 'px';
    cursorData.element.style.top = posY + 'px';
    cursorData.element.style.display = 'block';
}

function updateUserList() {
    const usersEl = document.getElementById('users');
    usersEl.innerHTML = '';
    document.getElementById('user-count').textContent = cursors.size;

    cursors.forEach((cursor, address) => {
        const isMe = address.toLowerCase() === myAddress?.toLowerCase();
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div class="user-dot" style="background: ${cursor.color}"></div>
            <div class="user-name">${cursor.nickname}${isMe ? ' (me)' : ''}</div>
        `;
        usersEl.appendChild(item);
    });
}

// ===== Load Initial State =====
async function loadInitialState() {
    try {
        const currentBlock = await provider.getBlockNumber();

        const clearEvents = await contract.queryFilter(
            contract.filters.CanvasCleared(),
            0, currentBlock
        );

        let fromBlock = 0;
        if (clearEvents.length > 0) {
            fromBlock = clearEvents[clearEvents.length - 1].blockNumber;
            log(`Loading from block ${fromBlock} (after canvas clear)`);
        }

        const deletedIds = new Set();
        const deletedEvents = await contract.queryFilter(
            contract.filters.ObjectDeleted(),
            fromBlock, currentBlock
        );
        for (const event of deletedEvents) {
            deletedIds.add(event.args.objectId.toNumber());
        }

        // Load StrokePoints
        const strokeEvents = await contract.queryFilter(
            contract.filters.StrokePoints(),
            fromBlock, currentBlock
        );

        for (const event of strokeEvents) {
            const { objectId, points } = event.args;
            const id = objectId.toNumber();

            if (deletedIds.has(id)) continue;
            if (objectManager.objects.has(id)) continue;

            try {
                const info = await contract.getObjectInfo(id);
                if (info.isDeleted) continue;

                const obj = {
                    id,
                    type: 'stroke',
                    creator: info.creator,
                    colorIndex: info.colorIndex,
                    strokeWidth: info.strokeWidth,
                    layer: info.layer,
                    points: points.map(p => p.toNumber ? p.toNumber() : p),
                    bounds: null
                };
                obj.bounds = objectManager.calculateStrokeBounds(obj.points);
                objectManager.addObject(obj);
            } catch (e) { }
        }

        // Load ShapeGeometry
        const shapeEvents = await contract.queryFilter(
            contract.filters.ShapeGeometry(),
            fromBlock, currentBlock
        );

        for (const event of shapeEvents) {
            const { objectId, x, y, width, height, rotation } = event.args;
            const id = objectId.toNumber();

            if (deletedIds.has(id)) continue;
            if (objectManager.objects.has(id)) continue;

            try {
                const info = await contract.getObjectInfo(id);
                if (info.isDeleted) continue;

                const obj = {
                    id,
                    type: CONFIG.objectTypes[info.objectType],
                    creator: info.creator,
                    colorIndex: info.colorIndex,
                    strokeWidth: info.strokeWidth,
                    layer: info.layer,
                    bounds: {
                        x: x.toNumber ? x.toNumber() : x,
                        y: y.toNumber ? y.toNumber() : y,
                        width: width.toNumber ? width.toNumber() : width,
                        height: height.toNumber ? height.toNumber() : height
                    },
                    rotation: rotation.toNumber ? rotation.toNumber() : rotation
                };
                objectManager.addObject(obj);
            } catch (e) { }
        }

        // Load StickyNoteData
        const stickyEvents = await contract.queryFilter(
            contract.filters.StickyNoteData(),
            fromBlock, currentBlock
        );

        for (const event of stickyEvents) {
            const { objectId, x, y, width, height, content, bgColorIndex } = event.args;
            const id = objectId.toNumber();

            if (deletedIds.has(id)) continue;
            if (objectManager.objects.has(id)) continue;

            try {
                const info = await contract.getObjectInfo(id);
                if (info.isDeleted) continue;

                const obj = {
                    id,
                    type: 'stickyNote',
                    creator: info.creator,
                    colorIndex: info.colorIndex,
                    bgColorIndex,
                    strokeWidth: 0,
                    layer: info.layer,
                    bounds: {
                        x: x.toNumber ? x.toNumber() : x,
                        y: y.toNumber ? y.toNumber() : y,
                        width: width.toNumber ? width.toNumber() : width,
                        height: height.toNumber ? height.toNumber() : height
                    },
                    content
                };
                objectManager.addObject(obj);
            } catch (e) { }
        }

        // Load TextData
        const textEvents = await contract.queryFilter(
            contract.filters.TextData(),
            fromBlock, currentBlock
        );

        for (const event of textEvents) {
            const { objectId, x, y, content, fontSize } = event.args;
            const id = objectId.toNumber();

            if (deletedIds.has(id)) continue;
            if (objectManager.objects.has(id)) continue;

            try {
                const info = await contract.getObjectInfo(id);
                if (info.isDeleted) continue;

                const obj = {
                    id,
                    type: 'text',
                    creator: info.creator,
                    colorIndex: info.colorIndex,
                    strokeWidth: fontSize,
                    layer: info.layer,
                    bounds: {
                        x: x.toNumber ? x.toNumber() : x,
                        y: y.toNumber ? y.toNumber() : y,
                        width: 100,
                        height: fontSize * 5
                    },
                    content
                };
                objectManager.addObject(obj);
            } catch (e) { }
        }

        // Apply moved positions
        const movedEvents = await contract.queryFilter(
            contract.filters.ObjectMoved(),
            fromBlock, currentBlock
        );

        for (const event of movedEvents) {
            const { objectId, newX, newY } = event.args;
            const id = objectId.toNumber();
            const obj = objectManager.getObject(id);
            if (obj && obj.bounds) {
                const newXVal = newX.toNumber ? newX.toNumber() : newX;
                const newYVal = newY.toNumber ? newY.toNumber() : newY;
                const dx = newXVal - obj.bounds.x;
                const dy = newYVal - obj.bounds.y;

                obj.bounds.x = newXVal;
                obj.bounds.y = newYVal;

                if (obj.type === 'stroke' && obj.points) {
                    for (let i = 0; i < obj.points.length; i += 2) {
                        obj.points[i] += dx;
                        obj.points[i + 1] += dy;
                    }
                }
            }
        }

        // Load users
        const joinEvents = await contract.queryFilter(
            contract.filters.UserJoined(),
            0, currentBlock
        );

        const leftEvents = await contract.queryFilter(
            contract.filters.UserLeft(),
            0, currentBlock
        );

        const leftUsers = new Set();
        for (const event of leftEvents) {
            leftUsers.add(event.args.user.toLowerCase());
        }

        for (const event of joinEvents) {
            const { user, nickname } = event.args;
            const addr = user.toLowerCase();

            if (leftUsers.has(addr)) continue;
            if (addr === myAddress?.toLowerCase()) continue;

            createCursor(user, nickname);
        }

        stats.objects = objectManager.objects.size;
        render();
        log(`Loaded ${objectManager.objects.size} objects, ${cursors.size} users`, 'tx');

    } catch (error) {
        log(`Load error: ${error.message}`, 'error');
    }
}

// ===== Event Polling =====
function startEventPolling() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
    }

    let lastBlock = 0;

    pollingIntervalId = setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (lastBlock === 0) lastBlock = currentBlock - 1;

            if (currentBlock > lastBlock) {
                await processEvents(lastBlock + 1, currentBlock);
                lastBlock = currentBlock;
            }
        } catch (error) {
            // Ignore
        }
    }, 100);
}

async function processEvents(fromBlock, toBlock) {
    // ObjectCreated
    const createdEvents = await contract.queryFilter(
        contract.filters.ObjectCreated(),
        fromBlock, toBlock
    );

    for (const event of createdEvents) {
        const { creator } = event.args;
        if (creator.toLowerCase() === myAddress?.toLowerCase()) continue;
        log(`New object from ${creator.slice(0, 8)}...`, 'event');
    }

    // StrokePoints
    const strokeEvents = await contract.queryFilter(
        contract.filters.StrokePoints(),
        fromBlock, toBlock
    );

    for (const event of strokeEvents) {
        const { objectId, points } = event.args;
        const id = objectId.toNumber();

        if (!objectManager.objects.has(id)) {
            try {
                const info = await contract.getObjectInfo(id);
                if (info.creator.toLowerCase() !== myAddress?.toLowerCase()) {
                    const obj = {
                        id,
                        type: 'stroke',
                        creator: info.creator,
                        colorIndex: info.colorIndex,
                        strokeWidth: info.strokeWidth,
                        layer: info.layer,
                        points: points.map(p => p.toNumber ? p.toNumber() : p),
                        bounds: null
                    };
                    obj.bounds = objectManager.calculateStrokeBounds(obj.points);
                    objectManager.addObject(obj);
                    render();
                }
            } catch (e) { }
        }
    }

    // ShapeGeometry
    const shapeEvents = await contract.queryFilter(
        contract.filters.ShapeGeometry(),
        fromBlock, toBlock
    );

    for (const event of shapeEvents) {
        const { objectId, x, y, width, height, rotation } = event.args;
        const id = objectId.toNumber();

        if (!objectManager.objects.has(id)) {
            try {
                const info = await contract.getObjectInfo(id);
                if (info.creator.toLowerCase() !== myAddress?.toLowerCase()) {
                    const obj = {
                        id,
                        type: CONFIG.objectTypes[info.objectType],
                        creator: info.creator,
                        colorIndex: info.colorIndex,
                        strokeWidth: info.strokeWidth,
                        layer: info.layer,
                        bounds: {
                            x: x.toNumber ? x.toNumber() : x,
                            y: y.toNumber ? y.toNumber() : y,
                            width: width.toNumber ? width.toNumber() : width,
                            height: height.toNumber ? height.toNumber() : height
                        },
                        rotation: rotation.toNumber ? rotation.toNumber() : rotation
                    };
                    objectManager.addObject(obj);
                    render();
                }
            } catch (e) { }
        }
    }

    // StickyNoteData
    const stickyEvents = await contract.queryFilter(
        contract.filters.StickyNoteData(),
        fromBlock, toBlock
    );

    for (const event of stickyEvents) {
        const { objectId, x, y, width, height, content, bgColorIndex } = event.args;
        const id = objectId.toNumber();

        if (!objectManager.objects.has(id)) {
            try {
                const info = await contract.getObjectInfo(id);
                if (info.creator.toLowerCase() !== myAddress?.toLowerCase()) {
                    const obj = {
                        id,
                        type: 'stickyNote',
                        creator: info.creator,
                        colorIndex: info.colorIndex,
                        bgColorIndex,
                        strokeWidth: 0,
                        layer: info.layer,
                        bounds: {
                            x: x.toNumber ? x.toNumber() : x,
                            y: y.toNumber ? y.toNumber() : y,
                            width: width.toNumber ? width.toNumber() : width,
                            height: height.toNumber ? height.toNumber() : height
                        },
                        content
                    };
                    objectManager.addObject(obj);
                    render();
                }
            } catch (e) { }
        }
    }

    // TextData
    const textEvents = await contract.queryFilter(
        contract.filters.TextData(),
        fromBlock, toBlock
    );

    for (const event of textEvents) {
        const { objectId, x, y, content, fontSize } = event.args;
        const id = objectId.toNumber();

        if (!objectManager.objects.has(id)) {
            try {
                const info = await contract.getObjectInfo(id);
                if (info.creator.toLowerCase() !== myAddress?.toLowerCase()) {
                    const obj = {
                        id,
                        type: 'text',
                        creator: info.creator,
                        colorIndex: info.colorIndex,
                        strokeWidth: fontSize,
                        layer: info.layer,
                        bounds: {
                            x: x.toNumber ? x.toNumber() : x,
                            y: y.toNumber ? y.toNumber() : y,
                            width: 100,
                            height: fontSize * 5
                        },
                        content
                    };
                    objectManager.addObject(obj);
                    render();
                }
            } catch (e) { }
        }
    }

    // ObjectMoved
    const movedEvents = await contract.queryFilter(
        contract.filters.ObjectMoved(),
        fromBlock, toBlock
    );

    for (const event of movedEvents) {
        const { user, objectId, newX, newY } = event.args;
        if (user.toLowerCase() === myAddress?.toLowerCase()) continue;

        const id = objectId.toNumber();
        const obj = objectManager.getObject(id);
        if (obj && obj.bounds) {
            const newXVal = newX.toNumber ? newX.toNumber() : newX;
            const newYVal = newY.toNumber ? newY.toNumber() : newY;
            const dx = newXVal - obj.bounds.x;
            const dy = newYVal - obj.bounds.y;

            obj.bounds.x = newXVal;
            obj.bounds.y = newYVal;

            if (obj.type === 'stroke' && obj.points) {
                for (let i = 0; i < obj.points.length; i += 2) {
                    obj.points[i] += dx;
                    obj.points[i + 1] += dy;
                }
            }
            render();
        }
    }

    // ObjectDeleted
    const deletedEvents = await contract.queryFilter(
        contract.filters.ObjectDeleted(),
        fromBlock, toBlock
    );

    for (const event of deletedEvents) {
        const { user, objectId } = event.args;
        const id = typeof objectId === 'bigint' ? Number(objectId) : (objectId.toNumber ? objectId.toNumber() : objectId);

        if (user.toLowerCase() === myAddress?.toLowerCase()) continue;

        log(`Object #${id} deleted by ${user.slice(0, 8)}...`, 'event');
        objectManager.deleteObject(id);
    }

    // ContentUpdated
    const contentEvents = await contract.queryFilter(
        contract.filters.ContentUpdated(),
        fromBlock, toBlock
    );

    for (const event of contentEvents) {
        const { objectId, newContent } = event.args;
        const id = objectId.toNumber ? objectId.toNumber() : Number(objectId);
        const obj = objectManager.getObject(id);
        if (obj) {
            obj.content = newContent;
            log(`Content updated for #${id}`, 'event');
            render();
        }
    }

    // CanvasCleared
    const clearEvents = await contract.queryFilter(
        contract.filters.CanvasCleared(),
        fromBlock, toBlock
    );

    if (clearEvents.length > 0) {
        const lastClear = clearEvents[clearEvents.length - 1];
        if (lastClear.args.user.toLowerCase() !== myAddress?.toLowerCase()) {
            objectManager.clear();
            selectionSystem.deselectAll();
            render();
            log('Canvas cleared by another user', 'event');
        }
    }

    // CursorMoved
    const cursorEvents = await contract.queryFilter(
        contract.filters.CursorMoved(),
        fromBlock, toBlock
    );

    for (const event of cursorEvents) {
        const { user, x, y } = event.args;
        if (user.toLowerCase() !== myAddress?.toLowerCase()) {
            updateRemoteCursor(user, x, y);
        }
    }

    // UserJoined
    const joinEvents = await contract.queryFilter(
        contract.filters.UserJoined(),
        fromBlock, toBlock
    );

    for (const event of joinEvents) {
        const { user, nickname } = event.args;
        if (user.toLowerCase() !== myAddress?.toLowerCase()) {
            createCursor(user, nickname);
            log(`${nickname} joined`, 'event');
        }
    }

    // NicknameUpdated
    const nicknameEvents = await contract.queryFilter(
        contract.filters.NicknameUpdated(),
        fromBlock, toBlock
    );

    for (const event of nicknameEvents) {
        const { user, newNickname } = event.args;
        createCursor(user, newNickname);
        if (user.toLowerCase() !== myAddress?.toLowerCase()) {
            log(`${newNickname} updated nickname`, 'event');
        }
    }

    render();
}

// ===== Start Application =====
window.onerror = function(msg, url, line, col, error) {
    console.error('Error:', msg, 'Line:', line);
    alert('JavaScript Error: ' + msg + ' (Line: ' + line + ')');
    return false;
};

try {
    init();
    console.log('Init completed successfully');
} catch (e) {
    console.error('Init error:', e);
    alert('Init error: ' + e.message);
}
