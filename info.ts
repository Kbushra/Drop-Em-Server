import { IncomingMessage } from "http";
import { WebSocket } from "ws";

export interface InputInfo
{
    input_held: boolean[],
    delta: number
}

export interface HostInfo
{
    name: string,
    creation_time: number,
    join_code: string,
    joinable: boolean,

    client_addresses: string[],
    clients_removed: number,
    frame_data: Record<string, any>,

    packet: Packet
}

export interface DiscoveryHostInfo
{
    name: string,
    creation_time: number,
    join_code: string
}

export interface ClientInfo
{
    host_address: string,
    input_data: InputInfo[],
    last_input_time: number,

    packet: Packet
}

export class Packet
{
    public data: Record<string, any>;
    private ws: WebSocket;
    private req: IncomingMessage;
    public latency: number;
    public last_ping: number;
    constructor(data: Record<string, any>, ws: WebSocket, req: IncomingMessage)
    {
        this.data = data;
        this.ws = ws;
        this.req = req;
        this.latency = 0;
        this.last_ping = Date.now()/1000;
    }

    public get ip() { return this.req.socket.remoteAddress; }
    public get port() { return this.req.socket.remotePort; }
    public get address() { return `${this.ip}:${this.req.socket.remotePort}`; }

    public send(data: Record<string, any>) { this.ws.send(JSON.stringify(data)); }
}