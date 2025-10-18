import I18n from "@iobroker/adapter-react/i18n";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import React, { createRef, useState } from "react";

export default function Export({ data, onChange }): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);

  const textArea = createRef<HTMLTextAreaElement>();

  return (
    <>
      <Button
        style={{ width: "100%" }}
        variant="contained"
        color="primary"
        onClick={() => setDialogOpen(true)}
      >
        {I18n.t("export")}
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{I18n.t("export")}</DialogTitle>
        <DialogContent>
          <textarea
            ref={textArea}
            style={{ width: "100%", resize: "none" }}
            rows={30}
            spellCheck={false}
            defaultValue={JSON.stringify(data, null, 2)}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: "space-between" }}>
          <div style={{ gap: "20px" }}>
            <Button
              color="primary"
              variant="text"
              onClick={() => {
                const content = textArea.current?.value;
                if (!content) return;

                let object;

                try {
                  object = JSON.parse(content);
                } catch {
                  alert("Invalid input.");
                  return;
                }

                for (const key of Object.keys(object)) {
                  onChange(key, object[key]);
                }

                setDialogOpen(false);
              }}
            >
              {I18n.t("import")}
            </Button>
            <Button
              color="primary"
              variant="text"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(data));
                setDialogOpen(false);
              }}
            >
              {I18n.t("copy")}
            </Button>
          </div>
          <Button
            color="primary"
            variant="text"
            onClick={() => setDialogOpen(false)}
          >
            {I18n.t("close")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
