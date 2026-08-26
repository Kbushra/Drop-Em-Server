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
const hosts: Record<string, HostInfo> = {};
const clients: Record<string, ClientInfo> = {};

const app = express();
app.get("/", (req: express.Request, res: express.Response) => { res.send("You're supposed to access via WSS btw."); })

const server: Server = createServer(app);
const port: number = Number(process.env.PORT || 6520);
const wss: WebSocketServer = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) =>
{
    const packet: Packet = new Packet({}, ws, req);
    let heartbeat_time: number = Date.now();
    setInterval(() =>
    {
        if (Date.now() - heartbeat_time < 10000) { return; }
        disconnect_address(packet.address);
        ws.close(1006, "Failed heartbeat.");
    }, 1000);

    ws.on("message", (msg: string) =>
    {
        const data: Record<string, any> = safe_parse(msg);
        if (!verify(data, ["type"], ["number"])) { return; }

        packet.data = data;

        switch (data.type as NETWORK_TYPES)
        {
            case NETWORK_TYPES.HEARTBEAT:
                heartbeat_time = Date.now();
                response_success(packet);
            break;

            case NETWORK_TYPES.ADD_HOST:
                response_add_host(packet);
            break;

            case NETWORK_TYPES.GET_HOSTS:
                response_get_hosts(packet);
            break;

            case NETWORK_TYPES.JOIN:
                response_join(packet);
            break;

            case NETWORK_TYPES.LEAVE:
                response_leave(packet);
            break;

            case NETWORK_TYPES.KICK:
                response_kick(packet);
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

function response_err(packet: Packet, reason: string = "Cheating...")
{
    if (!verify(packet.data, ["type"], ["number"])) { return; }
    packet.send({ type: packet.data.type, success: false, reason });
}

function response_success(packet: Packet, extra: Record<string, any> = {})
{
    if (!verify(packet.data, ["type"], ["number"])) { return; }
    packet.send({ type: packet.data.type, success: true, ...extra });
}

function response_add_host(packet: Packet)
{
    const code: string = generate_random_string(join_codes, 6);
    const client = clients[packet.address];
    const host = hosts[packet.address];
    const max_host_count = 50;

    if (client !== undefined || host !== undefined || !verify(packet.data, ["name"], ["string"])) { response_err(packet); return; }

    if (code == "" || Object.keys(hosts).length >= max_host_count) { response_err(packet, "Host limit reached!"); return; }

    join_codes.push(code);
    hosts[packet.address] =
    ({
        name: packet.data.name as string,
        creation_time: Date.now(),
        join_code: code,
        joinable: true,

        client_addresses: [],
        frame_data: {}
    });

    response_success(packet);
    console.log(`${packet.address} has been added as a host!`);
}

function response_get_hosts(packet: Packet)
{
    const addresses = Object.keys(hosts);
    const host_infos: DiscoveryHostInfo[] = [];
    for (let i: number = 0; i < addresses.length; i++)
    {
        host_infos.push
        ({
            name: hosts[i].name,
            creation_time: hosts[i].creation_time,
            join_code: hosts[i].join_code
        });
    }

    response_success(packet, { hosts: host_infos });
    console.log(`${packet.address} requested for all servers.`);
}

function response_join(packet: Packet)
{
    const client = clients[packet.address];
    const host = hosts[packet.address];
    const max_client_count = 500;

    if (client !== undefined || host !== undefined || !verify(packet.data, ["join_code"], ["string"])) { response_err(packet); return; }

    if (Object.keys(clients).length >= max_client_count) { response_err(packet, "Client limit reached!"); return; }

    const host_address: string | undefined = Object.keys(hosts).find((value: string) =>
        { return hosts[value].join_code == packet.data.join_code; });

    if (host_address === undefined) { response_err(packet, "Invalid join code!"); return; }
    if (!hosts[host_address].joinable) { response_err(packet, "Host is no longer joinable!"); return; }

    hosts[host_address].client_addresses.push(packet.address);
    clients[packet.address] =
    ({
        host_address,
        input_data: [],
        last_input_time: Date.now()
    });

    response_success(packet, { id: hosts[host_address].client_addresses.length - 1 });
    console.log(`${packet.address} has connected to a host!`);
}

function disconnect_address(address: string)
{
    const client = clients[address];
    const host = hosts[address];
    if (client !== undefined) { delete clients[address]; }
    if (host !== undefined) { join_codes.slice(join_codes.indexOf(host.join_code), 1); delete hosts[address]; }
}

function response_leave(packet: Packet)
{
    disconnect_address(packet.address);
    response_success(packet);
}

function response_kick(packet: Packet)
{
    const host = hosts[packet.address];
    if (host === undefined || !verify(packet.data, ["id"], ["number"])) { response_err(packet); return; }

    const client_address = host.client_addresses[packet.data.id];
    host.client_addresses[packet.data.id] = "";
    delete clients[client_address];
    response_success(packet);
}

function response_set_inputs_get_frame(packet: Packet)
{
    const client = clients[packet.address];

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

    if (!(client.host_address in hosts)) { response_err(packet, "Host has disconnected!"); return; }

    const frame_data = hosts[client.host_address].frame_data;
    response_success(packet, { frame_data });
}

function response_set_frame_get_inputs(packet: Packet)
{
    const host = hosts[packet.address];
    if (host === undefined || !verify(packet.data, ["joinable", "frame_data"], ["boolean", "object"])) { response_err(packet); return; }

    host.joinable = packet.data.joinable;
    try { host.frame_data = packet.data.frame_data; }
    catch (e) {}

    const input_data: (InputInfo[] | undefined)[] = [];
    for (let i: number = 0; i < host.client_addresses.length; i++)
    {
        const client_address = host.client_addresses[i];
        if (!(client_address in clients))
        {
            input_data[i] = undefined;
            continue;
        }

        const client_input_data = clients[client_address].input_data;
        clients[client_address].input_data = [];
        input_data[i] = client_input_data;
    }

    response_success(packet, { input_data });
}