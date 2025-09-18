import { Button, Checkbox, MenuItem, Select, TextField } from '@material-ui/core';
import React from 'react';
import List from './List';
import Connection from '@iobroker/adapter-react/Connection';

import I18n from '@iobroker/adapter-react/i18n';

export default function ObjectList({socket, connectionInfo, state, deviceIndex, onChange, setDevices}) {
    const addObjectButton = <Button style={{width: '100%'}} variant="contained" color="primary" onClick={(e) => {
                let name = I18n.t("objectNew");
                let num = 1;
    
                while (state.native.devices[deviceIndex].objects.find(o => o.objectName == name) != undefined) {
                    num++;
    
                    name = I18n.t("objectNew") + " (" + num + ")";
                }

                setDevices((devices) => devices[deviceIndex].objects.push({objectId: 0, objectName: name, type: 0, subscribe: false, description: "", props: [85, 111]}));
            }}>{I18n.t("objectAdd")}</Button>;

    return <>
            
            {addObjectButton}
        
            <hr /><br />
            
            <List data={state.native.devices[deviceIndex].objects} columns={[
                {title: I18n.t("objectType"), field: "type", format: (data, row) => 
                    <Select value={data} onChange={(e) => {
                        setDevices(devices => devices[deviceIndex].objects[row].type = e.target.value);
                    }}>
                        <MenuItem value={0}>ANALOG INPUT (0)</MenuItem>
                        <MenuItem value={1}>ANALOG OUTPUT (1)</MenuItem>
                        <MenuItem value={2}>ANALOG VALUE (2)</MenuItem>
                        <MenuItem value={3}>BINARY INPUT (3)</MenuItem>
                        <MenuItem value={4}>BINARY OUTPUT (4)</MenuItem>
                        <MenuItem value={5}>BINARY VALUE (5)</MenuItem>
                        <MenuItem value={6}>CALENDAR (6)</MenuItem>
                        <MenuItem value={7}>COMMAND (7)</MenuItem>
                        <MenuItem value={8}>DEVICE (8)</MenuItem>
                        <MenuItem value={9}>EVENT ENROLLMENT (9)</MenuItem>
                        <MenuItem value={10}>FILE (10)</MenuItem>
                        <MenuItem value={11}>GROUP (11)</MenuItem>
                        <MenuItem value={12}>LOOP (12)</MenuItem>
                        <MenuItem value={13}>MULTI STATE INPUT (13)</MenuItem>
                        <MenuItem value={14}>MULTI STATE OUTPUT (14)</MenuItem>
                        <MenuItem value={15}>NOTIFICATION CLASS (15)</MenuItem>
                        <MenuItem value={16}>PROGRAM (16)</MenuItem>
                        <MenuItem value={17}>SCHEDULE (17)</MenuItem>
                        <MenuItem value={18}>AVERAGING (18)</MenuItem>
                        <MenuItem value={19}>MULTI STATE VALUE (19)</MenuItem>
                        <MenuItem value={20}>TREND LOG (20)</MenuItem>
                        <MenuItem value={21}>LIFE SAFETY POINT (21)</MenuItem>
                        <MenuItem value={22}>LIFE SAFETY ZONE (22)</MenuItem>
                        <MenuItem value={23}>ACCUMULATOR (23)</MenuItem>
                        <MenuItem value={24}>PULSE CONVERTER (24)</MenuItem>
                        <MenuItem value={25}>EVENT LOG (25)</MenuItem>
                        <MenuItem value={26}>GLOBAL GROUP (26)</MenuItem>
                        <MenuItem value={27}>TREND LOG MULTIPLE (27)</MenuItem>
                        <MenuItem value={28}>LOAD CONTROL (28)</MenuItem>
                        <MenuItem value={29}>STRUCTURED VIEW (29)</MenuItem>
                        <MenuItem value={30}>ACCESS DOOR (30)</MenuItem>
                        <MenuItem value={31}>TIMER (31)</MenuItem>
                        <MenuItem value={32}>ACCESS CREDENTIAL (32)</MenuItem>
                        <MenuItem value={33}>ACCESS POINT (33)</MenuItem>
                        <MenuItem value={34}>ACCESS RIGHTS (34)</MenuItem>
                        <MenuItem value={35}>ACCESS USER (35)</MenuItem>
                        <MenuItem value={36}>ACCESS ZONE (36)</MenuItem>
                        <MenuItem value={37}>CREDENTIAL DATA INPUT (37)</MenuItem>
                        <MenuItem value={38}>NETWORK SECURITY (38)</MenuItem>
                        <MenuItem value={39}>BITSTRING VALUE (39)</MenuItem>
                        <MenuItem value={40}>CHARACTERSTRING VALUE (40)</MenuItem>
                        <MenuItem value={41}>DATEPATTERN VALUE (41)</MenuItem>
                        <MenuItem value={42}>DATE VALUE (42)</MenuItem>
                        <MenuItem value={43}>DATETIMEPATTERN VALUE (43)</MenuItem>
                        <MenuItem value={44}>DATETIME VALUE (44)</MenuItem>
                        <MenuItem value={45}>INTEGER VALUE (45)</MenuItem>
                        <MenuItem value={46}>LARGE ANALOG VALUE (46)</MenuItem>
                        <MenuItem value={47}>OCTETSTRING VALUE (47)</MenuItem>
                        <MenuItem value={48}>POSITIVE INTEGER VALUE (48)</MenuItem>
                        <MenuItem value={49}>TIMEPATTERN VALUE (49)</MenuItem>
                        <MenuItem value={50}>TIME VALUE (50)</MenuItem>
                        <MenuItem value={51}>NOTIFICATION FORWARDER (51)</MenuItem>
                        <MenuItem value={52}>ALERT ENROLLMENT (52)</MenuItem>
                        <MenuItem value={53}>CHANNEL (53)</MenuItem>
                        <MenuItem value={54}>LIGHTING OUTPUT (54)</MenuItem>
                        <MenuItem value={55}>BINARY LIGHTING OUTPUT (55)</MenuItem>
                        <MenuItem value={56}>NETWORK PORT (56)</MenuItem>
                        <MenuItem value={57}>ELEVATOR GROUP (57)</MenuItem>
                        <MenuItem value={58}>ESCALATOR (58)</MenuItem>
                        <MenuItem value={59}>LIFT (59)</MenuItem>
                    </Select>
                },
                {title: I18n.t("objectId"), field: "objectId", format: (data, row) => 
                    <TextField value={data} type='number' onChange={(e) => setDevices(devices => devices[deviceIndex].objects[row].objectId = Number(e.target.value))} />
                },
                {title: I18n.t("objectName"), field: "objectName", format: (data, row) => 
                    <TextField value={data} onChange={(e) => setDevices(devices => devices[deviceIndex].objects[row].objectName = e.target.value)} />
                },
                {title: I18n.t("objectDescription"), field: "description", format: (data, row) => 
                    <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                        <TextField value={data} onChange={(e) => setDevices(devices => devices[deviceIndex].objects[row].description = e.target.value)} />
                        <Button variant='contained' color='primary' onClick={async () => {
			    const p = await (socket as Connection).sendTo(`${connectionInfo.adapterName}.${connectionInfo.instanceId}`, 'getObjectDesc', 
									  {ip: state.native.devices[deviceIndex].ip, objType: state.native.devices[deviceIndex].objects[row].type,
									    objId: state.native.devices[deviceIndex].objects[row].objectId});
			    if (p == undefined) return;
			    const msg: {success: boolean, name: string, desc: string} = p as unknown as {success: boolean, name: string, desc: string};
			    console.log(msg);
			    if (msg.success) {
				    setDevices((devices) => devices[deviceIndex].objects[row].objectName = msg.name);
				    setDevices((devices) => devices[deviceIndex].objects[row].description = msg.desc);
			    }else {
				    alert("Object not found");
			    }
                        }}>{I18n.t("fetch")}</Button>
                    </span>
                },
                {hide: !state.expertMode, title: I18n.t("objectProperties"), field: "props", format: (data, row) => 
                    <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                        <TextField value={data.map(i => isNaN(i) ? "" : i).join(",")} onChange={(e) => setDevices(devices => {
                            devices[deviceIndex].objects[row].props = e.target.value.replace(/[^0-9,]/g, "").split(",").map(s => s == "" ? NaN : Number(s));
                        })} />
                    </span>
                },
                {title: "Subscribe", field: "subscribe", format: (data, row) => 
                    <Checkbox color="primary" checked={data} onChange={(e) => setDevices(devices => devices[deviceIndex].objects[row].subscribe = e.target.checked)} />
                }
            ]} onDelete={(index) => setDevices((devices) => devices[deviceIndex].objects.splice(index, 1))} />

            {
                state.native.devices[deviceIndex].objects.length > 5 ? <>
                <br />

                {addObjectButton}
            </> : <></>
            }
        </>;
}
