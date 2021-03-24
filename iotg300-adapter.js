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
  Event,
} = require('gateway-addon');

const manifest = require('./manifest.json');
const si = require("./iotg300-information");

class HitpointAdapter extends Adapter {
  constructor(addonManager, adapterId, packageName) {
    super(addonManager, adapterId, packageName);
    addonManager.addAdapter(this);
  }

  initDevicePolling() {
    this.cbPolling = [];
  }
  addDevicePolling(device) {
    this.cbPolling.push(device);
  }
  startDevicePolling(interval) {
    this.polling();
    setInterval(() => {
        this.polling();
    }, interval * 1000);
  }
  polling() {
    this.cbPolling.forEach(item => item.poll());
  }
/* remove
  initDevicePolling() {
    this.cbPolling = {};
  }
  addDevicePolling(name, callback) {
    this.cbPolling[name] = callback;
  }
  startDevicePolling(interval) {
    this.polling();
    setInterval(() => {
        this.polling();
    }, interval * 1000);
  }
  polling() {
    console.log('polling start ---------');
    for (const [name, callback] of Object.entries(this.cbPolling)) {
      if (callback) {
        console.log('polling: '+ name);
        callback();
      }
      else {
        console.warn("HitpointProperty: Unknown callback polling" + name);
      }
    }
  } */
}

class HitpointProperty extends Property {
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
//        this.device.notifyPropertyChanged(this);
      }).catch((err) => {
        reject(err);
      });
    });
  }
  updateValue(value) {
//    this.setCachedValue(value);
//    this.device.notifyPropertyChanged(this);
    this.setCachedValueAndNotify(value);
  }
}

class HitpointDevice extends Device {
  constructor(adapter,name) {
    super(adapter, name);
  }
  createProperty(name, description) {
    const property = new HitpointProperty(this, name, description);
    this.properties.set(name, property);
    return property;
  }
  schemasOnOffSwitch() {
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['OnOffSwitch'];
    this.type = 'boolean';
  }
  initCallbackAction() {
    this.cbActions = {};
  }
  addCallbackAction(name, title, description, callback) {
    this.addAction(name, {
        title,
        description
    });
    this.cbActions[name] = callback;
  }
  performAction(action) {
    return __awaiter(this, void 0, void 0, function* () {
      action.start();
      const callback = this.cbActions[action.name];
      if (callback) {
        callback();
      }
      else {
        console.warn("HitpointDevice: Unknown action ${action.name}");
      }
      action.finish();
    });
  }
  initEvent(name, description) {
    this.addEvent(name, {
        description,
        type: 'string',
        '@type': 'AlarmEvent',
        readOnly: true,
    });
  }
  notifyEvent(eventName, description) {
    if (description) {
      console.log(this.name, 'event:', eventName, 'desc:', description);
    } else {
      console.log(this.name, 'event:', eventName);
      description = new Date().toLocaleString('en-US');
    }
    this.eventNotify(new Event(this, eventName, description));
  }
/*
  addActions(actions) {
    for (const actionName in actions) {
      this.addAction(actionName, actions[actionName]);
    }
  }
  addEvents(events) {
    for (const eventName in events) {
      this.addEvent(eventName, events[eventName]);
    }
  }
*/
  createPowerProperty() {
    return this.createProperty('Power', {
      '@type': 'OnOffProperty',
      label: 'On/Off',
      name: 'power',
      type: 'boolean',
      value: false,
      readOnly: false
    });
  }
  createColorProperty(name, title, desc) {
    return this.createProperty(name, {
      '@type': 'ColorProperty',
      type: 'string',
      title,
      description: desc,
      readOnly: true
    });
  }
}

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

class BatteryDevice extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'battery');
    this.name = 'Battery';
    this.description = "Battery information";
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['MultiLevelSensor', 'ColorControl'];
    this.type = 'integer';
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
    this.led = super.createColorProperty('LED', 'LED', 'The battery LED');
  }
  poll() {
    return __awaiter(this, void 0, void 0, function* () {
      const adc = yield si.BatteryADC();
      const state = si.ProcRead('CPU_BAT_STATE');
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
      const adc = si.ProcRead('adc');
      this.adc.updateValue( adc );
      this.level.updateValue( yield si.BatteryLevelPM() );
      this.state.updateValue( yield si.BatteryState() );
      this.voltage.updateValue( this.BatteryVoltage(adc) ); */
    });
  }
  BatteryVoltage(batadc) {
    return batadc * 5 / 1024;
  }
}

/*
static struct gwc_gpio_def gpio_data[] = {
    { 0,    GWC_GPIO_HIGH,  GWC_GPIO_IN,    "RST_SW_BTN",    0 },   //  H   LOW: RST KEY press. (RESET KEY)
    { 5,    GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "SEL_SIM",       0 },   //  L   LOW: Select SIM2, HIGH: Select SIM1
*    { 7,    GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_BLE",    0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
*    { 8,    GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_RST_BLE",   0 },   //  L   LOW: Reset, HIGH: Normal Work
*    { 9,    GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_4G",     0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
*    { 23,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_ZIG",    0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
*    { 24,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_WIFI",   0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
    { 25,   GWC_GPIO_HIGH,  GWC_GPIO_IN,    "CPU_BAT_STATE", 0 },   //  H   LOW: CHARGING充電中, HIGH: UNCHARGING充飽
*    { 26,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_ZWAVE",  0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
    { 28,   GWC_GPIO_HIGH,  GWC_GPIO_IN,    "CPU_KEY_INT",   0 },   //  H   LOW: Normal Work, HIGH: POWER ON (key interrupt)
x    { 29,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PW_ETH",    0 },   //  L   LOW: POWER OFF, HIGH: POWER ON
    { 30,   GWC_GPIO_HIGH,  GWC_GPIO_IN,    "ADAPTER_STATE", 0 },   //  H   LOW: ADAPTER ON, HIGH: ADAPTER OFF,
*    { 31,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "IO_RST_ZIGBEE", 0 },   //  L   LOW: Reset, HIGH: Normal Work
    { 32,   GWC_GPIO_LOW,   GWC_GPIO_IN,    "SIM1",          0 },   //  L   LOW: unplugged, HIGH: plugin
    { 33,   GWC_GPIO_LOW,   GWC_GPIO_IN,    "SIM2",          0 },   //  L   LOW: unplugged, HIGH: plugin
*    { 39,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_PWR_SPK",   0 },   //  L   LOW: SPEAKER POWER OFF, HIGH: SPEAKER POWER ON
*    { 40,   GWC_GPIO_HIGH,  GWC_GPIO_IN,    "CPU_AMP_FAULT", 0 },   //  H   LOW: Normal Work, HIGH: AD82011 I2C address Error
*    { 41,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_AMP_PWR",   0 },   //  L   LOW: POWER OFF, HIGH: POWER ON  (Green LED)
    { 42,   GWC_GPIO_HIGH,  GWC_GPIO_IN,    "SOC_PROCHOT",   0 },   //  H
*    { 43,   GWC_GPIO_HIGH,  GWC_GPIO_OUT,   "CPU_RST_ZWAVE", 0 },   //  L   LOW: Reset, HIGH: Normal Work
}; BinarySensor  BooleanProperty
*/

class DeviceSpeaker extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_speaker');
    this.name = 'Speaker';
    this.description = "Speaker device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PWR_SPK')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PWR_SPK', (value)?1:0 );
    });
  }
}

class DeviceAmp extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_amp');
    this.name = 'AMP';
    this.description = "AMP device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
    this.led = super.createColorProperty('LED', 'LED', 'The AMP LED');
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_AMP_PWR')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_AMP_PWR', (value)?1:0 );
    });
  }
  poll() {
    return __awaiter(this, void 0, void 0, function* () {
      const state = si.ProcRead('CPU_AMP_FAULT');
      let color = "#000000";
      if(      state == 0 ) {
        color = "#00FF00";  // ready
      }
      else if( state == 1 ) {
        color = "#FF0000";  // fail
      }
      this.led.updateValue( color );
    });
  }
}

class Device4G extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_4g');
    this.name = '4G Module';
    this.description = "4G device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_4G')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PW_4G', (value)?1:0 );
    });
  }
}

class DeviceBle extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_ble');
    this.name = 'BLE Module';
    this.description = "BLE device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    super.initEvent('Reset');
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_BLE')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PW_BLE', (value)?1:0 );
    });
  }
}

class DeviceZigbee extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_zigbee');
    this.name = 'Zigbee Module';
    this.description = "Zigbee device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    super.initEvent('Reset');
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_ZIG')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PW_ZIG', (value)?1:0 );
    });
  }
}

class DeviceZwave extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_zwave');
    this.name = 'Zwave Module';
    this.description = "Zwave device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    super.initEvent('Reset');
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_ZWAVE')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PW_ZWAVE', (value)?1:0 );
    });
  }
}

class DeviceWifi extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_wifi');
    this.name = 'Wi-Fi Module';
    this.description = "Wi-Fi device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_WIFI')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    property.getValue().then( value => {
      si.ProcWrite('CPU_PW_WIFI', (value)?1:0 );
    });
  }
}

class Iotg300Adapter extends HitpointAdapter {
  constructor(addonManager) {
    super(addonManager, 'Iotg300Adapter', manifest.id);

    const db = new Database(this.packageName);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      this.pollInterval = config.pollInterval || 5;
    }).then(() => {
      this.addAllThings();
      this.unloading = false;
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
  /*
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

  addAllThings() {
    const battery = new BatteryDevice(this);
    this.handleDeviceAdded(battery);

    const dev4g = new Device4G(this);
    this.handleDeviceAdded(dev4g);
    dev4g.updateState();

    const devble = new DeviceBle(this);
    this.handleDeviceAdded(devble);
    devble.updateState();

    const devzigbee = new DeviceZigbee(this);
    this.handleDeviceAdded(devzigbee);
    devzigbee.updateState();

    const devzwave = new DeviceZwave(this);
    this.handleDeviceAdded(devzwave);
    devzwave.updateState();

    const devwifi = new DeviceWifi(this);
    this.handleDeviceAdded(devwifi);
    devwifi.updateState();

    const devspeaker = new DeviceSpeaker(this);
    this.handleDeviceAdded(devspeaker);
    devspeaker.updateState();

    const devamp = new DeviceAmp(this);
    this.handleDeviceAdded(devamp);
    devamp.updateState();
  
    super.initDevicePolling();
    super.addDevicePolling(battery);
    super.addDevicePolling(devamp);
    super.startDevicePolling(this.pollInterval);
}
  
  /**
   * Start the pairing/discovery process.
   *
   * @param {Number} timeoutSeconds Number of seconds to run before timeout
   */
  startPairing(_timeoutSeconds) {
    // console.log('Iotg300Adapter:', this.name,
    //             'id', this.id, 'pairing started');
    this.addAllThings();
  }

  /**
   * Cancel the pairing/discovery process.
   */
  cancelPairing() {
    // console.log('Iotg300Adapter:', this.name, 'id', this.id,
    //             'pairing cancelled');
  }

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
  removeThing(device) {
    // console.log('Iotg300Adapter:', this.name, 'id', this.id,
    //            'removeThing(', device.id, ') started');
    this.removeDevice(device.id).then(() => {
      // console.log('Iotg300Adapter: device:', device.id, 'was unpaired.');
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
    // console.log('Iotg300Adapter:', this.name, 'id', this.id,
    //            'cancelRemoveThing(', device.id, ')');
  }
}

module.exports = Iotg300Adapter;