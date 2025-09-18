import React, { useState } from 'react';
import { Theme, withStyles } from '@material-ui/core/styles';

import GenericApp from '@iobroker/adapter-react/GenericApp';
import Settings from './components/settings';
import { GenericAppProps, GenericAppSettings, GenericAppState } from '@iobroker/adapter-react/types';
import { StyleRules } from '@material-ui/core/styles';

const styles = (_theme: Theme): StyleRules => ({
	root: {},
});

type ConnectionInfo = {
	adapterName: string;
	instanceId: number;
};

class App extends GenericApp {
	constructor(props: GenericAppProps) {
		const extendedProps: GenericAppSettings = {
			...props,
			encryptedFields: [],
			translations: {
				'en': require('./i18n/en.json'),
				'de': require('./i18n/de.json'),
				'ru': require('./i18n/ru.json'),
				'pt': require('./i18n/pt.json'),
				'nl': require('./i18n/nl.json'),
				'fr': require('./i18n/fr.json'),
				'it': require('./i18n/it.json'),
				'es': require('./i18n/es.json'),
				'pl': require('./i18n/pl.json'),
				'zh-cn': require('./i18n/zh-cn.json'),
			},
		};
		super(props, extendedProps);
				
	}
	connected: boolean = false;

	onConnectionReady(): void {
		// executed when connection is ready
		console.log("CONNECTIONREADY");
		this.connected = true;
		console.log(this.socket.isConnected());
		this.socket.sendTo('admin.0', 'getVersion', {}).then((v) => console.log(v));
		this.socket.getState('system.adapter.bacnet.0.alive').then(console.log);
	}

	render() {
		if (!this.state.loaded) {
			console.log("NOT FINISH");
			return super.render();
		}
			console.log("FINISH");
		const connectionInfo = {adapterName: this.adapterName, instanceId: this.instance};

		return (
			<div className="App">
				<Settings connectionInfo={connectionInfo} socket={this.socket} state={this.state} onChange={(attr, value) => this.updateNativeValue(attr, value)} />
				{this.renderError()}
				{this.renderToast()}
				{this.renderSaveCloseButtons()}
			</div>
		);
	}
}

export default withStyles(styles)(App);
