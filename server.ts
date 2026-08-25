import { IncomingMessage, Server, createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import express from "express";

import dotenv from "dotenv";
dotenv.config();

const NETWORK_TYPES =
{
	ADD_HOST: 0,
	GET_HOSTS: 1,
	CONNECT: 2,
	SET_INPUTS_GET_FRAME: 3,
    SET_FRAME_GET_INPUTS: 4
} as const;

type NETWORK_TYPES = (typeof NETWORK_TYPES)[keyof typeof NETWORK_TYPES];

interface WebSocketR extends WebSocket
{
    req?: IncomingMessage;
}

interface InputInfo
{
    input_pressed: boolean[],
    input_held: boolean[],
    input_released: boolean[],
    delta: number
}

interface HostInfo
{
    ip: string,
    port: number,

    name: string,
    creation_time: number,
    join_code_index: number,

    client_indices: number[],
    frame_data: Record<string, any>
}

interface ClientInfo
{
    ip: string,
    port: number,

    host_index: number,
    input_data: InputInfo
}

const join_codes: string[] = [];
const hosts: HostInfo[] = [];
const clients: ClientInfo[] = [];

const app = express();
app.get("/", (req: express.Request, res: express.Response) => { res.send("You're supposed to access via WSS btw."); })

const server: Server = createServer(app);
const port: number = Number(process.env.PORT || 6520);
const wss: WebSocketServer = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocketR, req: IncomingMessage) =>
{
    console.log(`Connection established at ${remote_id(req)}`);
    ws.req = req;

    ws.on("message", (data: string) =>
    {
        const json: Record<string, any> | null = safe_parse(data);
        if (json === null || !("type" in json)) { return; }

        switch (json.type as NETWORK_TYPES)
        {
            case NETWORK_TYPES.ADD_HOST: response_add_host(json, ws); break;
            case NETWORK_TYPES.GET_HOSTS: response_get_hosts(json, ws); break;
            case NETWORK_TYPES.CONNECT: response_connect(json, ws); break;
            case NETWORK_TYPES.SET_INPUTS_GET_FRAME: response_set_inputs_get_frame(json, ws); break;
            case NETWORK_TYPES.SET_FRAME_GET_INPUTS: response_set_frame_get_inputs(json, ws); break;
        }
    });
});

server.listen(port, "0.0.0.0", () => { console.log(`Listening on port ${port}.`) });

function remote_id(req: IncomingMessage) { return `${req.socket.remoteAddress}:${req.socket.remotePort}`; }

function safe_parse(data: string): Record<string, any> | null
{
    try
    {
        const res: object = JSON.parse(data);
        if (!Array.isArray(res)) { return res; }
    }
    catch (e) {}

    return null;
}

function verify(data: Record<string, any>, prop_names: string[], prop_types: string[])
{
    if (prop_names.length != prop_types.length) { return false; }

    for (let i: number = 0; i < prop_names.length; i++)
    {
        if (!(prop_names[i] in data) || typeof data[prop_names[i]] != prop_types[i]) { return false; }
    }
    
    return true;
}

function number_to_alphanumeric(num: number): string
{
    if (num < 10) { num += 48; } //0-9
    else if (num < 10 + 26) { num += 65 - 10; } //A-Z
    else if (num < 10 + 26 + 26) { num += 97 - (10 + 26); } //a-z
    return String.fromCharCode(num);
}

function number_to_code(num: number, len: number): string
{
    if (num >= 62**len) { return ""; }

    let result: string = "";
    for (let i: number = 0; i < len; i++)
    {
        const mask: number = 62**(len - i - 1);
        const quotient: number = Math.floor(num / mask);
        num -= quotient * mask;
        result += number_to_alphanumeric(quotient);
    }

    return result;
}

function generate_join_code(blacklist: string[]): string
{
    const len = 6;
    if (blacklist.length === 62**len) { return ""; }

    let result: string = "";

    for (let i: number = 0; i < 50; i++) //50 attempts max
    {
        result = "";
        for (let i: number = 0; i < len; i++)
        {
            const num = Math.floor(Math.random() * 62);
            result += number_to_alphanumeric(num);
        }

        if (!blacklist.includes(result)) { return result; }
    }

    for (let i: number = 0; i < 62**len; i++)
    {
        result = number_to_code(i, len);
        if (!blacklist.includes(result)) { return result; }
    }

    return "";
}

function response_add_host(data: Record<string, any>, ws: WebSocketR)
{
    const code: string = generate_join_code(join_codes);
    if (code == "" || !verify(data, ["name"], ["string"]))
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.ADD_HOST, success: false }));
        return;
    }

    join_codes.push(code);
    hosts.push
    ({
        ip: ws.req!.socket.remoteAddress as string,
        port: ws.req!.socket.remotePort as number,

        name: data.name as string,
        creation_time: Date.now(),
        join_code_index: join_codes.length - 1,

        client_indices: [],
        frame_data: {}
    });

    ws.send(JSON.stringify({ type: NETWORK_TYPES.ADD_HOST, success: true }));
    console.log(`${remote_id(ws.req!)} has been added as a host!`);
}

function response_get_hosts(data: Record<string, any>, ws: WebSocketR)
{
    const host_infos: {name: string, creation_time: number, join_code: string}[] = [];
    for (let i: number = 0; i < hosts.length; i++)
    {
        host_infos.push({ name: hosts[i].name, creation_time: hosts[i].creation_time, join_code: join_codes[hosts[i].join_code_index] });
    }

    ws.send(JSON.stringify({ type: NETWORK_TYPES.GET_HOSTS, hosts: host_infos }));
    console.log(`${remote_id(ws.req!)} requested for all servers.`);
}

function response_connect(data: Record<string, any>, ws: WebSocketR)
{
    if (!verify(data, ["join_code"], ["string"]))
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.CONNECT, success: false }));
        return;
    }

    const host_index: number = hosts.findIndex((value: HostInfo) =>
        { return join_codes[value.join_code_index] == data.join_code; });

    if (host_index === -1)
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.CONNECT, success: false }));
        return;
    }

    hosts[host_index].client_indices.push(clients.length);
    clients.push
    ({
        ip: ws.req!.socket.remoteAddress as string,
        port: ws.req!.socket.remotePort as number,

        host_index,
        input_data:
        {
            input_pressed: [],
            input_held: [],
            input_released: [],
            delta: 0
        }
    });

    ws.send(JSON.stringify({ type: NETWORK_TYPES.CONNECT, success: true, id: hosts[host_index].client_indices.length - 1 }));
    console.log(`${remote_id(ws.req!)} has connected to a host!`);
}

function response_set_inputs_get_frame(data: Record<string, any>, ws: WebSocketR)
{
    const client = clients.find((value: ClientInfo) =>
        { return value.ip === ws.req!.socket.remoteAddress && value.port === ws.req!.socket.remotePort; })

    if (client === undefined || !verify(data, ["input_data"], ["object"]) ||
    !verify(data.input_data, ["input_pressed", "input_held", "input_released", "delta"], ["object", "object", "object", "number"]))
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.SET_INPUTS_GET_FRAME, success: false }));
        return;
    }

    try { client.input_data = data.input_data; }
    catch (e) {}

    const frame_data = hosts[client.host_index].frame_data;
    ws.send(JSON.stringify({ type: NETWORK_TYPES.SET_INPUTS_GET_FRAME, success: true, frame_data }));
}

function response_set_frame_get_inputs(data: Record<string, any>, ws: WebSocketR)
{
    const host = hosts.find((value: HostInfo) =>
        { return value.ip === ws.req!.socket.remoteAddress && value.port === ws.req!.socket.remotePort; })

    if (host === undefined || !verify(data, ["frame_data"], ["object"]))
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.SET_FRAME_GET_INPUTS, success: false }));
        return;
    }

    try { host.frame_data = data.frame_data; }
    catch (e) {}

    const input_data: InputInfo[] = [];
    for (let i: number = 0; i < host.client_indices.length; i++)
    {
        const client_input_data = clients[host.client_indices[i]].input_data;
        input_data.push(client_input_data);
    }

    ws.send(JSON.stringify({ type: NETWORK_TYPES.SET_FRAME_GET_INPUTS, success: true, input_data }));
}