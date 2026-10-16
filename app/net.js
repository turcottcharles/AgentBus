'use strict';
// Finds virtual-machine networks on whatever machine this runs on: VMware, VirtualBox, Hyper-V, Parallels,
// QEMU/libvirt, UTM and WSL host-side adapters, on Windows, macOS and Linux. Nothing here is specific to one PC.
const os = require('node:os');
const { execFile } = require('node:child_process');

const VM_PATTERNS = [
  [/vmware|vmnet/i, 'VMware'],
  [/virtualbox|vboxnet|host-only/i, 'VirtualBox'],
  [/vethernet.*wsl/i, 'WSL'],
  [/vethernet|hyper-v|default switch/i, 'Hyper-V'],
  [/parallels|prl/i, 'Parallels'],
  [/virbr|libvirt|qemu|vnet/i, 'QEMU/libvirt'],
  [/^bridge1\d\d$/i, 'VM bridge (UTM/Parallels/VMware Fusion)'],
  [/^vmenet|^vmnet\d/i, 'VMware Fusion'],
  [/docker|^br-|podman/i, 'Containers'],
];
// VPN and tunnel adapters look virtual too, but a VM never sits behind them.
const NOT_VM = /vpn|surfshark|nord|wireguard|tailscale|zerotier|openvpn|cisco|fortinet|proton|mullvad|utun|loopback|bluetooth/i;

function isPrivate(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
const subnetOf = (ip, mask) => ip.split('.').map((o, i) => Number(o) & Number(mask.split('.')[i])).join('.');

function adapters() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      const vm = NOT_VM.test(name) ? null : VM_PATTERNS.find(([re]) => re.test(name))?.[1] || null;
      out.push({ name, address: a.address, netmask: a.netmask, cidr: a.cidr, vm, lan: !vm && isPrivate(a.address) && !NOT_VM.test(name) });
    }
  }
  return out;
}

// Neighbours (likely guests) seen on each VM subnet, read from the OS ARP/neighbour table.
function neighbours() {
  return new Promise((resolve) => {
    const [cmd, args] = process.platform === 'win32' ? ['arp', ['-a']] : process.platform === 'darwin' ? ['arp', ['-an']] : ['ip', ['neigh']];
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) return resolve([]);
      const seen = [];
      for (const line of String(stdout).split(/\r?\n/)) {
        const m = line.match(/(\d+\.\d+\.\d+\.\d+)\)?\s+(?:at\s+|lladdr\s+|dev \S+ lladdr\s+)?([0-9a-f]{1,2}[:-][0-9a-f:-]{14,})?\s*(dynamic|static)?/i);
        if (!m || !m[2]) continue;
        const ip = m[1], last = Number(ip.split('.')[3]);
        if (last === 255 || last === 0 || Number(ip.split('.')[0]) >= 224) continue;
        if (/^ff[:-]ff/i.test(m[2]) || /^01[:-]00[:-]5e/i.test(m[2])) continue;
        if (m[3] && m[3].toLowerCase() === 'static') continue;
        seen.push({ ip, mac: m[2].toLowerCase().replace(/-/g, ':') });
      }
      resolve(seen);
    });
  });
}

// Guess the VM product from the MAC's vendor prefix.
function macVendor(mac) {
  const p = mac.slice(0, 8);
  if (/^00:0c:29|^00:50:56|^00:05:69|^00:1c:14/.test(p)) return 'VMware';
  if (/^08:00:27|^0a:00:27/.test(p)) return 'VirtualBox';
  if (/^00:15:5d/.test(p)) return 'Hyper-V';
  if (/^00:1c:42/.test(p)) return 'Parallels';
  if (/^52:54:00/.test(p)) return 'QEMU/KVM';
  return '';
}

async function discover({ lan }) {
  const ads = adapters();
  const vmAds = ads.filter((a) => a.vm && a.vm !== 'Containers');
  const listenOn = [...vmAds, ...(lan ? ads.filter((a) => a.lan) : [])].map((a) => a.address);
  const neigh = await neighbours();
  const guests = [];
  for (const a of vmAds) {
    const net = subnetOf(a.address, a.netmask);
    for (const n of neigh) {
      if (n.ip === a.address || subnetOf(n.ip, a.netmask) !== net) continue;
      const last = Number(n.ip.split('.')[3]);
      // .1/.2 on NAT networks are usually the virtual gateway/DHCP, not a guest
      if (last <= 2 && !macVendor(n.mac)) continue;
      guests.push({ ip: n.ip, mac: n.mac, vendor: macVendor(n.mac) || a.vm, adapter: a.name, hostIp: a.address });
    }
  }
  return { adapters: ads, vmAdapters: vmAds, listenOn: [...new Set(listenOn)], guests };
}

module.exports = { discover, adapters };
