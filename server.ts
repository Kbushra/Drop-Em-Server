import { IncomingMessage, Server, createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import express from "express";

import dotenv from "dotenv";
dotenv.config();

const NETWORK_TYPES =
{
	ADD_SERVER: 0,
	GET_SERVERS: 1,
	CONNECT: 2,
	INPUTS: 3,
	CLIENT_DATA: 4,
	HOST_DATA: 5
} as const;

type NETWORK_TYPES = (typeof NETWORK_TYPES)[keyof typeof NETWORK_TYPES];

interface WebSocketR extends WebSocket
{
    req?: IncomingMessage;
}

interface HostInfo
{
    ip: string,
    port: number,
    name: string,
    creation_time: number,
    join_code_index: number
}

interface ClientInfo
{
    ip: string,
    port: number,
    id: number
}

const join_codes: string[] = [];
const servers: HostInfo[] = [];
const clients: ClientInfo[] = [];

const app = express();
app.get("/", (req: express.Request, res: express.Response) => { res.send("You're supposed to access via WSS btw."); })

const server: Server = createServer(app);
const port: number = Number(process.env.PORT || 6520);
const wss: WebSocketServer = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocketR, req: IncomingMessage) =>
{
    console.log(`Connection established at ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    ws.req = req;

    ws.on("message", (data: string) =>
    {
        const json: Object | null = safe_parse(data);
        if (json === null || !("type" in json)) { return; }

        switch (json.type as NETWORK_TYPES)
        {
            case NETWORK_TYPES.ADD_SERVER: response_add_server(json, ws); break;
            case NETWORK_TYPES.GET_SERVERS: response_get_servers(json, ws); break;
            case NETWORK_TYPES.CONNECT: response_connect(json, ws); break;
            case NETWORK_TYPES.INPUTS: response_inputs(json, ws); break;
            case NETWORK_TYPES.CLIENT_DATA: response_client_data(json, ws); break;
            case NETWORK_TYPES.HOST_DATA: response_host_data(json, ws); break;
        }
    });
});

server.listen(port, "0.0.0.0", () => { console.log(`Listening on port ${port}.`) });

function safe_parse(data: string): Object | null
{
    try { return JSON.parse(data); }
    catch (e) { return null; }
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

function response_add_server(data: any, ws: WebSocketR)
{
    const code: string = generate_join_code(join_codes);
    if (code == "" || !verify(data, ["name", "creation_time"], ["string", "number"]))
    {
        ws.send(JSON.stringify({ type: NETWORK_TYPES.ADD_SERVER, success: false }));
        return;
    }

    join_codes.push(code);
    servers.push
    ({
        ip: ws.req!.socket.remoteAddress as string,
        port: ws.req!.socket.remotePort as number,
        name: data.name as string,
        creation_time: data.creation_time as number,
        join_code_index: join_codes.length - 1
    });

    ws.send(JSON.stringify({ type: NETWORK_TYPES.ADD_SERVER, success: true }));
}

function response_get_servers(data: any, ws: WebSocketR)
{
    ws.send(JSON.stringify(servers));
}

function response_connect(data: any, ws: WebSocketR)
{

}

function response_inputs(data: any, ws: WebSocketR)
{

}

function response_client_data(data: any, ws: WebSocketR)
{

}

function response_host_data(data: any, ws: WebSocketR)
{

}