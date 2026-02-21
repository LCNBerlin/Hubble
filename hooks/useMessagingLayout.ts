import { useWindowDimensions } from "react-native";

export const TABLET_BREAKPOINT = 768;

export const CONVERSATIONS_FLEX = 0.3;
export const CHAT_FLEX = 0.52;
export const CRM_FLEX = 0.2;
export const CRM_PANEL_WIDTH_PERCENT = 0.2;

export type MessagingLayout = {
  isTablet: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
  /** Landscape tablet: show 3 panels side by side. Portrait tablet/mobile: list then full-screen chat, CRM overlay. */
  threePanel: boolean;
  conversationsFlex: number;
  chatFlex: number;
  crmFlex: number;
  /** When CRM is collapsed, use 0 so layout gives space to chat. */
  crmCollapsed: boolean;
};

export function useMessagingLayout(crmCollapsed: boolean): MessagingLayout {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLandscape = width > height;
  const threePanel = isTablet && isLandscape;
  const crmFlex = threePanel && !crmCollapsed ? CRM_FLEX : 0;
  const chatFlex = threePanel ? (crmCollapsed ? CHAT_FLEX + CRM_FLEX : CHAT_FLEX) : 1;
  const conversationsFlex = threePanel ? CONVERSATIONS_FLEX : 0;

  return {
    isTablet,
    isLandscape,
    width,
    height,
    threePanel,
    conversationsFlex,
    chatFlex,
    crmFlex,
    crmCollapsed,
  };
}
