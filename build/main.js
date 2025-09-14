"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_bacstack = __toESM(require("bacstack"));
class Bacnet extends utils.Adapter {
  bacnet;
  constructor(options = {}) {
    super({
      ...options,
      name: "bacnet"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.setState("info.connection", false, true);
    this.config.devices.forEach((dev) => {
      dev.name = dev.name.replace(this.FORBIDDEN_CHARS, "_");
      dev.objects.forEach((obj) => {
        obj.objectName = obj.objectName.replace(this.FORBIDDEN_CHARS, "_");
      });
    });
    await this.updateStates();
    this.log.debug(`binding to local port ${this.config.port}`);
    const client = new import_bacstack.default({
      port: this.config.port,
      interface: this.config.ip,
      adpuTimeout: 6e3
    });
    this.bacnet = client;
    client.readProperty("192.168.2.200", { type: 8, instance: 10 }, 76, (err, value) => {
      let nums = [];
      value.values.forEach((val) => {
        nums.push({ type: val.value.type, id: val.value.instance });
      });
      nums.forEach((n) => {
        client.readProperty("192.168.2.200", { type: n.type, instance: n.id }, 28, (e, v) => {
          if (v == void 0) {
            this.log.debug(n.id + ": null (" + n.type + ")");
          } else {
            this.log.debug(n.id + ": " + v.values[0].value + " (" + n.type + ")");
          }
        });
      });
    });
    client.readProperty("192.168.2.200", { type: 0, instance: 305880 }, this.PROPERTIES["present_value"].id, (e, v) => {
      if (e != void 0) {
        this.log.error(e);
        return;
      }
      this.log.debug("Sollwert: " + JSON.stringify(v));
    });
  }
  async updateStates() {
    await this.deleteUnusedStates();
    await this.createStates();
  }
  async deleteUnusedStates() {
    const objects = await this.getAdapterObjectsAsync();
    for (const s in objects) {
      if (!s.startsWith(`${this.name}.${this.instance}.dev`)) continue;
      if (objects[s].type == "channel" && this.getBACnetObjectFromId(s) == void 0) {
        await this.delObjectAsync(s, { recursive: true });
      }
      if (objects[s].type == "device" && this.config.devices.find((dev) => dev.name == s) == void 0) {
        await this.delObjectAsync(s, { recursive: true });
      }
    }
  }
  getBACnetObjectFromId(id) {
    return this.config.devices.find((dev) => dev.objects.some((obj) => id == `dev.${dev.name}.${obj.objectName}`));
  }
  PROPERTIES = {
    "present_value": { id: 85, type: "mixed", default: 0 },
    "statusFlags": { id: 111, type: "number", default: 0 }
  };
  async createStates() {
    for (let idx = 0; idx < this.config.devices.length; idx++) {
      const dev = this.config.devices[idx];
      this.log.debug(`creating states for ${dev.name}...`);
      const deviceObj = {
        type: "device",
        common: {
          name: `${dev.name}`
        },
        native: {},
        _id: `dev.${dev.name}`
      };
      await this.setObjectNotExistsAsync(`dev.${dev.name}`, deviceObj);
      for (let oIdx = 0; oIdx < dev.objects.length; oIdx++) {
        const obj = dev.objects[oIdx];
        const channelId = `dev.${dev.name}.${obj.objectName}`;
        const channelObj = {
          type: "channel",
          common: {
            name: `Object ${obj.objectName}`
          },
          native: {},
          _id: channelId
        };
        await this.setObjectNotExistsAsync(channelId, channelObj);
        for (const prop in this.PROPERTIES) {
          const propId = `dev.${dev.name}.${obj.objectName}.${prop}`;
          const propObj = {
            type: "state",
            common: {
              type: prop == "present_value" ? obj.binary ? "boolean" : "number" : this.PROPERTIES[prop].type,
              read: true,
              write: true,
              role: "value",
              name: `Prop ${prop}`,
              def: prop == "present_value" ? obj.binary ? false : 0 : this.PROPERTIES[prop].default,
              unit: obj.unit
            },
            native: {},
            _id: propId
          };
          await this.setObjectNotExistsAsync(propId, propObj);
        }
      }
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      import_bacstack.default.close();
      callback();
    } catch (e) {
      callback();
    }
  }
  // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
  // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
  // /**
  //  * Is called if a subscribed object changes
  //  */
  // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
  // 	if (obj) {
  // 		// The object was changed
  // 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
  // 	} else {
  // 		// The object was deleted
  // 		this.log.info(`object ${id} deleted`);
  // 	}
  // }
  /**
   * Is called if a subscribed state changes
   */
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  */
  // private onMessage(obj: ioBroker.Message): void {
  // 	if (typeof obj === 'object' && obj.message) {
  // 		if (obj.command === 'send') {
  // 			// e.g. send email or pushover or whatever
  // 			this.log.info('send command');
  // 			// Send response in callback if required
  // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
  // 		}
  // 	}
  // }
}
if (require.main !== module) {
  module.exports = (options) => new Bacnet(options);
} else {
  (() => new Bacnet())();
}
//# sourceMappingURL=main.js.map
