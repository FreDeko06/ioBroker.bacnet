import { Button, TextField } from "@material-ui/core";
import React from "react";

import I18n from "@iobroker/adapter-react/i18n";
import Connection from "@iobroker/adapter-react/Connection";
import List from "./List";

export default function DeviceList({
  socket,
  connectionInfo,
  native,
  selectTab,
  setDevices,
}): JSX.Element {
  const addDeviceButton = (
    <Button
      style={{ width: "100%" }}
      variant="contained"
      color="primary"
      onClick={() => {
        let name = I18n.t("deviceNew");
        let num = 1;

        while (
          native.devices.find((device) => device.name == name) != undefined
        ) {
          num++;

          name = I18n.t("deviceNew") + " (" + num + ")";
        }

        setDevices((devices) =>
          devices.push({ ip: "", port: 47808, name: name, objects: [] }),
        );
      }}
    >
      {I18n.t("deviceAdd")}
    </Button>
  );

  return (
    <>
      {addDeviceButton}
      <br />
      <List
        data={native.devices}
        columns={[
          {
            title: I18n.t("deviceIp"),
            field: "ip",
            format: (data, row) => (
              <TextField
                value={data}
                onChange={(e) =>
                  setDevices((devices) => (devices[row].ip = e.target.value))
                }
              />
            ),
          },
          {
            title: I18n.t("deviceName"),
            field: "name",
            format: (data, row) => (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <TextField
                  value={data}
                  onChange={(e) =>
                    setDevices(
                      (devices) => (devices[row].name = e.target.value),
                    )
                  }
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    const p = await (socket as Connection).sendTo(
                      `${connectionInfo.adapterName}.${connectionInfo.instanceId}`,
                      "getDeviceName",
                      { ip: native.devices[row].ip },
                    );
                    if (p == undefined) return;
                    const msg: { success: boolean; name: string } =
                      p as unknown as { success: boolean; name: string };
                    console.log(msg);
                    if (msg.success) {
                      setDevices((devices) => (devices[row].name = msg.name));
                    } else {
                      alert("Device not found");
                    }
                  }}
                >
                  {I18n.t("fetch")}
                </Button>
              </span>
            ),
          },
          {
            title: I18n.t("deviceObjects"),
            field: "objects",
            format: (data, row) => (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span>
                  {data.length} {I18n.t("deviceObjectsCount")}
                </span>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => selectTab(row + 2)}
                >
                  {I18n.t("show")}
                </Button>
              </span>
            ),
          },
        ]}
        onDelete={(index) => setDevices((devices) => devices.splice(index, 1))}
      />
      {native.devices.length > 5 ? (
        <>
          <br />

          {addDeviceButton}
        </>
      ) : (
        <></>
      )}
    </>
  );
}
