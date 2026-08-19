import { IncomingMessage, createServer } from "http";
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
    creation_time: number
}

interface ClientInfo
{
    ip: string,
    port: number,
    id: number
}

const app = express();
app.get("/", (req: express.Request, res: express.Response) => { res.send("You're supposed to access via WSS btw."); })

const server = createServer();
const port: number = process.env.PORT as any as number || 6520;
const wss: WebSocketServer = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocketR, req: IncomingMessage) =>
{
    ws.req = req;

    ws.on("message", (data: string) =>
    {
        const json: Object = JSON.parse(data);
        if (!("type" in json)) { return; }

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

server.listen(port, () => { console.log(`Listening on port ${port}.`) })

function response_add_server(data: Object, ws: WebSocketR)
{

}

function response_get_servers(data: Object, ws: WebSocketR)
{
    
}

function response_connect(data: Object, ws: WebSocketR)
{

}

function response_inputs(data: Object, ws: WebSocketR)
{

}

function response_client_data(data: Object, ws: WebSocketR)
{

}

function response_host_data(data: Object, ws: WebSocketR)
{

}