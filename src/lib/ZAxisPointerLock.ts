// A copy of three/examples/jsm/controls/PointerLockControls
// but tweaked such that z-axis is up/down
import {
    Camera,
    Euler,
    EventDispatcher,
    Vector3
} from 'three';
import { HALF_PI } from './Math';

const _euler = new Euler(0, 0, 0, 'ZYX');
const _vector = new Vector3();

const _changeEvent = { type: 'change' };
const _lockEvent = { type: 'lock' };
const _unlockEvent = { type: 'unlock' };

export class PointerLockControls extends EventDispatcher {
    public isLocked: boolean = false;
    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;

    public pointerSpeed = 1.0;

    private _onMouseMove: () => void
    private _onPointerlockChange: () => void
    private _onPointerlockError: () => void;

    constructor(readonly camera: Camera, readonly domElement: HTMLElement) {
        super();

        this._onMouseMove = onMouseMove.bind(this);
        this._onPointerlockChange = onPointerlockChange.bind(this);
        this._onPointerlockError = onPointerlockError.bind(this);

        this.connect();
    }

    connect() {
        this.domElement.ownerDocument.addEventListener('mousemove', this._onMouseMove);
        this.domElement.ownerDocument.addEventListener('pointerlockchange', this._onPointerlockChange);
        this.domElement.ownerDocument.addEventListener('pointerlockerror', this._onPointerlockError);
    }

    disconnect() {
        this.domElement.ownerDocument.removeEventListener('mousemove', this._onMouseMove);
        this.domElement.ownerDocument.removeEventListener('pointerlockchange', this._onPointerlockChange);
        this.domElement.ownerDocument.removeEventListener('pointerlockerror', this._onPointerlockError);
    }

    dispose() {
        this.disconnect();
    }

    getObject() { // retaining this method for backward compatibility
        return this.camera;
    }

    getDirection(v: Vector3) {
        return v.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }

    moveForward(distance: number) {
        // move forward parallel to the xy-plane
        // assumes camera.up is z-up
        const camera = this.camera;
        _vector.setFromMatrixColumn(camera.matrix, 0);
        _vector.crossVectors(camera.up, _vector);
        camera.position.addScaledVector(_vector, distance);
    }

    moveRight(distance: number) {
        const camera = this.camera;
        _vector.setFromMatrixColumn(camera.matrix, 0);
        camera.position.addScaledVector(_vector, distance);
    }

    lock() {
        this.domElement.requestPointerLock();
    }

    unlock() {
        this.domElement.ownerDocument.exitPointerLock();
    }
}

// event listeners
function onMouseMove(event) {
    if (this.isLocked === false) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const camera = this.camera;
    _euler.setFromQuaternion(camera.quaternion);
    _euler.z -= movementX * 0.002 * this.pointerSpeed;
    _euler.x -= movementY * 0.002 * this.pointerSpeed;
    _euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, _euler.x));

    camera.quaternion.setFromEuler(_euler);
    this.dispatchEvent(_changeEvent);
}

function onPointerlockChange() {
    if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
        this.dispatchEvent(_lockEvent);
        this.isLocked = true;
    } else {
        this.dispatchEvent(_unlockEvent);
        this.isLocked = false;
    }
}

function onPointerlockError() {
    console.error('THREE.PointerLockControls: Unable to use Pointer Lock API');
}
