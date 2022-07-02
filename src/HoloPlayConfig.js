/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as HoloPlayCore from 'holoplay-core/dist/holoplaycore.module.js';

export const kDefaultEyeHeight = 1.6;

let config;
export const getHoloPlayConfig = () => {
  if (config === undefined) config = makeConfig();
  return config;
};

const kFakeCalibration = {
  configVersion: "1.0",
  pitch: { value: 45 },
  slope: { value: -5 },
  center: { value: -0.5 },
  viewCone: { value: 40 },
  invView: { value: 1 },
  verticalAngle: { value: 0 },
  DPI: { value: 338 },
  screenW: { value: 250 },
  screenH: { value: 250 },
  flipImageX: { value: 0 },
  flipImageY: { value: 0 },
  flipSubp: { value: 0 },
};

const makeConfig = () => new class extends EventTarget {
  constructor() {
    super();

    const fireChanged = (dispatch) => {
      if (dispatch) this.dispatchEvent(new Event('on-config-changed'));
      const changePromise = new Promise(r => { this._ensureConfigChangeEvent = r; });
      changePromise.then(() => fireChanged(true));
    };
    fireChanged(false);

    // Placeholder values while we wait for the HoloPlay service.
    this.calibration = kFakeCalibration;

    const client = new HoloPlayCore.Client(
      (msg) => {
        if (msg.devices.length < 1) {
          console.error('No HoloPlay devices found!');
          return;
        }
        if (msg.devices.length > 1) {
          console.warn('More than one HoloPlay device found... using the first one');
        }
        this.calibration = msg.devices[0].calibration;
      },
      (err) => {
        console.error('Error creating HoloPlay client:', err);
      });

    // Set defaults for configurable things
    this.tileHeight = 320;
    this.numViews = 2;
    this.trackballX = 0;
    this.trackballY = 0;
    this.targetX = 0;
    this.targetY = kDefaultEyeHeight;
    this.targetZ = -0.5;
    this.targetDiam = 2.0;
    this.fovy = 13.0 / 180 * Math.PI;
    this.depthiness = 1.25;
    this.inlineView = 1;
  }

  get calibration() { return this._calibration; }
  set calibration(v) { this._calibration = deepFreeze(v); this._ensureConfigChangeEvent(); }

  // configurable

  get tileHeight() { return this._tileHeight; } set tileHeight(v) { this._tileHeight = v; this._ensureConfigChangeEvent(); }
  get numViews  () { return this._numViews;   } set numViews  (v) { this._numViews   = v; this._ensureConfigChangeEvent(); }
  get targetX   () { return this._targetX;    } set targetX   (v) { this._targetX    = v; this._ensureConfigChangeEvent(); }
  get targetY   () { return this._targetY;    } set targetY   (v) { this._targetY    = v; this._ensureConfigChangeEvent(); }
  get targetZ   () { return this._targetZ;    } set targetZ   (v) { this._targetZ    = v; this._ensureConfigChangeEvent(); }
  get trackballX() { return this._trackballX; } set trackballX(v) { this._trackballX = v; this._ensureConfigChangeEvent(); }
  get trackballY() { return this._trackballY; } set trackballY(v) { this._trackballY = v; this._ensureConfigChangeEvent(); }
  get targetDiam() { return this._targetDiam; } set targetDiam(v) { this._targetDiam = v; this._ensureConfigChangeEvent(); }
  get fovy      () { return this._fovy;       } set fovy      (v) { this._fovy       = v; this._ensureConfigChangeEvent(); }
  get depthiness() { return this._depthiness; } set depthiness(v) { this._depthiness = v; this._ensureConfigChangeEvent(); }
  get inlineView() { return this._inlineView; } set inlineView(v) { this._inlineView = v; this._ensureConfigChangeEvent(); }

  // computed

  get aspect() { return this.calibration.screenW.value / this.calibration.screenH.value; }
  get tileWidth() { return Math.round(this.tileHeight * this.aspect); }
  get framebufferWidth() {
    const numPixels = this.tileWidth * this.tileHeight * this.numViews;
    return 2 ** Math.ceil(Math.log2(Math.max(Math.sqrt(numPixels), this.tileWidth)));
  }
  get quiltWidth() { return Math.floor(this.framebufferWidth / this.tileWidth); }
  get quiltHeight() { return Math.ceil(this.numViews / this.quiltWidth); }
  get framebufferHeight() { return 2 ** Math.ceil(Math.log2(this.quiltHeight * this.tileHeight)); }

  get viewCone() { return this.calibration.viewCone.value * this.depthiness / 180 * Math.PI; }
  get tilt() {
    return this.calibration.screenH.value /
      (this.calibration.screenW.value * this.calibration.slope.value) *
      (this.calibration.flipImageX.value ? -1 : 1);
  }
  get subp() { return 1 / (this.calibration.screenW.value * 3); }
  get pitch() {
    const screenInches = this.calibration.screenW.value / this.calibration.DPI.value;
    return this.calibration.pitch.value * screenInches *
      Math.cos(Math.atan(1.0 / this.calibration.slope.value));
  }
};

function deepFreeze(o) {
  Object.freeze(o);
  if (o === undefined) {
    return o;
  }

  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o[prop] !== null
      && (typeof o[prop] === 'object' || typeof o[prop] === 'function')
      && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });

  return o;
};
