import { Capacitor } from "@capacitor/core";

export const platformUtils = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  isAndroid(): boolean {
    return Capacitor.getPlatform() === "android";
  },

  isIos(): boolean {
    return Capacitor.getPlatform() === "ios";
  },

  isWeb(): boolean {
    return Capacitor.getPlatform() === "web";
  },

  getPlatformName(): string {
    return Capacitor.getPlatform();
  },
};
