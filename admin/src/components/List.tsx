import { Button, Table, TableBody, TableCell, TableHead, TableRow } from "@material-ui/core";
import React from "react"

import I18n from '@iobroker/adapter-react/i18n';

export default function List({data, columns, onDelete}) {
    return <Table stickyHeader>
        <TableHead>
            <TableRow>
                {
                    columns.filter((column) => !column.hide).map((column, index) => <TableCell key={index}><b>{column.title}</b></TableCell>)
                }
                <TableCell />
            </TableRow>
        </TableHead>
        <TableBody>
            {
                data.map((row, index) => <TableRow key={index}>
                    {columns.filter((column) => !column.hide).map((column, cIndex) => <TableCell key={cIndex}>{column.format(row[column.field], index)}</TableCell>)}
                    <TableCell><Button variant="contained" color="secondary" onClick={() => onDelete(index)}>{I18n.t("delete")}</Button></TableCell>
                </TableRow>)
            }
        </TableBody>
    </Table>;
}
