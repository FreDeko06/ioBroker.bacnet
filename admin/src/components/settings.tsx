import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import { CreateCSSProperties } from '@material-ui/core/styles/withStyles';
import { Button, Tab, Tabs, TextField } from '@material-ui/core';
import DeviceList from './DeviceList';
import ObjectList from './ObjectList';

import I18n from '@iobroker/adapter-react/i18n';

const styles = (): Record<string, CreateCSSProperties> => ({
	input: {
		marginTop: 0,
		minWidth: 400,
	},
	button: {
		marginRight: 20,
	},
	card: {
		maxWidth: 345,
		textAlign: 'center',
	},
	media: {
		height: 180,
	},
	column: {
		display: 'inline-block',
		verticalAlign: 'top',
		marginRight: 20,
	},
	columnLogo: {
		width: 350,
		marginRight: 0,
	},
	columnSettings: {
		width: 'calc(100% - 370px)',
	},
	controlElement: {
		//background: "#d2d2d2",
		marginBottom: 5,
	},
});

interface SettingsProps {
	classes: Record<string, string>;
	native: Record<string, any>;

	onChange: (attr: string, value: any) => void;
}

interface SettingsState {

	tab: number;

}

class Settings extends React.Component<SettingsProps, SettingsState> {
	constructor(props: SettingsProps) {
		super(props);

		if (this.props.native.devices == undefined) {
			this.props.native.devices = [];
		}

		this.state = {
			tab: 0
		};
	}

	render() {
		const setDevices = (set) => {
			let devices = JSON.parse(JSON.stringify(this.props.native.devices));

			set(devices);

			this.props.onChange("devices", devices);
		}

		return (
			<form className={this.props.classes.tab}>
				<Tabs value={this.state.tab} onChange={(e, newTab) => this.setState({tab: newTab})}>
					<Tab label={I18n.t("generalSettingsTab")} />
					<Tab label={I18n.t("devicesTab")} />
					{
						this.props.native.devices.map((device, index) => {
							return <Tab key={index} label={device.name} />;
						})
					}
				</Tabs>

				<div style={{padding: 10}}>

					<CustomTabPanel value={this.state.tab} index={0}>
						<Button style={{width: '100%'}} variant="contained" color="secondary" onClick={() => this.setState({tab: 1})}>
							{I18n.t("editDevices")}
						</Button>
						<br /><br />
						<h1>{I18n.t("generalSettingsTab")}</h1>
						<TextField label={I18n.t("pollInterval")} type='number' value={this.props.native.pollInterval} onChange={(e) => {
							this.props.onChange("pollInterval", Number(e.target.value));
						}} /> <br /><br />
						<TextField label={I18n.t("listenIp")} value={this.props.native.ip} onChange={(e) => {
							this.props.onChange("ip", e.target.value);
						}} /> <br /><br />
						<TextField label={I18n.t("listenPort")} type='number' value={this.props.native.port} onChange={(e) => {
							this.props.onChange("port", Number(e.target.value));
						}} />
					</CustomTabPanel>

					<CustomTabPanel value={this.state.tab} index={1}>
						<Button style={{width: '100%'}} variant="contained" color="secondary" onClick={() => this.setState({tab: 0})}>
							{I18n.t("generalSettingsTab")}
						</Button>
						<br /><br />
						<DeviceList native={this.props.native} onChange={this.props.onChange} selectTab={(tab) => this.setState({tab: tab})} setDevices={setDevices} />
					</CustomTabPanel>

					{
						this.props.native.devices.map((device, index) => {
							return <CustomTabPanel key={index} value={this.state.tab} index={index + 2}>
									<Button style={{width: '100%'}} variant="contained" color="secondary" onClick={() => this.setState({tab: 1})}>
										{I18n.t("showAllDevices")}
									</Button>
									<br /><br />
									<ObjectList native={this.props.native} deviceIndex={index} onChange={this.props.onChange} setDevices={setDevices} />
								</CustomTabPanel>;
						})
					}

				</div>
			</form>
		);
	}
}


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}


export default withStyles(styles)(Settings);