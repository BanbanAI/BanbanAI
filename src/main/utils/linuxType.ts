import { readFile } from 'fs/promises';

export enum LinuxPackageType {
  DEB = 'deb',
  RPM = 'rpm',
  UNKNOWN = 'unknown'
};

// DEB 系发行版（更全面的列表）
const debDistros = [
  'debian', 'ubuntu', 'linuxmint', 'mint', 'deepin', 'pop',
  'elementary', 'kali', 'parrot', 'raspbian', 'zorin', 'mx',
  'devuan', 'pureos', 'backbox', 'tails', 'peppermint', 'lubuntu',
  'xubuntu', 'kubuntu', 'ubuntu-mate', 'ubuntu-budgie'
];

// RPM 系发行版（更全面的列表）
const rpmDistros = [
  'rhel', 'redhat', 'fedora', 'centos', 'rocky', 'alma',
  'almalinux', 'scientific', 'oracle', 'amazon', 'anolis',
  'openeuler', 'opensuse', 'suse', 'tumbleweed', 'leap',
  'mageia', 'clearos', 'photon', 'euleros'
];

export async function detectLinuxPackageType(): Promise<LinuxPackageType> {
  try {
    const content: string = await readFile('/etc/os-release', { encoding: 'utf-8' });

    const idMatch = content.match(/^ID=(.+)$/m);
    const idLikeMatch = content.match(/^ID_LIKE=(.+)$/m);

    const id = idMatch?.[1]?.replace(/"/g, '').toLowerCase() ?? '';
    const idLike = idLikeMatch?.[1]?.replace(/"/g, '').toLowerCase() ?? '';

    const fields = [id, idLike];

    if (fields.some(f => debDistros.some(d => f.includes(d)))) {
      return LinuxPackageType.DEB;
    }

    if (fields.some(f => rpmDistros.some(d => f.includes(d)))) {
      return LinuxPackageType.RPM;
    }

    return LinuxPackageType.UNKNOWN;
  } catch {
    return LinuxPackageType.UNKNOWN;
  }
}