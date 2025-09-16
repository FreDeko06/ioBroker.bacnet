/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import Bacnet, { ApplicationTag, BACNetAddress, DecodeAcknowledgeSingleResult, ObjectType, PropertyIdentifier } from '@bacnet-js/client';

type BACnetDevice  = {
	ip: string;
	instance: number;
};
type BACnetObj  = {
	id: number;
	type: number;
	name: string;
	desc: string;
};


type Device = {
	ip: string;
	port: number;
	name: string;
	objects: BACnetObject[];
};

type BACnetObject = {
	objectId: number;
	objectName: string;
	type: number;
	subscribe: boolean;
	binary?: boolean;
	unit?: string;
	valueType?: ApplicationTag;
};
type Property = {
	id: number;
	type: ioBroker.CommonType;
	default: any;
	valueType: ApplicationTag;
};

class BacnetAdapter extends utils.Adapter {

	private bacnet: Bacnet = new Bacnet();
	private devices: Device[] = [];
	private pollInterval?: ioBroker.Interval = null;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'bacnet',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}



	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		this.devices = this.config.devices;

		// testing array
		this.devices = [
			{
				ip: "192.168.2.200",
				port: 0xBAC0,
				name: "DHC",
				objects: [{
					objectId: 305880,
					objectName: "Sollwert",
					binary: false,
					type: 0,
					unit: "",
					subscribe: false
				},
				{
					objectId: 66740,
					objectName: "Schalten1",
					binary: false,
					type: 5,
					unit: "",
					subscribe: false
				},
				{
					objectId: 66745,
					objectName: "Schalten2",
					binary: false,
					type: 5,
					unit: "",
					subscribe: false
				},
				{
					objectId: 305887,
					objectName: "Pumpe",
					binary: false,
					type: 4,
					unit: "",
					subscribe: true
				}

				],
			}
		];



		this.devices.forEach((dev: Device) => {
			dev.name = dev.name.replace(this.FORBIDDEN_CHARS, '_');
			dev.objects.forEach((obj: BACnetObject) => {
				obj.objectName = obj.objectName.replace(this.FORBIDDEN_CHARS, '_');
			});
		});
		
		await this.updateStates();
		this.subscribeStates(`dev.*`);

		this.log.debug(`binding to local port ${this.config.port}`);
		const client = new Bacnet({
			port: this.config.port,
			interface: this.config.ip
		});

		this.bacnet = client;


		if (this.config.pollInterval < 0 || isNaN(this.config.pollInterval)) {
			this.log.warn('poll interval cannot be smaller than 0! Using default: 10s');
			this.config.pollInterval = 10;
		}

		this.pollInterval = this.setInterval(() => {
			this.log.debug('POLLING VALUES...');
			this.pollValues();
		}, this.config.pollInterval * 1000);
		this.pollValues();


		this.bacnet.on('covNotifyUnconfirmed', (data: any) => {
			this.handleCOV(data);
		});

		// subscribe
		this.devices.forEach((dev: Device) => {
			let id = 80;
			dev.objects.forEach((obj: BACnetObject) => {
				if (!obj.subscribe) return;
				this.log.debug(`subscribing to ${dev.name}/${obj.objectName}`);
				this.bacnet.subscribeCov(
					{address: dev.ip},
					{type: obj.type, instance: obj.objectId},
					id++,
					false,
					false,
					0
				).catch((e) => {
					this.log.error(`Failed to subscribe to ${dev.name}/${obj.objectName}: ${e}`);
				});
			});
		});


	}

	private handleCOV(data: any): void {
		try {
			const dev: Device = this.devices.find((dev: Device) => data.header.sender.address == dev.ip)!;
			if (dev == undefined) {
				this.log.warn(`Received COV for not configured device (ip: ${data.header.sender.address})`);
				return;
			}
			const obj: BACnetObject = dev.objects.find((obj: BACnetObject) => obj.objectId == data.payload.monitoredObjectId.instance)!;
			if (obj == undefined) {
				this.log.warn(`Received COV for not configured object (id: ${data.payload.monitoredObjectId.instance})`);
				return;
			}

			data.payload.values.forEach((val: any) => {
				let prop = "";
				for (const p in this.PROPERTIES) {
					if (this.PROPERTIES[p].id == val.property.id) {
						prop = p;
						break;
					}
				}
				if (prop == "") {
					return;
				}
				this.setBACnetState(dev, obj, prop, this.handleValue(val.value[0].type, val.value[0].value))

			});
			if (obj == undefined) {
				this.log.warn(`No state found for cov (${JSON.stringify(data.payload.monitoredObjectId)}`);
			}
		}catch (e) {
			this.log.error(`Failed to parse COV: ${e}`);
		}
	}

	private pollValues(): void {
		this.devices.forEach((dev: Device) => {
			dev.objects.forEach((obj: BACnetObject) => {
				for (let prop in this.PROPERTIES) {
					this.pollProperty(dev, obj, prop);
				}
			});
		});
	}

	private pollProperty(dev: Device, obj: BACnetObject, prop: string): any {
		this.bacnet.readProperty({address: dev.ip}, {type: obj.type, instance: obj.objectId}, this.PROPERTIES[prop].id).then((value) => {
			this.log.debug(`received ${JSON.stringify(value)} for ${prop}`);
			if(prop == "present_value") obj.valueType = value.values[0].type;
			let v = this.handleValue(value.values[0].type, value.values[0].value);
			this.setBACnetState(dev, obj, prop, v);
		}).catch((err) => {
			this.log.error(`Failed to poll: ${dev.name}/${obj.objectId}: ${err}`);
		}); 				
	}

	private handleValue(dataType: number, value: any): any {
		switch(dataType) {
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
				return 0;

		}
	}

	private setBACnetState(dev: Device, obj: BACnetObject, prop: string, value: any): void {
		const id = `dev.${dev.name}.${obj.objectName}.${prop}`;
		this.log.debug(`setting ${JSON.stringify(value)} to ${id}..`);
		this.setState(id, value, true).catch((e) => {
			this.log.error(e);
		});;
	}


	private printAllObjects(): void {

		this.bacnet.readProperty({address: '192.168.2.200'}, {type: 8, instance: 10}, 76).then((value) => {
			let nums: any[] = [];
			value.values.forEach((val: any) => {
				nums.push({type: val.value.type, id: val.value.instance});
			});

			nums.forEach((n) => {
				this.bacnet.readProperty({address: '192.168.2.200'}, {type: n.type, instance: n.id}, /*28*/77).then((v) => {
						this.log.debug(n.id + ": " + v.values[0].value + " ("  + n.type + ")");
				}).catch((e) => {
					this.log.debug(n.id + ": null (" + n.type + ")");
					this.log.error(e);
				});
			});
		}).catch((e) => {
			this.log.error(e);
		});

		this.bacnet.readProperty({address: '192.168.2.200'}, {type: 4, instance: 305887}, this.PROPERTIES["present_value"].id).then((v) => {
			this.log.debug('Sollwert: ' + JSON.stringify(v));
		}).catch((e) => {
			this.log.error(e);
		}); 
	}


	private async updateStates(): Promise<void> {
		await this.deleteUnusedStates();
		await this.createStates();
	}

	private async deleteUnusedStates(): Promise<void> {
		const objects = await this.getAdapterObjectsAsync();
		for(const s in objects) {
			if (!s.startsWith(`${this.name}.${this.instance}.dev`)) continue;

			if (objects[s].type == "channel" && this.isBACnetObjectFromId(s)) {
				await this.delObjectAsync(s, {recursive: true});
			}
			if (objects[s].type == "device" && this.devices.find((dev: Device) => dev.name == s) == undefined) {
				await this.delObjectAsync(s, {recursive: true});
			}
		}
	}

	private isBACnetObjectFromId(id: string): boolean {
		return this.devices.some((dev: Device) => dev.objects.some((obj) => id == `dev.${dev.name}.${obj.objectName}`));
	}


	private PROPERTIES: {[id: string] : Property} = 
		{
		"present_value": {id: 85, type: "mixed", default: 0, valueType: 0},
		"statusFlags": {id: 111, type: "number", default: 0, valueType: 8}
	};

	private async createStates(): Promise<void> {
		for (let idx = 0; idx < this.devices.length; idx++) {
			const dev: Device = this.devices[idx];
			this.log.debug(`creating states for ${dev.name}...`);
			const deviceObj: ioBroker.Object = {
				type: "device",
				common: {
					name: `${dev.name}`,
				},
				native: {},
				_id: `dev.${dev.name}`,
			};
			await this.setObjectNotExistsAsync(`dev.${dev.name}`, deviceObj);

			for (let oIdx = 0; oIdx < dev.objects.length; oIdx++) {
				const obj = dev.objects[oIdx];

				const channelId = `dev.${dev.name}.${obj.objectName}`;

				const channelObj: ioBroker.Object = {
					type: "channel",
					common: {
						name: `Object ${obj.objectName}`,
					},
					native: {},
					_id: channelId
				};
				await this.setObjectNotExistsAsync(channelId, channelObj);


				for (const prop in this.PROPERTIES) {
					const propId = `dev.${dev.name}.${obj.objectName}.${prop}`;

					const propObj: ioBroker.StateObject = {
						type: "state",
						common: {
							type: prop == "present_value" ? (obj.binary ? "boolean" : "number") : this.PROPERTIES[prop].type,
							read: true,
							write: true,
							role: 'value',
							name: `Prop ${prop}`,
							def: prop == "present_value" ? (obj.binary ? false : 0) : this.PROPERTIES[prop].default,
							unit: obj.unit,
						},
						native: {},
						_id: propId,
					};

					await this.setObjectNotExistsAsync(propId, propObj);
				}
			}

		}
	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// unsubscribe
			
			this.clearInterval(this.pollInterval);

			this.unsubscribeCOVs().catch(() => {}).finally(() => {
				this.bacnet.close();
			});

			callback();
		} catch (e) {
			callback();
		}
	}

	private async unsubscribeCOVs(): Promise<void> {
		let promises: Promise<void>[] = [];
		this.devices.forEach((dev: Device) => {
			let id = 80;
			dev.objects.forEach((obj: BACnetObject) => {
				if (!obj.subscribe) return;
				this.log.debug(`unsubscribing to ${dev.name}/${obj.objectName}`);
				const promise = this.bacnet.subscribeCov(
					{address: dev.ip},
					{type: obj.type, instance: obj.objectId},
					id++,
					false,
					false,
					1
				).catch((e) => {
					this.log.error(`Failed to subscribe to ${dev.name}/${obj.objectName}: ${e}`);
				});
				promises.push(promise);
			});
		});
		await Promise.allSettled(promises);
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
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			if (state.ack) return;
			const regex = /dev\.([^\.]+)\.([^\.]+)\.(.*)$/g
			const matches = [...id.matchAll(regex)][0];
			this.log.debug(JSON.stringify(matches));

			const dev = this.devices.find((dev: Device) => dev.name == matches[1]);
			let obj: BACnetObject | undefined;
			if (dev != undefined) {
				obj = dev.objects.find((obj: BACnetObject) => obj.objectName == matches[2]);
			}

			if (dev == undefined || obj == undefined) {
				this.log.error(`state ${id} has no config entry`);
				return;
			}

			this.sendObject(dev, obj, matches[3], state.val);

		} 
	}

	private sendObject(dev: Device, obj: BACnetObject, prop: string, val: any): void {
		this.log.debug(`sending (${obj.valueType}, ${val}) to ${dev.ip}, (${obj.type}, ${obj.objectId}): ${this.PROPERTIES[prop].id}`);

		
		if (obj.valueType == undefined) {
			this.log.error(`Cannot send. value type not fetched yet.`);
			return;
		}

		this.bacnet.writeProperty({address: dev.ip}, {type: obj.type, instance: obj.objectId}, this.PROPERTIES[prop].id, [
			{type: prop == "present_value" ? obj.valueType : this.PROPERTIES[prop].valueType, value: val}
		], {}).catch((e) => {
			this.log.error(`Failed to send ${dev.name}/${obj.objectId}/${prop}: ${e}`);
		}).finally(() => {
			this.setTimeout(() => {
				this.pollProperty(dev, obj, prop);
			}, 100);
		});
	}

	private async findDevices(): Promise<BACnetDevice[]> {
		return await new Promise<BACnetDevice[]>((resolve) => {
			let addresses: BACnetDevice[] = [];
			const callback = (data: any) => {
				if (!data.header || !data.payload) return;
				addresses.push({ip: data.header.sender.address, instance: data.payload.deviceId});
			};
			this.bacnet.on('iAm', callback);
			this.bacnet.whoIs();
			this.setTimeout(() => {
				this.bacnet.off('iAm', callback);
				resolve(addresses);
			}, 5000);
		});
	}

	private async findObjectsFromDeviceIp(ip: string): Promise<BACnetObj[]> {
		return this.findObjectsFromDevice(await this.findDevice(ip));
	}

	private async findObjectsFromDevice(dev: BACnetDevice): Promise<BACnetObj[]> {
		let objs: BACnetObj[] = [];
		let vals = await this.bacnet.readProperty(
			{address: dev.ip},
			{instance: dev.instance, type: ObjectType.DEVICE},
			PropertyIdentifier.OBJECT_LIST
		);
		let promises: Promise<void>[] = [];
		return await new Promise<BACnetObj[]> ((resolve) => {
			vals.values.forEach((v) => {
				let obj: BACnetObj = {id: v.value.instance, type: v.value.type, name: '', desc: ''};
				objs.push(obj);
				const p = this.bacnet.readProperty(
					{address: dev.ip},
					{instance: v.value.instance, type: v.value.type},
					PropertyIdentifier.OBJECT_NAME
				).then((v) => {
					obj.name = v.values[0].value;
				}).catch(() => {
				});
				promises.push(p);
				const p2 = this.bacnet.readProperty(
					{address: dev.ip},
					{instance: v.value.instance, type: v.value.type},
					PropertyIdentifier.DESCRIPTION
				).then((v) => {
					obj.desc = v.values[0].value;
				}).catch(() => {
				});
				promises.push(p2);
			});

			Promise.allSettled(promises).then(() => {
				resolve(objs);
			});
		});
	}

	private async findDevice(ip: string): Promise<BACnetDevice> {
		return await new Promise<BACnetDevice>((resolve, reject) => {
			this.setTimeout(() => {
				this.bacnet.off('iAm', callback);
				reject();
			}, 5000);
			const callback = (data: any) => {
				if (!data.header || !data.payload) return;
				this.bacnet.off('iAm', callback);
				resolve({ip: data.header.sender.address, instance: data.payload.deviceId});
			};
			this.bacnet.on('iAm', callback);
			this.bacnet.whoIs({address: ip});
		});
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
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new BacnetAdapter(options);
} else {
	// otherwise start the instance directly
	(() => new BacnetAdapter())();
}
