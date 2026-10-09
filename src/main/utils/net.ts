import { networkInterfaces } from "os";

export function isIntranet(ip: string) {
  if (ip === "127.0.0.1" || ip === "localhost") return true;
  const [part1, part2] = ip.split(".");
  if (part1 === "10" || (part1 === "192" && part2 === "168")) return true;
  if (part1 === "172") {
    const value = parseInt(part2);
    if (value >= 16 && value <= 31) return true;
  }
  return false;
}

function getLocalIps(): Record<string, string> {
  const ips: Record<string, string> = {};
  for (const [device, infos] of Object.entries(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === "IPv4" && info.address !== "127.0.0.1" && !info.internal) ips[device] = info.address;
    }
  }
  return ips;
}

export function getLocalIpList() { return Object.values(getLocalIps()); }

export function getLocalIp() {
  const ips = getLocalIps();
  for (const device in ips) if (!device.includes("vEthernet")) return ips[device];
  return Object.values(ips)[0] || "127.0.0.1";
}
