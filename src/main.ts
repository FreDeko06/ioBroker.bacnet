/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import bacnet from 'bacstack';

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
	binary?: boolean;
	unit?: string;
};
type Property = {
	id: number;
	type: ioBroker.CommonType;
	default: any;
};
class Bacnet extends utils.Adapter {

	private bacnet: any;

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
		this.config.devices.forEach((dev: Device) => {
			dev.name = dev.name.replace(this.FORBIDDEN_CHARS, "_");
			dev.objects.forEach((obj: BACnetObject) => {
				obj.objectName = obj.objectName.replace(this.FORBIDDEN_CHARS, "_");
			});
		});
		
		await this.updateStates();

		this.log.debug(`binding to local port ${this.config.port}`);
		const client = new bacnet({
			port: this.config.port,
			interface: this.config.ip,
			adpuTimeout: 6000
		});

		this.bacnet = client;

		client.readProperty('192.168.2.200', {type: 8, instance: 10}, 76, (err: any, value: any) => {

			let nums: any[] = [];
			value.values.forEach((val: any) => {
				nums.push({type: val.value.type, id: val.value.instance});
			});

			nums.forEach((n) => {
				client.readProperty('192.168.2.200', {type: n.type, instance: n.id}, 28, (e: any, v: any) => {
					if (v == undefined) {
						this.log.debug(n.id + ": null (" + n.type + ")");
					}else {
						this.log.debug(n.id + ": " + v.values[0].value + " ("  + n.type + ")");
					}
				});
			});

		});

		client.readProperty('192.168.2.200', {type: 0, instance: 305880}, this.PROPERTIES["present_value"].id, (e: any, v: any) => {

			if (e != undefined) {
				this.log.error(e);
				return;
			}

			this.log.debug('Sollwert: ' + JSON.stringify(v));
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

			if (objects[s].type == "channel" && this.getBACnetObjectFromId(s) == undefined) {
				await this.delObjectAsync(s, {recursive: true});
			}
			if (objects[s].type == "device" && this.config.devices.find((dev: Device) => dev.name == s) == undefined) {
				await this.delObjectAsync(s, {recursive: true});
			}
		}
	}

	private getBACnetObjectFromId(id: string): BACnetObject {
		return this.config.devices.find((dev: Device) => dev.objects.some((obj) => id == `dev.${dev.name}.${obj.objectName}`));
	}


	private PROPERTIES: {[id: string] : Property} = 
		{
		"present_value": {id: 85, type: "mixed", default: 0},
		"statusFlags": {id: 111, type: "number", default: 0}
	};

	private async createStates(): Promise<void> {
		for (let idx = 0; idx < this.config.devices.length; idx++) {
			const dev: Device = this.config.devices[idx];
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
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			bacnet.close();

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
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
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
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Bacnet(options);
} else {
	// otherwise start the instance directly
	(() => new Bacnet())();
}
