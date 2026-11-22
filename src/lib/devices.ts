export interface InputDevice {
  deviceId: string;
  label: string;
}

export async function primePermission(
  kind: 'videoinput' | 'audioinput',
): Promise<boolean> {
  if (window.vj) {
    await window.vj.askMediaAccess(kind === 'videoinput' ? 'camera' : 'microphone');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === 'videoinput' ? { video: true } : { audio: true },
    );
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (_error) {
    return false;
  }
}

export async function listInputDevices(
  kind: 'videoinput' | 'audioinput',
): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label:
        device.label ||
        `${kind === 'videoinput' ? 'Ingresso video' : 'Ingresso audio'} ${index + 1}`,
    }));
}
