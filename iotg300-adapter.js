/**
 * iotg300-adapter.js - Iotg300 adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};

const {
  Adapter,
  Device,
  Property,
  Database,
} = require('gateway-addon');

const manifest = require('./manifest.json');
const si = require("./iotg300-information");

class Iotg300Property extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.updateValue(propertyDescription.value);
  }

  /**
   * Set the value of the property.
   *
   * @param {*} value The new value to set
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        resolve(updatedValue);
        this.device.notifyPropertyChanged(this);
      }).catch((err) => {
        reject(err);
      });
    });
  }
  updateValue(value) {
    this.setCachedValue(value);
    this.device.notifyPropertyChanged(this);
  }
}

class BatteryDevice extends Device {
  constructor(adapter) {
    super(adapter, 'battery');
    this.name = 'Battery';
    this.type = 'integer',
    this.description = "Battery information";
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['MultiLevelSensor'];
    this.adc = this.createProperty('ADC', {
      type: 'integer',
      title: 'ADC',
      minimum: 0,
      maximum: 1024,
      description: 'The battery ADC',
      readOnly: true
    });
    this.level = this.createProperty('Level', {
      '@type': 'LevelProperty',
      type: 'integer',
      unit: '%',
      title: 'Level',
      minimum: 0,
      maximum: 100,
      description: 'The battery level in percent',
      readOnly: true
    });
    this.voltage = this.createProperty('Voltage', {
      '@type': 'VoltageProperty',
      type: 'number',
      unit: 'volt',
      title: 'Voltage',
      minimum: 0,
      maximum: 5,
      description: 'The battery voltage',
      readOnly: true
    });
    this.state = this.createProperty('State', {
      type: 'integer',
      title: 'State',
      minimum: 0,
      maximum: 2,
      description: 'The battery state',
      readOnly: true
    });
    this.led = this.createProperty('LED', {
      '@type': 'ColorProperty',
      type: 'string',
      title: 'LED',
      description: 'The battery LED',
      readOnly: true
    });
  }
  poll() {
    return __awaiter(this, void 0, void 0, function* () {
      const adc = yield si.BatteryADC();
      const state = yield si.BatteryState();
      let color = "#000000";
      if(      state == 0 ) {
        color = "#00FF00";  // ready
      }
      else if( state == 1 ) {
        color = "#ff7f27";  // charging
      }
      else if( state == 2 ) {
        color = "#FF0000";  // fail
      }
      this.adc.updateValue( adc );
      this.level.updateValue( yield si.BatteryLevel() );
      this.state.updateValue( state );
      this.led.updateValue( color );
      this.voltage.updateValue( this.BatteryVoltage(adc) );

/* 上面是有 iotg_pm 的做法，下面做法比較直接
      const adc = yield si.BatteryProcADC();
      this.adc.updateValue( adc );
      this.level.updateValue( yield si.BatteryLevelPM() );
      this.state.updateValue( yield si.BatteryState() );
      this.voltage.updateValue( this.BatteryVoltage(adc) ); */
    });
  }
  BatteryVoltage(batadc) {
    return batadc * 5 / 1024;
  }
  createProperty(name, description) {
    const property = new Iotg300Property(this, name, description);
    this.properties.set(name, property);
    return property;
  }
  startPolling(interval) {
    this.poll();
    setInterval(() => {
        this.poll();
    }, interval * 1000);
  }
}

class Iotg300Adapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, 'Iotg300Adapter', manifest.id);
    addonManager.addAdapter(this);

    const db = new Database(manifest.id);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      const pollInterval = config.pollInterval || 1;
  
      const battery = new BatteryDevice(this);
      this.handleDeviceAdded(battery);
      battery.startPolling(pollInterval);
    }).catch(console.error);
  }

  /**
   * Iotg300 process to add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {String} deviceId ID of the device to add.
   * @param {String} deviceDescription Description of the device to add.
   * @return {Promise} which resolves to the device added.
   */
  /* remove
  addDevice(deviceId, deviceDescription) {
    return new Promise((resolve, reject) => {
      if (deviceId in this.devices) {
        reject(`Device: ${deviceId} already exists.`);
      } else {
        const device = new BatteryDevice(this, deviceId, deviceDescription);
        this.handleDeviceAdded(device);
        resolve(device);
      }
    });
  } */

  /**
   * Iotg300 process to remove a device from the adapter.
   *
   * The important part is to call: `this.handleDeviceRemoved(device)`
   *
   * @param {String} deviceId ID of the device to remove.
   * @return {Promise} which resolves to the device removed.
   */
  removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject(`Device: ${deviceId} not found.`);
      }
    });
  }

  /**
   * Start the pairing/discovery process.
   *
   * @param {Number} timeoutSeconds Number of seconds to run before timeout
   */
  /* remove
  startPairing(_timeoutSeconds) {
    console.log('Iotg300Adapter:', this.name,
                'id', this.id, 'pairing started');
  } */

  /**
   * Cancel the pairing/discovery process.
   */
  /* remove
  cancelPairing() {
    console.log('Iotg300Adapter:', this.name, 'id', this.id,
                'pairing cancelled');
  } */

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
  removeThing(device) {
    // console.log('Iotg300Adapter:', this.name, 'id', this.id,
    //            'removeThing(', device.id, ') started');
    console.log('Iotg300Adapter:', 'removeThing:', device.id, 'started');

    this.removeDevice(device.id).then(() => {
      console.log('Iotg300Adapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('Iotg300Adapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }

  /**
   * Cancel unpairing process.
   *
   * @param {Object} device Device that is currently being paired
   */
  cancelRemoveThing(device) {
    console.log('Iotg300Adapter:', this.name, 'id', this.id,
                'cancelRemoveThing(', device.id, ')');
  }
}

module.exports = Iotg300Adapter;
