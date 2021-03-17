/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });

const os = require('os');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const fs = require('fs');

function BatteryADC(callback) {
    return new Promise((resolve) => {
        process.nextTick(() => {
            let result = 0;
            fs.readFile('/tmp/battery_adc', function (error, stdout) {
                if (!error) {
                    result = parseInt(stdout.toString(), 10);
                }
                if (callback) { callback(result); }
                resolve(result);
            });
        });
    });
}

function BatteryLevel(callback) {
    return new Promise((resolve) => {
        process.nextTick(() => {
            let result = 0;
            fs.readFile('/tmp/battery_level', function (error, stdout) {
                if (!error) {
                    result = parseInt(stdout.toString(), 10);
                }
                if (callback) { callback(result); }
                resolve(result);
            });
        });
    });
}

function BatteryLevelPM(callback) {
    return new Promise((resolve) => {
        process.nextTick(() => {
            let result = 0;
            exec('/usr/bin/iotg_pm -a 3', function (error, stdout) {
                if (!error) {
                    result = parseInt(stdout.toString(), 10);
                }
                if (callback) { callback(result); }
                resolve(result);
            });
        });
    });
}

function ProcRead(name, callback) {
    return new Promise((resolve) => {
        process.nextTick(() => {
            let result = 0;
            fs.readFile('/proc/iotg300/' + name, function (error, stdout) {
                if (!error) {
                    result = parseInt(stdout.toString(), 10);
                }
                if (callback) { callback(result); }
                resolve(result);
            });
        });
    });
}

exports.BatteryADC = BatteryADC;
exports.BatteryLevel = BatteryLevel;
exports.BatteryLevelPM = BatteryLevelPM;
exports.ProcRead = ProcRead;
