import { IncomingMessage, Server, createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import express from "express";

import { NETWORK_TYPES } from "./network_types";
import { InputInfo, HostInfo, ClientInfo, Packet, DiscoveryHostInfo } from "./info";
import { verify, safe_parse } from "./validation";
import { generate_random_string } from "./string_utils";

import dotenv from "dotenv";
dotenv.config();

const join_codes: string[] = [];
const hosts: HostInfo[] = [];
const clients: ClientInfo[] = [];

const app = express();
app.get("/", (req: express.Request, res: express.Response) => { res.send("You're supposed to access via WSS btw."); })

const server: Server = createServer(app);
const port: number = Number(process.env.PORT || 6520);
const wss: WebSocketServer = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) =>
{
    ws.on("message", (msg: string) =>
    {
        const data: Record<string, any> = safe_parse(msg);
        if (!verify(data, ["type"], ["number"])) { return; }

        const packet: Packet = new Packet(data, ws, req);

        switch (data.type as NETWORK_TYPES)
        {
            case NETWORK_TYPES.ADD_HOST:
                response_add_host(packet);
            break;

            case NETWORK_TYPES.GET_HOSTS:
                response_get_hosts(packet);
            break;

            case NETWORK_TYPES.CONNECT:
                response_connect(packet);
            break;

            case NETWORK_TYPES.SET_INPUTS_GET_FRAME:
                response_set_inputs_get_frame(packet);
            break;

            case NETWORK_TYPES.SET_FRAME_GET_INPUTS:
                response_set_frame_get_inputs(packet);
            break;
        }
    });
});

server.listen(port, "0.0.0.0", () => { console.log(`Listening on port ${port}.`) });

function get_client(packet: Packet)
{
    return clients.find((value: ClientInfo) =>
        { return value.ip === packet.ip && value.port === packet.port; });
}

function get_host(packet: Packet)
{
    return hosts.find((value: HostInfo) =>
        { return value.ip === packet.ip && value.port === packet.port; });
}

function response_err(packet: Packet)
{
    if (!verify(packet.data, ["type"], ["number"])) { return; }
    packet.send({ type: packet.data.type, success: false });
}

function response_success(packet: Packet, extra: Record<string, any> = {})
{
    if (!verify(packet.data, ["type"], ["number"])) { return; }
    packet.send({ type: packet.data.type, success: true, ...extra });
}

function response_add_host(packet: Packet)
{
    const code: string = generate_random_string(join_codes, 6);
    const client = get_client(packet);
    const host = get_host(packet);
    if (code == "" || client !== undefined || host !== undefined ||
    !verify(packet.data, ["name"], ["string"])) { response_err(packet); return; }

    join_codes.push(code);
    hosts.push
    ({
        ip: packet.ip as string,
        port: packet.port as number,

        name: packet.data.name as string,
        creation_time: Date.now(),
        join_code_index: join_codes.length - 1,

        client_indices: [],
        frame_data: {}
    });

    response_success(packet);
    console.log(`${packet.address} has been added as a host!`);
}

function response_get_hosts(packet: Packet)
{
    const host_infos: DiscoveryHostInfo[] = [];
    for (let i: number = 0; i < hosts.length; i++)
    {
        host_infos.push
        ({
            name: hosts[i].name,
            creation_time: hosts[i].creation_time,
            join_code: join_codes[hosts[i].join_code_index]
        });
    }

    response_success(packet, { hosts: host_infos });
    console.log(`${packet.address} requested for all servers.`);
}

function response_connect(packet: Packet)
{
    const client = get_client(packet);
    const host = get_host(packet);
    if (client !== undefined || host !== undefined || !verify(packet.data, ["join_code"], ["string"])) { response_err(packet); return; }

    const host_index: number = hosts.findIndex((value: HostInfo) =>
        { return join_codes[value.join_code_index] == packet.data.join_code; });

    if (host_index === -1) { response_err(packet); return; }

    hosts[host_index].client_indices.push(clients.length);
    clients.push
    ({
        ip: packet.ip as string,
        port: packet.port as number,

        host_index,
        input_data: [],
        last_input_time: Date.now()
    });

    response_success(packet, { id: hosts[host_index].client_indices.length - 1 });
    console.log(`${packet.address} has connected to a host!`);
}

function response_set_inputs_get_frame(packet: Packet)
{
    const client = get_client(packet);
    if (client === undefined || !verify(packet.data, ["input_data"], ["object"]) ||
    !verify(packet.data.input_data, ["input_pressed", "input_held", "input_released", "delta"], ["object", "object", "object", "number"]))
    {
        response_err(packet);
        return;
    }

    if (packet.data.input_data.delta < Date.now() - client.last_input_time)
    {
        client.last_input_time = Date.now();
        try { client.input_data.push(packet.data.input_data); }
        catch (e) {}
    }

    const frame_data = hosts[client.host_index].frame_data;
    response_success(packet, { frame_data });
}

function response_set_frame_get_inputs(packet: Packet)
{
    const host = get_host(packet);
    if (host === undefined || !verify(packet.data, ["frame_data"], ["object"])) { response_err(packet); return; }

    try { host.frame_data = packet.data.frame_data; }
    catch (e) {}

    const input_data: InputInfo[][] = [];
    for (let i: number = 0; i < host.client_indices.length; i++)
    {
        const client_input_data = clients[host.client_indices[i]].input_data;
        clients[host.client_indices[i]].input_data = [];
        input_data.push(client_input_data);
    }

    response_success(packet, { input_data });
}