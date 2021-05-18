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
}

class HitpointProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
//    this.updateValue(propertyDescription.value);
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
  notifyReadOnly(value) {
    this.setReadOnly(value);
    this.device.notifyPropertyChanged(this);
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
    this['@context'] = 'https://webthings.io/schemas/';
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

function sleep(time, data) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve(data);
    }, time);
  });
}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

class BatteryDevice extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'battery');
    this.name = 'Battery';
    this.description = "Battery information";
    this['@context'] = 'https://webthings.io/schemas/';
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

class DeviceSpeaker extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_speaker');
    this.name = 'Speaker';
    this.description = "Speaker device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
    this.waitStep = 0;
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PWR_SPK')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PWR_SPK', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
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
    this.waitStep = 0;
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_AMP_PWR')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_AMP_PWR', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
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
    this.waitStep = 0;
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_4G')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PW_4G', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
  }
}

class DeviceBle extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_ble');
    this.name = 'BLE Module';
    this.description = "BLE device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    this.waitStep = 0;
    super.initEvent('Reset');

    super.initCallbackAction();
    this.addCallbackAction('reset', 'Reset', 'Reset the module', () => {
      if( this.waitStep == 0 ) {
        this.waitStep = 11;
        this.notifyReadOnly(true);
        super.notifyEvent('Reset');
        si.iotg_proc(this, 'CPU_RST_BLE', 0, function (dev) {
          sleep(500,dev).then( function (dev) {
            si.iotg_proc(dev, 'CPU_RST_BLE', 1, function (dev) {
              dev.notifyReadOnly(false);
              dev.waitStep = 0;
            });
          })
        });
      }
    });
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_BLE')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PW_BLE', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
  }
}

class DeviceZigbee extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_zigbee');
    this.name = 'Zigbee Module';
    this.description = "Zigbee device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    this.waitStep = 0;
    super.initEvent('Reset');

    super.initCallbackAction();
    this.addCallbackAction('reset', 'Reset', 'Reset the module', () => {
      if( this.waitStep == 0 ) {
        this.waitStep = 11;
        this.notifyReadOnly(true);
        super.notifyEvent('Reset');
        si.iotg_proc(this, 'IO_RST_ZIGBEE', 0, function (dev) {
          sleep(500,dev).then( function (dev) {
            si.iotg_proc(dev, 'IO_RST_ZIGBEE', 1, function (dev) {
              dev.notifyReadOnly(false);
              dev.waitStep = 0;
            });
          })
        });
      }
    });
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_ZIG')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PW_ZIG', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
  }
}

class DeviceZwave extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_zwave');
    this.name = 'Zwave Module';
    this.description = "Zwave device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();

    this.waitStep = 0;
    super.initEvent('Reset');

    super.initCallbackAction();
    this.Reseting = false;
    this.addCallbackAction('reset', 'Reset', 'Reset the module', () => {
      if( this.waitStep == 0 ) {
        this.waitStep = 11;
        this.notifyReadOnly(true);
        super.notifyEvent('Reset');
        si.iotg_proc(this, 'CPU_RST_ZWAVE', 0, function (dev) {
          sleep(500,dev).then( function (dev) {
            si.iotg_proc(dev, 'CPU_RST_ZWAVE', 1, function (dev) {
              dev.notifyReadOnly(false);
              dev.waitStep = 0;
            });
          })
        });
      }
    });
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_ZWAVE')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PW_ZWAVE', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
  }
}

class DeviceWifi extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_wifi');
    this.name = 'Wi-Fi Module';
    this.description = "Wi-Fi device information";
    super.schemasOnOffSwitch();
    this.power = super.createPowerProperty();
    this.waitStep = 0;
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.power.updateValue( si.ProcRead('CPU_PW_WIFI')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( this.waitStep == 0 ) {
      this.waitStep = 1;
      this.notifyReadOnly(true);
      property.getValue().then( value => {
        si.iotg_proc(this, 'CPU_PW_WIFI', (value)?1:0, function (dev) {
          dev.waitStep = 2;
          dev.notifyReadOnly(false);
        });
      });
    }
    if( this.waitStep == 2 ) {
      this.waitStep = 0;
    }
  }
  notifyReadOnly(value) {
    this.power.notifyReadOnly(value);
  }
}

class DeviceSim extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_sim');
    this.name = 'Sim Module';
    this.description = "Sim device information";

    this['@context'] = 'https://webthings.io/schemas/';
    this['@type'] = ['SelectSimProperty'];
    this.type = 'string';

    this.sim1 = this.createProperty('SIM1', {
      '@type': 'BooleanProperty',
      label: 'SIM1',
      name: 'sim1',
      type: 'boolean',
      value: false,
      readOnly: true
    });
    this.sim2 = this.createProperty('SIM2', {
      '@type': 'BooleanProperty',
      label: 'SIM2',
      name: 'sim2',
      type: 'boolean',
      value: false,
      readOnly: true
    });
    this.sim = this.createProperty('SEL', {
      '@type': 'SelectSimProperty',
      label: 'Select',
      name: 'sel',
      type: 'string',
      enum: ['SIM1', 'SIM2'],
      value: 'SIM1',
      readOnly: false
    });

    this.waitStep = 0;
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.sim.updateValue( si.ProcRead('SEL_SIM')?'SIM1':'SIM2' );
      this.sim1.updateValue( si.ProcRead('SIM1')?true:false );
      this.sim2.updateValue( si.ProcRead('SIM2')?true:false );
    });
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    if( property.getName() == "SEL" ) {
      if( this.waitStep == 0 ) {
        this.waitStep = 1;
        this.notifyReadOnly(true);
        property.getValue().then( value => {
          si.iotg_proc(this, 'SEL_SIM', (value=="SIM1")?1:0, function (dev) {
            dev.waitStep = 2;
            dev.notifyReadOnly(false);
          });
        });
      }
      if( this.waitStep == 2 ) {
        this.waitStep = 0;
      }
    }
  }
  notifyReadOnly(value) {
    this.sim.notifyReadOnly(value);
    this.sim1.notifyReadOnly(value);
    this.sim2.notifyReadOnly(value);
  }
}

class DeviceColorLight extends HitpointDevice {
  constructor(adapter) {
    super(adapter, 'device_color_light');
    this.name = 'ColorLight';
    this.description = "ColorLight information";

    this['@context'] = 'https://webthings.io/schemas/';
    this['@type'] = ['Light', 'ColorControl'];
    this.type = 'dimmableColorLight';

    this.power_val = false;
    this.power = super.createPowerProperty();
    this.power.updateValue(this.power_val);

    this.led = super.createColorProperty('color', 'color', 'The LED color');
    this.led.readOnly = false;
    this.led_val = '#000000';

    this.mode_val = 'color';
    this.colorMode = this.createProperty('colorMode', {
      label: 'Color Mode',
      name: 'colorMode',
      type: 'string',
      enum: ['color', 'flash', 'alarming', 'alert', 'armed', 'breathing', 'heartbeat', 'tap', 'wating', 'demo0', 'demo1', 'demo2', 'demo3', 'demo4', 'demo5', 'demo6'],
      value: 'color',
      readOnly: false
    });

    this.flash_val = 500;
    this.flash = this.createProperty('flash', {
      type: 'integer',
      title: 'flash',
      minimum: 20,
      maximum: 5000,
      description: 'Flash color speed',
      value: 500,
      readOnly: false
    });
  }
  updateState() {
    return __awaiter(this, void 0, void 0, function* () {
      this.flash.updateValue( this.flash_val );
      this.colorMode.updateValue( this.mode_val );
    });
  }
  updateLED() {
    if ( this.power_val == false ) {
      si.ProcWrite('cmd','color off');
    } else {
      let color = hexToRgb(this.led_val);
      if (color == null) {
        color = {
          r: 0,
          g: 0,
          b: 0
        }
      }
      switch (this.mode_val) {
        case 'color':
          si.ProcWrite('cmd', 'color '+color.r+' '+color.g+' '+color.b);
          break;
        case 'flash':
          si.ProcWrite('cmd', 'color '+color.r+' '+color.g+' '+color.b);
          sleep(50,this).then( function (dev) {
            si.ProcWrite('cmd', 'flash '+dev.flash_val+' '+dev.flash_val);
          })
          break;
        case 'alarming':
          si.ProcWrite('ring_alarming',color.r+' '+color.g+' '+color.b);
          break;
        case 'alert':
          si.ProcWrite('ring_alert',color.r+' '+color.g+' '+color.b);
          break;
        case 'armed':
          si.ProcWrite('ring_armed',color.r+' '+color.g+' '+color.b);
          break;
        case 'breathing':
          si.ProcWrite('ring_breathing',color.r+' '+color.g+' '+color.b);
          break;
        case 'heartbeat':
          si.ProcWrite('ring_heartbeat',color.r+' '+color.g+' '+color.b);
          break;
        case 'tap':
          si.ProcWrite('ring_tap',color.r+' '+color.g+' '+color.b);
          break;
        case 'wating':
          si.ProcWrite('ring_wating',color.r+' '+color.g+' '+color.b);
          break;
        case 'demo0':
          si.ProcWrite('cmd', 'demo 0');
          break;
        case 'demo1':
          si.ProcWrite('cmd', 'color off');
          si.ProcWrite('cmd', 'led 0 8 0 0');
          si.ProcWrite('cmd', 'led 1 16 0 0');
          si.ProcWrite('cmd', 'led 2 32 0 0');
          si.ProcWrite('cmd', 'led 3 64 0 0');
          si.ProcWrite('cmd', 'led 4 96 0 0');
          si.ProcWrite('cmd', 'led 5 128 0 0');
          si.ProcWrite('cmd', 'led 6 192 0 0');
          si.ProcWrite('cmd', 'led 7 255 0 0');
          sleep(100,this).then( function (dev) {
            si.ProcWrite('cmd', 'sn 1 '+dev.flash_val);
          })
          break;
        case 'demo2':
          si.ProcWrite('cmd', 'color off');
          si.ProcWrite('cmd', 'led 7 0 4 0');
          si.ProcWrite('cmd', 'led 6 0 8 0');
          si.ProcWrite('cmd', 'led 5 0 16 0');
          si.ProcWrite('cmd', 'led 4 0 32 0');
          si.ProcWrite('cmd', 'led 3 0 64 0');
          si.ProcWrite('cmd', 'led 2 0 96 0');
          si.ProcWrite('cmd', 'led 1 0 160 0');
          si.ProcWrite('cmd', 'led 0 0 255 0');
          sleep(100,this).then( function (dev) {
            si.ProcWrite('cmd', 'sp 1 '+dev.flash_val);
          })
          break;
        case 'demo3':
          si.ProcWrite('cmd', 'demo 3');
          break;
        case 'demo4':
          si.ProcWrite('cmd', 'bgcolor 255 0 0');
          si.ProcWrite('cmd', 'color 0 0 255');
          sleep(100,this).then( function (dev) {
            si.ProcWrite('cmd', 'shine '+dev.flash_val+' '+dev.flash_val);
          })
          break;
        case 'demo5':
          si.ProcWrite('cmd', 'color off');
          if ( color.r == 0 && color.g == 0 && color.b == 0 ) {
            color.g = 255;
          }
          let cc = color.r+' '+color.g+' '+color.b;
          si.ProcWrite('cmd', 'led 0 '+cc);
          si.ProcWrite('cmd', 'led 2 '+cc);
          si.ProcWrite('cmd', 'led 4 '+cc);
          si.ProcWrite('cmd', 'led 6 '+cc);
          si.ProcWrite('cmd', 'led 8 '+cc);
          si.ProcWrite('cmd', 'led 10 '+cc);
          si.ProcWrite('cmd', 'led 12 '+cc);
          si.ProcWrite('cmd', 'led 14 '+cc);
          si.ProcWrite('cmd', 'led 16 '+cc);
          si.ProcWrite('cmd', 'led 18 '+cc);
          sleep(100,this).then( function (dev) {
            si.ProcWrite('cmd', 'sn 1 '+dev.flash_val);
          })
          break;
        case 'demo6':
          si.ProcWrite('cmd', 'color off');
          si.ProcWrite('cmd', 'led 4 255 0 0');
          si.ProcWrite('cmd', 'led 9 0 255 0');
          si.ProcWrite('cmd', 'led 14 0 0 255');
          si.ProcWrite('cmd', 'led 19 0 255 255');
          sleep(100,this).then( function (dev) {
            si.ProcWrite('cmd', 'sp 1 '+dev.flash_val);
          })
          break;
      }
    }
  }
  notifyPropertyChanged(property) {
    super.notifyPropertyChanged(property);
    switch (property.getName()) {
      case 'colorMode':
        this.mode_val = property.value;
        // console.log('Mode: ' + property.value );
        this.updateLED();
        break;
      case 'color':
        this.led_val = property.value;
        // console.log('Color: ' + property.value );
        this.updateLED();
        break;
      case 'flash':
        this.flash_val = property.value;
        // console.log('Flash: ' + property.value );
        this.updateLED();
        break;
      case 'Power':
        this.power_val = property.value;
        // console.log('Power: ' + property.value );
        this.updateLED();
        break;
    }
  }
}

class Iotg300Adapter extends HitpointAdapter {
  constructor(addonManager) {
    super(addonManager, 'Iotg300Adapter', manifest.id);

    // 用於等待之前 iotg_proc 執行結束
    require('child_process').execSync('/usr/bin/iotg_proc');

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
  
    const devsim = new DeviceSim(this);
    this.handleDeviceAdded(devsim);
    devsim.updateState();

    const devcolorlight = new DeviceColorLight(this);
    this.handleDeviceAdded(devcolorlight);
    devcolorlight.updateState();

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