import { Button, TextField } from '@material-ui/core';
import React from 'react';
import List from './List';

import I18n from '@iobroker/adapter-react/i18n';
import Connection from '@iobroker/adapter-react/Connection';

export default function DeviceList({socket, connectionInfo, native, onChange, selectTab, setDevices}) {
    const addDeviceButton = <Button style={{width: '100%'}} variant="contained" color="primary" onClick={(e) => {
            let name = I18n.t("deviceNew");
            let num = 1;

            while (native.devices.find(device => device.name == name) != undefined) {
                num++;

                name = I18n.t("deviceNew") + " (" + num + ")";
            }

            setDevices(devices => devices.push({ip: "", port: 47808, name: name, objects: []}));
        }}>{I18n.t("deviceAdd")}</Button>;

    return (

        <>

        {addDeviceButton}
        
        <hr /><br />
        
        <List data={native.devices} columns={[
            {title: I18n.t("deviceIp"), field: "ip", format: (data, row) => 
                <TextField value={data} onChange={(e) => setDevices((devices) => devices[row].ip = e.target.value)} />},
            {title: I18n.t("devicePort"), field: "port", format: (data, row) => 
                <TextField value={data} type='number' onChange={(e) => setDevices((devices) => devices[row].port = Number(e.target.value))} />},
            {title: I18n.t("deviceName"), field: "name", format: (data, row) => 
                <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                    <TextField value={data} onChange={(e) => setDevices((devices) => devices[row].name = e.target.value)} />
                    <Button variant='contained' color='primary' onClick={() => {
			    console.log(`sending send to ${connectionInfo.adapterName}.${connectionInfo.instanceId}`);
			    console.log(`${JSON.stringify(socket as Connection)}`);
			    const p = (socket as Connection).sendTo(`${connectionInfo.adapterName}.${connectionInfo.instanceId}`, 'send')
			    	.then((v) => {
					console.log(v);
				})
				.catch((e) => {
					console.log(e);
				});
				setInterval(() => console.log(p), 1000);
                    }}>{I18n.t("fetch")}</Button>
                </span>
            },
            {title: I18n.t("deviceObjects"), field: "objects", format: (data, row) => 
                <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                    <span>{data.length} {I18n.t("deviceObjectsCount")}</span>
                    <Button variant='contained' color='primary' onClick={() => selectTab(row + 2)}>{I18n.t("show")}</Button>
                </span>
            }
        ]} onDelete={(index) => setDevices((devices) => devices.splice(index, 1))} />

        {
            native.devices.length > 5 ? <>
            <br />

            {addDeviceButton}
            </> : <></>
        }

        </>
    );
}
