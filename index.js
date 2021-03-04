/**
 * index.js - Loads the iotg300 adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const Iotg300Adapter = require('./iotg300-adapter');

module.exports = (addonManager) => {
  new Iotg300Adapter(addonManager);
};
