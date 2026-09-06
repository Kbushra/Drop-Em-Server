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
    const heartbeats = setInterval(() =>
    {
        if (Date.now() - heartbeat_time < 10 * 60 * 1000) { return; }

        disconnect_address(packet.address);
        clearInterval(heartbeats);
        ws.terminate();
    }, 1000);

    console.log(`Connected to ${packet.address}!`);

    ws.on("close", () =>
    {
        disconnect_address(packet.address);
        clearInterval(heartbeats);
    });

    ws.on("message", (msg: string) =>
    {
        heartbeat_time = Date.now();
        
        const data: Record<string, any> = safe_parse(msg);
        if (!verify(data, ["type"], ["number"])) { return; }

        packet.data = data;

        switch (data.type as NETWORK_TYPES)
        {
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

    if (client !== undefined) { response_err(packet, "Already a client!"); return; }
    if (host !== undefined) { response_err(packet, "Already a host!"); return; }
    if (!verify(packet.data, ["name"], ["string"])) { response_err(packet, "Unreadable packet!"); return; }

    if (code == "" || Object.keys(hosts).length >= max_host_count) { response_err(packet, "Host limit reached!"); return; }

    join_codes.push(code);
    hosts[packet.address] =
    ({
        name: packet.data.name as string,
        creation_time: Date.now(),
        join_code: code,
        joinable: true,

        client_addresses: [],
        clients_removed: 0,
        frame_data: {}
    });

    response_success(packet, { join_code: code });
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
            name: hosts[addresses[i]].name,
            creation_time: hosts[addresses[i]].creation_time,
            join_code: hosts[addresses[i]].join_code
        });
    }

    response_success(packet, { hosts: host_infos });
}

function response_join(packet: Packet)
{
    const client = clients[packet.address];
    const host = hosts[packet.address];
    const max_client_count = 500;

    if (client !== undefined) { response_err(packet, "Already a client!"); return; }
    if (host !== undefined) { response_err(packet, "Already a host!"); return; }
    if (!verify(packet.data, ["join_code"], ["string"])) { response_err(packet, "Unreadable packet!"); return; }

    if (Object.keys(clients).length >= max_client_count) { response_err(packet, "Client limit reached!"); return; }

    const host_address: string | undefined = Object.keys(hosts).find((value: string) =>
        { return hosts[value].join_code == packet.data.join_code; });

    if (host_address === undefined) { response_err(packet, "Invalid join code!"); return; }
    if (!hosts[host_address].joinable || hosts[host_address].client_addresses.length - hosts[host_address].clients_removed >= 7)
        { response_err(packet, "Host is no longer joinable!"); return; }

    hosts[host_address].client_addresses.push(packet.address);
    clients[packet.address] =
    ({
        host_address,
        input_data: [],
        last_input_time: Date.now()/1000
    });

    response_success(packet, { id: hosts[host_address].client_addresses.length - 1 });
    console.log(`${packet.address} has connected to ${host_address}!`);
}

function disconnect_address(address: string)
{
    const client = clients[address];
    const host = hosts[address];
    if (client !== undefined) { delete clients[address]; }
    if (host !== undefined) { join_codes.slice(join_codes.indexOf(host.join_code), 1); delete hosts[address]; }

    console.log(`${address} disconnected.`);
}

function response_leave(packet: Packet)
{
    disconnect_address(packet.address);
    response_success(packet);
}

function response_kick(packet: Packet)
{
    const host = hosts[packet.address];

    if (host === undefined) { response_err(packet, "Not a host!"); return; }
    if (!verify(packet.data, ["id"], ["number"])) { response_err(packet, "Unreadable packet!"); return; }

    const client_address = host.client_addresses[packet.data.id];
    if (clients[client_address] !== undefined) { delete clients[client_address]; }

    host.client_addresses[packet.data.id] = "";
    host.clients_removed++;
    response_success(packet);
    console.log(`${packet.address} kicked ${client_address}.`);
}

function response_set_inputs_get_frame(packet: Packet)
{
    const client = clients[packet.address];

    if (client === undefined) { response_err(packet, "Not a client!"); return; }
    if (!verify(packet.data, ["input_data"], ["object"]) || !verify(packet.data.input_data, ["input_held", "delta"], ["object", "number"]))
        { response_err(packet, "Unreadable packet!"); return; }

    if (packet.data.input_data.delta < Date.now()/1000 - client.last_input_time)
    {
        client.last_input_time += packet.data.input_data.delta;
        try { client.input_data.push(packet.data.input_data); }
        catch (e) {}
    }

    const host = hosts[client.host_address];
    if (host === undefined) { response_err(packet, "Host has disconnected!"); return; }

    response_success(packet, { client_count: host.client_addresses.length, clients_removed: host.clients_removed, frame_data: host.frame_data });
}

function response_set_frame_get_inputs(packet: Packet)
{
    const host = hosts[packet.address];

    if (host === undefined) { response_err(packet, "Not a host!"); return; }
    if (!verify(packet.data, ["joinable", "frame_data"], ["boolean", "object"])) { response_err(packet, "Unreadable packet!"); return; }

    host.joinable = packet.data.joinable;
    try { host.frame_data = packet.data.frame_data; }
    catch (e) {}

    host.clients_removed = 0;
    const input_data: (InputInfo[] | -1)[] = [];
    for (let i: number = 0; i < host.client_addresses.length; i++)
    {
        const client = clients[host.client_addresses[i]];
        if (client === undefined)
        {
            host.clients_removed++;
            input_data[i] = -1;
            continue;
        }

        input_data[i] = client.input_data;
        client.input_data = [];
    }
    
    response_success(packet, { input_data });
}