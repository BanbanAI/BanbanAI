import io, { ManagerOptions, SocketOptions } from 'socket.io-client';

const defaultOptions = {
  isConnect: true,
  namespace: 'project',
  ioOptions: {} as Partial<ManagerOptions & SocketOptions>,
}
export type GetSocketOptions = Partial<typeof defaultOptions>
export const getSocket = async (options: GetSocketOptions = {}) => {
  const { namespace, isConnect, ioOptions } = { ...defaultOptions, ...options };

  const url = `${location.protocol}//${location.hostname}:${location.port}/${ namespace }`;
  const socket = io(url, ioOptions);
  if (isConnect) socket.connect();
  return socket;
}
