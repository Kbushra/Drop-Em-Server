import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";

enum NETWORK_TYPES
{
	ADD_SERVER,
	GET_SERVERS,
	CONNECT,
	INPUTS,
	CLIENT_DATA,
	HOST_DATA
}

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

const wss: WebSocketServer = new WebSocketServer({ port: 6520 });
wss.on("connection", (ws: WebSocketR, req: IncomingMessage) =>
{
    ws.req = req;

    ws.on("message", (data: string) =>
    {
        const json: Object = JSON.parse(data);
        if (!("type" in json)) { return; }

        switch (json.type)
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