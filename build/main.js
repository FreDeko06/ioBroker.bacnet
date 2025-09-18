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
var import_client = __toESM(require("@bacnet-js/client"));
class BacnetAdapter extends utils.Adapter {
  bacnet = new import_client.default();
  devices = [];
  pollInterval = null;
  PROPERTIES = {};
  constructor(options = {}) {
    super({
      ...options,
      name: "bacnet"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    for (const mod in import_client.PropertyIdentifier) {
      const id2 = import_client.PropertyIdentifier[mod];
      this.PROPERTIES[mod.toLowerCase()] = { id: id2 };
    }
    this.on("message", (obj) => {
      if (obj && obj.command === "test") {
        if (typeof obj.callback === "function") {
          this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
        }
      }
    });
    this.log.debug(`binding to local port ${this.config.port}`);
    const client = new import_client.default({
      port: this.config.port,
      interface: this.config.ip
    });
    this.bacnet = client;
    this.devices = [];
    this.config.devices.forEach((dev) => {
      dev.name = dev.name.replace(this.FORBIDDEN_CHARS, "_").replaceAll(".", "_");
      if (this.devices.some((d) => d.name == dev.name || d.ip == dev.ip)) {
        this.log.warn(
          `Skipping device ${dev.name} with ${dev.objects.length} object(s). Name or ip address already exists.`
        );
        return;
      }
      const objects = [];
      dev.objects.forEach((obj) => {
        obj.objectName = obj.objectName.replace(this.FORBIDDEN_CHARS, "_").replaceAll(".", "_");
        if (objects.some(
          (o) => o.objectId == obj.objectId || o.objectName == obj.objectName
        )) {
          this.log.warn(
            `Skipping obj ${dev.name}/${obj.objectName}. Name or object id already exists.`
          );
          return;
        }
        obj.binary = obj.type == import_client.ObjectType.BINARY_INPUT || obj.type == import_client.ObjectType.BINARY_OUTPUT || obj.type == import_client.ObjectType.BINARY_VALUE;
        objects.push(obj);
      });
      dev.objects = objects;
      this.devices.push(dev);
    });
    await this.updateStates();
    this.subscribeStates(`dev.*`);
    if (this.config.pollInterval < 0 || isNaN(this.config.pollInterval)) {
      this.log.warn(
        "poll interval cannot be smaller than 0! Using default: 30s"
      );
      this.config.pollInterval = 30;
    }
    let id = 80;
    for (let dIdx = 0; dIdx < this.devices.length; dIdx++) {
      const dev = this.devices[dIdx];
      for (let idx = 0; idx < dev.objects.length; idx++) {
        const obj = dev.objects[idx];
        if (!obj.subscribe) continue;
        this.log.debug(`subscribing to ${dev.name}/${obj.objectName}`);
        this.subscribeCOV(dev, obj, id++, 0);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (this.config.pollInterval != 0) {
      this.pollInterval = this.setInterval(() => {
        this.log.debug("POLLING VALUES...");
        this.pollValues();
      }, this.config.pollInterval * 1e3);
    }
    this.pollValues();
    this.bacnet.on("covNotifyUnconfirmed", (data) => {
      this.handleCOV(data);
    });
  }
  handleCOV(data) {
    try {
      const dev = this.devices.find(
        (dev2) => data.header.sender.address == dev2.ip
      );
      if (dev == void 0) {
        this.log.warn(
          `Received COV for not configured device (ip: ${data.header.sender.address})`
        );
        return;
      }
      const obj = dev.objects.find(
        (obj2) => obj2.objectId == data.payload.monitoredObjectId.instance
      );
      if (obj == void 0) {
        this.log.warn(
          `Received COV for not configured object (id: ${data.payload.monitoredObjectId.instance})`
        );
        return;
      }
      data.payload.values.forEach((val) => {
        let prop = "";
        if (!obj.props.includes(val.property.id)) {
          return;
        }
        for (const p in this.PROPERTIES) {
          if (this.PROPERTIES[p].id == val.property.id) {
            prop = p;
            break;
          }
        }
        if (prop == "") {
          return;
        }
        if (prop == "present_value") obj.valueType = val.value[0].type;
        else this.PROPERTIES[prop].valueType = val.value[0].type;
        this.setBACnetState(
          dev,
          obj,
          prop,
          this.handleValue(val.value[0].type, val.value[0].value)
        );
      });
      if (obj == void 0) {
        this.log.warn(
          `No state found for cov (${JSON.stringify(data.payload.monitoredObjectId)}`
        );
      }
    } catch (e) {
      this.log.error(`Failed to parse COV: ${e}`);
    }
  }
  async pollValues() {
    for (let dIdx = 0; dIdx < this.devices.length; dIdx++) {
      const dev = this.devices[dIdx];
      for (let idx = 0; idx < dev.objects.length; idx++) {
        const obj = dev.objects[idx];
        this.pollProperties(dev, obj);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  async pollProperties(dev, obj) {
    this.log.debug("Polling properties...");
    return await new Promise((resolve) => {
      const propertyArray = obj.props.map((p) => ({
        index: 0,
        id: p
      }));
      this.bacnet.readPropertyMultiple({ address: dev.ip }, [
        {
          objectId: { type: obj.type, instance: obj.objectId },
          properties: propertyArray
        }
      ]).then((value) => {
        value.values[0].values.forEach((v) => {
          if (v.value[0].type == 105) {
            return;
          }
          for (const prop in this.PROPERTIES) {
            if (this.PROPERTIES[prop].id == v.id) {
              if (prop == "present_value") obj.valueType = v.value[0].type;
              else this.PROPERTIES[prop].valueType = v.value[0].type;
              const val = this.handleValue(v.value[0].type, v.value[0].value);
              this.setBACnetState(dev, obj, prop, val);
            }
          }
        });
        resolve();
      }).catch((e) => {
        this.log.error(this.formatBacnetError(e));
        resolve();
      });
    });
  }
  async pollProperty(dev, obj, prop) {
    return await new Promise((resolve, reject) => {
      this.bacnet.readProperty(
        { address: dev.ip },
        { type: obj.type, instance: obj.objectId },
        this.PROPERTIES[prop].id
      ).then((value) => {
        this.log.debug(`received ${JSON.stringify(value)} for ${prop}`);
        if (prop == "present_value") obj.valueType = value.values[0].type;
        const v = this.handleValue(
          value.values[0].type,
          value.values[0].value
        );
        this.setBACnetState(dev, obj, prop, v);
        resolve();
      }).catch((err) => {
        this.log.error(
          `Failed to poll: ${dev.name}/${obj.objectName}/${prop}: ${this.formatBacnetError(err)}`
        );
        reject(err);
      });
    });
  }
  handleValue(dataType, value) {
    switch (dataType) {
      case 0:
        return 0;
      case 1:
        return value == 1;
      case 2:
        return value >>> 0;
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 9:
      case 10:
      case 11:
        return value;
      case 8:
        return value.value[0];
      default:
        this.log.warn(`Unknown data-type: ${dataType}`);
        return JSON.stringify(value);
    }
  }
  setBACnetState(dev, obj, prop, value) {
    const id = `dev.${dev.name}.${obj.objectName}.${prop}`;
    this.log.debug(`setting ${JSON.stringify(value)} to ${id}..`);
    this.setState(
      id,
      prop == "present_value" && obj.binary ? value == 1 : value,
      true
    ).catch((e) => {
      this.log.error(this.formatBacnetError(e));
    });
  }
  async updateStates() {
    await this.deleteUnusedStates();
    await this.createStates();
  }
  async deleteUnusedStates() {
    await this.delObjectAsync("dev", { recursive: true });
  }
  isBACnetObjectFromId(id) {
    return this.devices.some(
      (dev) => dev.objects.some(
        (obj) => id.endsWith(`dev.${dev.name}.${obj.objectName}`)
      )
    );
  }
  async createStates() {
    for (let idx = 0; idx < this.devices.length; idx++) {
      const dev = this.devices[idx];
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
            name: obj.description
          },
          native: {},
          _id: channelId
        };
        await this.setObjectNotExistsAsync(channelId, channelObj);
        for (const prop in this.PROPERTIES) {
          if (!obj.props.includes(this.PROPERTIES[prop].id)) continue;
          const propId = `dev.${dev.name}.${obj.objectName}.${prop}`;
          const propObj = {
            type: "state",
            common: {
              type: prop == "present_value" ? obj.binary ? "boolean" : "number" : "mixed",
              read: true,
              write: true,
              role: "value",
              name: `Prop ${prop}`,
              def: null
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
      if (this.pollInterval != void 0) this.clearInterval(this.pollInterval);
      this.unsubscribeCOVs().catch(() => {
      }).finally(() => {
        this.bacnet.close();
      });
      callback();
    } catch {
      callback();
    }
  }
  async unsubscribeCOVs() {
    const promises = [];
    let id = 80;
    for (let dIdx = 0; dIdx < this.devices.length; dIdx++) {
      const dev = this.devices[dIdx];
      for (let idx = 0; idx < dev.objects.length; idx++) {
        const obj = dev.objects[idx];
        if (!obj.subscribe) return;
        this.log.debug(`unsubscribing from ${dev.name}/${obj.objectName}`);
        this.subscribeCOV(dev, obj, id++, 1);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await Promise.allSettled(promises);
  }
  async subscribeCOV(dev, obj, id, time, tries = 1) {
    this.bacnet.subscribeCov(
      { address: dev.ip },
      { type: obj.type, instance: obj.objectId },
      id++,
      false,
      false,
      time
    ).catch((e) => {
      if (tries >= 3) {
        this.log.error(
          `Failed to subscribe after 3 attempts (to ${dev.name}/${obj.objectName}): ${this.formatBacnetError(e)}`
        );
        return;
      }
      this.log.warn(
        `Failed to subscribe to ${dev.name}/${obj.objectName}: ${this.formatBacnetError(e)}`
      );
      this.log.warn(`Trying again in 5 seconds(${tries} attempt)`);
      this.setTimeout(
        () => this.subscribeCOV(dev, obj, id, time, tries + 1),
        5e3
      );
    });
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
      if (state.ack) return;
      const regex = /dev\.([^\.]+)\.([^\.]+)\.(.*)$/g;
      const matches = [...id.matchAll(regex)][0];
      const dev = this.devices.find((dev2) => dev2.name == matches[1]);
      let obj;
      if (dev != void 0) {
        obj = dev.objects.find(
          (obj2) => obj2.objectName == matches[2]
        );
      }
      if (dev == void 0 || obj == void 0) {
        this.log.error(`state ${id} has no config entry`);
        return;
      }
      this.sendObject(dev, obj, matches[3], state.val);
    }
  }
  formatValueType(valueType, value) {
    switch (valueType) {
      case 0:
        return 0;
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 9:
      case 10:
      case 11:
        return value;
      case 8:
        return `[{value: ${value}, bitsUsed: 4}];`;
      default:
        this.log.warn(`Unknown data-type: ${valueType}`);
        return JSON.stringify(value);
    }
  }
  sendObject(dev, obj, prop, val) {
    this.log.debug(
      `sending (${obj.valueType}/${this.PROPERTIES[prop].valueType}, ${val}) to ${dev.ip}, (${obj.type}, ${obj.objectId}): ${this.PROPERTIES[prop].id}`
    );
    if (obj.valueType == void 0 && prop == "present_value") {
      this.log.error(`Cannot send. value type not fetched yet.`);
      return;
    }
    const valueType = prop == "present_value" ? obj.valueType : this.PROPERTIES[prop].valueType;
    if (valueType == void 0) {
      this.log.error(`Cannot send. value type not fetched yet.`);
      return;
    }
    this.bacnet.writeProperty(
      { address: dev.ip },
      { type: obj.type, instance: obj.objectId },
      this.PROPERTIES[prop].id,
      [{ type: valueType, value: this.formatValueType(valueType, val) }],
      {}
    ).catch((e) => {
      this.log.error(
        `Failed to send ${dev.name}/${obj.objectId}/${prop}: ${this.formatBacnetError(e)}`
      );
    }).finally(() => {
      this.setTimeout(() => {
        this.pollProperty(dev, obj, prop);
      }, 100);
    });
  }
  async findDevices() {
    return await new Promise((resolve) => {
      const addresses = [];
      const callback = (data) => {
        if (!data.header || !data.payload) return;
        const dev = {
          ip: data.header.sender.address,
          instance: data.payload.deviceId,
          name: ""
        };
        this.bacnet.readProperty(
          { address: data.header.sender.address },
          { instance: data.payload.deviceId, type: import_client.ObjectType.DEVICE },
          import_client.PropertyIdentifier.OBJECT_NAME
        ).then((v) => {
          dev.name = v.values[0].value;
          addresses.push(dev);
        }).catch(() => {
        });
        addresses.push();
      };
      this.bacnet.on("iAm", callback);
      this.bacnet.whoIs();
      this.setTimeout(() => {
        this.bacnet.off("iAm", callback);
        resolve(addresses);
      }, 5e3);
    });
  }
  async findObjectsFromDeviceIp(ip) {
    return this.findObjectsFromDevice(await this.findDevice(ip));
  }
  async findObjectsFromDevice(dev) {
    const objs = [];
    try {
      const vals = await this.bacnet.readProperty(
        { address: dev.ip },
        { instance: dev.instance, type: import_client.ObjectType.DEVICE },
        import_client.PropertyIdentifier.OBJECT_LIST
      );
      return await new Promise((resolve) => {
        const promises = [];
        vals.values.forEach((v) => {
          const p = this.findObject(dev, { type: v.value.type, instance: v.value.instance }).then((v2) => {
            objs.push(v2);
          }).catch(() => {
          });
          promises.push(p);
        });
        Promise.allSettled(promises).then(() => {
          resolve(objs);
        });
      });
    } catch (e) {
      this.log.error("Failed to read object list: " + e);
      return Promise.reject(e);
    }
  }
  async findObject(dev, object) {
    return await new Promise((resolve, reject) => {
      const obj = {
        id: object.instance,
        type: object.type,
        name: "",
        desc: ""
      };
      const propertyArray = [{ index: 0, id: import_client.PropertyIdentifier.OBJECT_NAME }, { index: 0, id: import_client.PropertyIdentifier.DESCRIPTION }];
      this.bacnet.readPropertyMultiple({ address: dev.ip }, [
        {
          objectId: { type: object.type, instance: object.instance },
          properties: propertyArray
        }
      ]).then((value) => {
        value.values[0].values.forEach((v) => {
          if (v.value[0].type == 105) {
            resolve(obj);
            return;
          }
          const id = v.id;
          if (id == import_client.PropertyIdentifier.OBJECT_NAME) {
            obj.name = v.value[0].value;
          }
          if (id == import_client.PropertyIdentifier.DESCRIPTION) {
            obj.desc = v.value[0].value;
          }
        });
        resolve(obj);
      }).catch(() => {
        reject();
      });
    });
  }
  async findDevice(ip) {
    return await new Promise((resolve, reject) => {
      const callback = (data) => {
        if (!data.header || !data.payload) return;
        const dev = {
          ip: data.header.sender.address,
          instance: data.payload.deviceId,
          name: ""
        };
        this.bacnet.off("iAm", callback);
        this.bacnet.readProperty(
          { address: data.header.sender.address },
          { instance: data.payload.deviceId, type: import_client.ObjectType.DEVICE },
          import_client.PropertyIdentifier.OBJECT_NAME
        ).then((v) => {
          dev.name = v.values[0].value;
          resolve(dev);
        }).catch(() => {
          resolve(dev);
        });
      };
      this.bacnet.on("iAm", callback);
      this.bacnet.whoIs({ address: ip });
      this.setTimeout(() => {
        this.bacnet.off("iAm", callback);
        reject();
      }, 5e3);
    });
  }
  formatBacnetError(error) {
    try {
      const err = error.message;
      const regex = /- Class:(\d+) - Code:(\d+)/g;
      const matches = [...err.matchAll(regex)][0];
      return `BacnetError: ${import_client.ErrorClass[Number(matches[1])]}: ${import_client.ErrorCode[Number(matches[2])]}`;
    } catch {
      return JSON.stringify(error);
    }
  }
  async onMessage(obj) {
    this.log.debug(`Received msg: ${obj.command}`);
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "getDeviceName") {
        this.log.info(`Device-Name for ip: ${obj.message.ip}`);
        this.findDevice(obj.message.ip).then((dev) => {
          this.sendTo(obj.from, obj.command, { success: true, name: dev.name }, obj.callback);
        }).catch(() => {
          this.sendTo(obj.from, obj.command, { success: false, name: "" }, obj.callback);
        });
      }
      if (obj.command === "getObjectDesc") {
        this.log.info(`Obj-Desc for ip: ${obj.message.ip}, ${obj.message.objType}, ${obj.message.objId}`);
        this.findDevice(obj.message.ip).then((dev) => {
          this.findObject(dev, { instance: obj.message.objId, type: obj.message.objType }).then((object) => {
            this.sendTo(obj.from, obj.command, { success: true, name: object.name, desc: object.desc }, obj.callback);
          }).catch((e) => {
            this.sendTo(obj.from, obj.command, { success: false, name: "", desc: "" }, obj.callback);
            this.log.error(`getObjectDesc failed: ${this.formatBacnetError(e)}`);
          });
        }).catch(() => {
          this.sendTo(obj.from, obj.command, { success: false, name: "", desc: "" }, obj.callback);
        });
      }
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new BacnetAdapter(options);
} else {
  (() => new BacnetAdapter())();
}
//# sourceMappingURL=main.js.map
